"""
Tests for engine.py — text extraction functions and input validation logic.
AI API calls are mocked so tests run without real credentials or network.
"""
import io
import json
import pytest
from unittest.mock import patch, MagicMock


# ── Mock OPENROUTER_API_KEY before importing engine ───────────────────────────
@pytest.fixture(autouse=True)
def mock_env(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key-mock")


# ── Text extraction ───────────────────────────────────────────────────────────

class TestExtractTextFromTxt:
    def test_basic_utf8(self):
        from engine import extract_text_from_txt
        content = "שלום עולם\nזהו טקסט לדוגמה".encode("utf-8")
        result = extract_text_from_txt(content)
        assert "שלום עולם" in result
        assert "טקסט לדוגמה" in result

    def test_empty_file(self):
        from engine import extract_text_from_txt
        result = extract_text_from_txt(b"")
        assert result == ""

    def test_english_text(self):
        from engine import extract_text_from_txt
        result = extract_text_from_txt(b"Hello World")
        assert result == "Hello World"


class TestExtractTextFromDocx:
    def test_valid_docx(self):
        from docx import Document
        from engine import extract_text_from_docx
        doc = Document()
        doc.add_paragraph("פסקה ראשונה")
        doc.add_paragraph("פסקה שנייה")
        buf = io.BytesIO()
        doc.save(buf)
        result = extract_text_from_docx(buf.getvalue())
        assert "פסקה ראשונה" in result
        assert "פסקה שנייה" in result

    def test_empty_docx(self):
        from docx import Document
        from engine import extract_text_from_docx
        doc = Document()
        buf = io.BytesIO()
        doc.save(buf)
        result = extract_text_from_docx(buf.getvalue())
        assert isinstance(result, str)


class TestExtractTextFromPptx:
    def test_valid_pptx(self):
        from pptx import Presentation
        from pptx.util import Inches
        from engine import extract_text_from_pptx
        prs = Presentation()
        slide = prs.slides.add_slide(prs.slide_layouts[1])
        slide.shapes.title.text = "כותרת שקופית"
        slide.placeholders[1].text = "תוכן שקופית"
        buf = io.BytesIO()
        prs.save(buf)
        result = extract_text_from_pptx(buf.getvalue())
        assert "כותרת שקופית" in result
        assert "תוכן שקופית" in result

    def test_empty_pptx(self):
        from pptx import Presentation
        from engine import extract_text_from_pptx
        prs = Presentation()
        buf = io.BytesIO()
        prs.save(buf)
        result = extract_text_from_pptx(buf.getvalue())
        assert isinstance(result, str)


class TestExtractTextFromPdf:
    def test_valid_pdf(self):
        import fitz
        from engine import extract_text_from_pdf
        doc = fitz.open()
        page = doc.new_page()
        page.insert_text((50, 50), "PDF content test")
        buf = io.BytesIO(doc.tobytes())
        result = extract_text_from_pdf(buf.getvalue())
        assert "PDF content test" in result

    def test_empty_pdf(self):
        import fitz
        from engine import extract_text_from_pdf
        doc = fitz.open()
        doc.new_page()
        buf = io.BytesIO(doc.tobytes())
        result = extract_text_from_pdf(buf.getvalue())
        assert isinstance(result, str)


# ── generate_questions ────────────────────────────────────────────────────────

class TestGenerateQuestions:
    def _mock_response(self, payload: dict):
        mock_choice = MagicMock()
        mock_choice.message.content = json.dumps(payload)
        mock_resp = MagicMock()
        mock_resp.choices = [mock_choice]
        return mock_resp

    def test_unsupported_file_type_raises(self):
        with patch.dict("os.environ", {"OPENROUTER_API_KEY": "test"}):
            from engine import generate_questions
            with pytest.raises(ValueError, match="Unsupported file type"):
                generate_questions(b"content", "file.xyz")

    def test_generates_open_questions(self):
        from engine import generate_questions
        expected = {"questions": [{"question": "מה זה?", "answer": "תשובה", "critical_points": ["נקודה"]}]}
        with patch("engine.client") as mock_client:
            mock_client.chat.completions.create.return_value = self._mock_response(expected)
            result = json.loads(generate_questions(b"some text", "test.txt", "open", 1, "medium"))
        assert "questions" in result
        assert len(result["questions"]) == 1

    def test_generates_yesno_questions(self):
        from engine import generate_questions
        expected = {"questions": [{"question": "נכון?", "answer": "כן"}]}
        with patch("engine.client") as mock_client:
            mock_client.chat.completions.create.return_value = self._mock_response(expected)
            result = json.loads(generate_questions(b"some text", "test.txt", "yesno", 1, "easy"))
        assert result["questions"][0]["answer"] in ("כן", "לא")

    def test_generates_multiple_choice_questions(self):
        from engine import generate_questions
        expected = {"questions": [{"question": "מה?", "answer": "א", "options": {"א": "א", "ב": "ב", "ג": "ג", "ד": "ד"}}]}
        with patch("engine.client") as mock_client:
            mock_client.chat.completions.create.return_value = self._mock_response(expected)
            result = json.loads(generate_questions(b"some text", "test.txt", "multiple", 1, "hard"))
        assert "options" in result["questions"][0]

    def test_question_count_clamped_to_minimum(self):
        """question_count < 1 should be clamped to 1."""
        from engine import generate_questions
        expected = {"questions": []}
        with patch("engine.client") as mock_client:
            mock_client.chat.completions.create.return_value = self._mock_response(expected)
            # Should not raise even with count=0
            generate_questions(b"text", "test.txt", "open", 0, "medium")
            call_args = mock_client.chat.completions.create.call_args
            prompt = call_args[1]["messages"][1]["content"]
            assert "generate 1" in prompt

    def test_question_count_clamped_to_maximum(self):
        """question_count > 100 should be clamped to 100."""
        from engine import generate_questions
        expected = {"questions": []}
        with patch("engine.client") as mock_client:
            mock_client.chat.completions.create.return_value = self._mock_response(expected)
            generate_questions(b"text", "test.txt", "open", 999, "medium")
            call_args = mock_client.chat.completions.create.call_args
            prompt = call_args[1]["messages"][1]["content"]
            assert "generate 100" in prompt

    def test_txt_file_dispatched_correctly(self):
        from engine import generate_questions
        expected = {"questions": []}
        with patch("engine.client") as mock_client, \
             patch("engine.extract_text_from_txt", return_value="extracted text") as mock_extract:
            mock_client.chat.completions.create.return_value = self._mock_response(expected)
            generate_questions(b"hello", "test.txt", "open", 1, "medium")
            mock_extract.assert_called_once_with(b"hello")

    def test_pdf_file_dispatched_correctly(self):
        from engine import generate_questions
        expected = {"questions": []}
        with patch("engine.client") as mock_client, \
             patch("engine.extract_text_from_pdf", return_value="pdf text") as mock_extract:
            mock_client.chat.completions.create.return_value = self._mock_response(expected)
            generate_questions(b"pdf bytes", "doc.pdf", "open", 1, "medium")
            mock_extract.assert_called_once()


# ── grade_answers ─────────────────────────────────────────────────────────────

class TestGradeAnswers:
    def _mock_response(self, payload: dict):
        mock_choice = MagicMock()
        mock_choice.message.content = json.dumps(payload)
        mock_resp = MagicMock()
        mock_resp.choices = [mock_choice]
        return mock_resp

    def test_grade_open_questions(self):
        from engine import grade_answers
        expected = {
            "score": 1,
            "feedback": [{"question": "מה?", "points": 1, "correct": True,
                          "explanation": "מצוין", "covered_points": ["נקודה"], "missed_points": []}]
        }
        with patch("engine.client") as mock_client:
            mock_client.chat.completions.create.return_value = self._mock_response(expected)
            result = json.loads(grade_answers(
                [{"question": "מה?", "answer": "תשובה", "critical_points": ["נקודה"]}],
                ["תשובה"],
                "open"
            ))
        assert result["score"] == 1

    def test_grade_yesno_questions(self):
        from engine import grade_answers
        expected = {
            "score": 1,
            "feedback": [{"question": "נכון?", "points": 1, "correct": True,
                          "explanation": "נכון", "covered_points": [], "missed_points": []}]
        }
        with patch("engine.client") as mock_client:
            mock_client.chat.completions.create.return_value = self._mock_response(expected)
            result = json.loads(grade_answers(
                [{"question": "נכון?", "answer": "כן"}],
                ["כן"],
                "yesno"
            ))
        assert result["score"] == 1

    def test_grade_multiple_choice(self):
        from engine import grade_answers
        expected = {
            "score": 0,
            "feedback": [{"question": "מה?", "points": 0, "correct": False,
                          "explanation": "שגוי", "covered_points": [], "missed_points": []}]
        }
        with patch("engine.client") as mock_client:
            mock_client.chat.completions.create.return_value = self._mock_response(expected)
            result = json.loads(grade_answers(
                [{"question": "מה?", "answer": "א", "options": {"א": "נ", "ב": "ל"}}],
                ["ב"],
                "multiple"
            ))
        assert result["score"] == 0

    def test_grade_partial_credit(self):
        from engine import grade_answers
        expected = {
            "score": 0.5,
            "feedback": [{"question": "שאלה?", "points": 0.5, "correct": False,
                          "explanation": "חלקי", "covered_points": ["נקודה 1"], "missed_points": ["נקודה 2"]}]
        }
        with patch("engine.client") as mock_client:
            mock_client.chat.completions.create.return_value = self._mock_response(expected)
            result = json.loads(grade_answers(
                [{"question": "שאלה?", "answer": "תשובה", "critical_points": ["נקודה 1", "נקודה 2"]}],
                ["תשובה חלקית"],
                "open"
            ))
        assert result["score"] == 0.5
        assert result["feedback"][0]["points"] == 0.5