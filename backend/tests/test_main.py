"""
Tests for main.py — API endpoints, input validation, auth, health check.
All Firebase and AI calls are mocked so tests run without real credentials.
"""
import json
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient


# ── Mock Firebase init before importing app ───────────────────────────────────
@pytest.fixture(autouse=True)
def mock_firebase_init():
    with patch("firebase_admin.initialize_app"), \
         patch("firebase_admin.credentials.Certificate"), \
         patch("firebase_auth._init_firebase"):
        yield


@pytest.fixture
def client():
    """TestClient with verify_token dependency overridden."""
    from main import app, limiter
    from firebase_auth import verify_token

    app.dependency_overrides[verify_token] = lambda: {"uid": "test-uid-123", "email": "test@example.com"}
    limiter.reset()
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def client_unauthenticated():
    """TestClient without auth override — simulates missing/invalid token."""
    from main import app
    yield TestClient(app)


# ── Health ────────────────────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_ok(self, client):
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}

    def test_health_no_auth_required(self, client_unauthenticated):
        response = client_unauthenticated.get("/health")
        assert response.status_code == 200


# ── Upload endpoint ───────────────────────────────────────────────────────────

class TestUpload:
    def _make_file(self, content=b"sample text content", filename="test.txt"):
        return {"files": (filename, content, "text/plain")}

    def test_upload_success(self, client):
        mock_result = json.dumps({"questions": [
            {"question": "מה זה?", "answer": "תשובה", "critical_points": ["נקודה 1"]}
        ]})
        with patch("main.generate_questions", return_value=mock_result):
            response = client.post(
                "/upload",
                files=self._make_file(),
                data={"question_type": "open", "question_count": 1, "difficulty": "medium"},
            )
        assert response.status_code == 200
        assert "questions" in response.json()

    def test_upload_invalid_file_type(self, client):
        response = client.post(
            "/upload",
            files={"files": ("test.exe", b"content", "application/octet-stream")},
            data={"question_type": "open", "question_count": 5, "difficulty": "medium"},
        )
        assert response.status_code == 400
        assert "נתמך" in response.json()["detail"]

    def test_upload_invalid_question_type(self, client):
        response = client.post(
            "/upload",
            files=self._make_file(),
            data={"question_type": "invalid", "question_count": 5, "difficulty": "medium"},
        )
        assert response.status_code == 400
        assert "שאלה" in response.json()["detail"]

    def test_upload_question_count_too_high(self, client):
        response = client.post(
            "/upload",
            files=self._make_file(),
            data={"question_type": "open", "question_count": 999, "difficulty": "medium"},
        )
        assert response.status_code == 400

    def test_upload_question_count_zero(self, client):
        response = client.post(
            "/upload",
            files=self._make_file(),
            data={"question_type": "open", "question_count": 0, "difficulty": "medium"},
        )
        assert response.status_code == 400

    def test_upload_invalid_difficulty(self, client):
        response = client.post(
            "/upload",
            files=self._make_file(),
            data={"question_type": "open", "question_count": 5, "difficulty": "extreme"},
        )
        assert response.status_code == 400

    def test_upload_file_too_large(self, client):
        from main import MAX_UPLOAD_BYTES
        large_content = b"x" * (MAX_UPLOAD_BYTES + 1)
        response = client.post(
            "/upload",
            files={"files": ("big.txt", large_content, "text/plain")},
            data={"question_type": "open", "question_count": 5, "difficulty": "medium"},
        )
        assert response.status_code == 413

    def test_upload_requires_auth(self, client_unauthenticated):
        response = client_unauthenticated.post(
            "/upload",
            files=self._make_file(),
            data={"question_type": "open", "question_count": 5, "difficulty": "medium"},
        )
        assert response.status_code == 401

    def test_upload_all_valid_question_types(self, client):
        mock_result = json.dumps({"questions": []})
        with patch("main.generate_questions", return_value=mock_result):
            for qtype in ("open", "yesno", "multiple"):
                response = client.post(
                    "/upload",
                    files=self._make_file(),
                    data={"question_type": qtype, "question_count": 3, "difficulty": "easy"},
                )
                assert response.status_code == 200, f"Failed for question_type={qtype}"

    def test_upload_all_valid_difficulties(self, client):
        mock_result = json.dumps({"questions": []})
        with patch("main.generate_questions", return_value=mock_result):
            for diff in ("easy", "medium", "hard"):
                response = client.post(
                    "/upload",
                    files=self._make_file(),
                    data={"question_type": "open", "question_count": 3, "difficulty": diff},
                )
                assert response.status_code == 200, f"Failed for difficulty={diff}"

    def test_upload_pdf_file(self, client):
        mock_result = json.dumps({"questions": []})
        with patch("main.generate_questions", return_value=mock_result):
            response = client.post(
                "/upload",
                files={"files": ("doc.pdf", b"%PDF-1.4 fake content", "application/pdf")},
                data={"question_type": "open", "question_count": 5, "difficulty": "medium"},
            )
        assert response.status_code == 200

    def test_upload_multiple_valid_files(self, client):
        mock_result = json.dumps({"questions": [
            {"question": "מה זה?", "answer": "תשובה", "critical_points": ["נקודה 1"]}
        ]})
        files = [
            ("files", ("file1.txt", b"content of file one", "text/plain")),
            ("files", ("file2.txt", b"content of file two", "text/plain")),
            ("files", ("file3.txt", b"content of file three", "text/plain")),
        ]
        with patch("main.generate_questions", return_value=mock_result):
            response = client.post(
                "/upload",
                files=files,
                data={"question_type": "open", "question_count": 3, "difficulty": "medium"},
            )
        assert response.status_code == 200
        assert "questions" in response.json()

    def test_upload_exceeds_max_files(self, client):
        from main import MAX_FILES
        files = [
            ("files", (f"file{i}.txt", b"content", "text/plain"))
            for i in range(MAX_FILES + 1)
        ]
        response = client.post(
            "/upload",
            files=files,
            data={"question_type": "open", "question_count": 5, "difficulty": "medium"},
        )
        assert response.status_code == 400
        assert str(MAX_FILES) in response.json()["detail"]


# ── Grade endpoint ────────────────────────────────────────────────────────────

class TestGrade:
    def _grade_payload(self, question_type="open"):
        return {
            "questions": [{"question": "שאלה?", "answer": "תשובה", "critical_points": ["נקודה"]}],
            "answers": ["תשובה"],
            "question_type": question_type,
        }

    def test_grade_success(self, client):
        mock_result = json.dumps({
            "score": 1,
            "feedback": [{"question": "שאלה?", "points": 1, "correct": True,
                          "explanation": "טוב", "covered_points": [], "missed_points": []}]
        })
        with patch("main.grade_answers", return_value=mock_result):
            response = client.post("/grade", json=self._grade_payload())
        assert response.status_code == 200
        assert response.json()["score"] == 1

    def test_grade_requires_auth(self, client_unauthenticated):
        response = client_unauthenticated.post("/grade", json=self._grade_payload())
        assert response.status_code == 401

    def test_grade_returns_feedback_array(self, client):
        mock_result = json.dumps({
            "score": 0,
            "feedback": [{"question": "שאלה?", "points": 0, "correct": False,
                          "explanation": "לא נכון", "covered_points": [], "missed_points": ["נקודה"]}]
        })
        with patch("main.grade_answers", return_value=mock_result):
            response = client.post("/grade", json=self._grade_payload())
        assert response.status_code == 200
        assert len(response.json()["feedback"]) == 1

    def test_grade_multiple_choice(self, client):
        payload = {
            "questions": [{"question": "שאלה?", "answer": "א", "options": {"א": "נכון", "ב": "לא"}}],
            "answers": ["א"],
            "question_type": "multiple",
        }
        mock_result = json.dumps({
            "score": 1,
            "feedback": [{"question": "שאלה?", "points": 1, "correct": True,
                          "explanation": "נכון", "covered_points": [], "missed_points": []}]
        })
        with patch("main.grade_answers", return_value=mock_result):
            response = client.post("/grade", json=payload)
        assert response.status_code == 200