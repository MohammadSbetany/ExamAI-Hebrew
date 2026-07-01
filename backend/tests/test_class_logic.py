"""
test_class_logic.py — unit tests for class_manager pure logic:
  ISO parsing, student-answer sanitization, roster membership,
  cursor-based form assignment, and distinct per-form variant storage.
"""
import pytest
from datetime import timezone
from unittest.mock import patch, MagicMock


@pytest.fixture(autouse=True)
def mock_firebase_init():
    with patch("firebase_admin.initialize_app"), \
         patch("firebase_admin.credentials.Certificate"), \
         patch("firebase_auth._init_firebase"):
        yield


# ── ISO parsing ───────────────────────────────────────────────────────────────

class TestParseIso:
    def test_none_and_empty_return_none(self):
        from class_manager import _parse_iso
        assert _parse_iso(None) is None
        assert _parse_iso("") is None

    def test_invalid_returns_none(self):
        from class_manager import _parse_iso
        assert _parse_iso("not-a-date") is None

    def test_z_suffix_parsed_as_utc(self):
        from class_manager import _parse_iso
        dt = _parse_iso("2026-01-01T10:00:00Z")
        assert dt is not None and dt.tzinfo is not None
        assert dt.year == 2026 and dt.month == 1

    def test_naive_datetime_becomes_utc(self):
        from class_manager import _parse_iso
        dt = _parse_iso("2026-01-01T10:00:00")
        assert dt.tzinfo == timezone.utc


# ── Sanitization (never leak answers to students) ─────────────────────────────

class TestSanitize:
    def test_removes_answer_field(self):
        from class_manager import _sanitize_question_for_student
        safe = _sanitize_question_for_student({"question": "מה?", "answer": "סוד"})
        assert "answer" not in safe
        assert safe["question"] == "מה?"

    def test_strips_correctness_flags_from_option_objects(self):
        from class_manager import _sanitize_question_for_student
        q = {"question": "?", "answer": "א",
             "options": {"א": {"text": "t", "correct": True, "is_correct": True, "answer": "y"}}}
        safe = _sanitize_question_for_student(q)
        assert safe["options"]["א"] == {"text": "t"}

    def test_plain_string_options_preserved(self):
        from class_manager import _sanitize_question_for_student
        q = {"question": "?", "answer": "א", "options": {"א": "פריז", "ב": "לונדון"}}
        assert _sanitize_question_for_student(q)["options"] == {"א": "פריז", "ב": "לונדון"}

    def test_list_sanitize_removes_all_answers(self):
        from class_manager import _sanitize_questions_for_student
        out = _sanitize_questions_for_student([{"question": "a", "answer": "1"}, {"question": "b", "answer": "2"}])
        assert len(out) == 2 and all("answer" not in q for q in out)

    def test_none_list_is_empty(self):
        from class_manager import _sanitize_questions_for_student
        assert _sanitize_questions_for_student(None) == []


# ── Roster membership ─────────────────────────────────────────────────────────

class TestRoster:
    def test_member(self):
        from class_manager import _is_student_in_class
        assert _is_student_in_class({"students": [{"uid": "a"}, {"uid": "b"}]}, "b") is True

    def test_not_member(self):
        from class_manager import _is_student_in_class
        assert _is_student_in_class({"students": [{"uid": "a"}]}, "x") is False

    def test_empty_roster(self):
        from class_manager import _is_student_in_class
        assert _is_student_in_class({}, "x") is False


# ── Cursor-based form assignment ──────────────────────────────────────────────

class TestEnsureAssignment:
    def _exam(self, **over):
        base = {"id": "exam-1", "class_id": "class-1",
                "variants": {"0": [], "1": []}, "assignments": {}, "num_variants": 2}
        base.update(over)
        return base

    def test_first_opener_gets_form_0_and_cursor_advances(self):
        from class_manager import _ensure_assignment
        exam = self._exam()
        with patch("class_manager._db"):
            assert _ensure_assignment(exam, "s1") == 0
        assert exam["assignments"]["s1"] == 0
        assert exam["variant_cursor"] == 1

    def test_second_opener_gets_form_1(self):
        from class_manager import _ensure_assignment
        exam = self._exam(assignments={"s1": 0}, variant_cursor=1)
        with patch("class_manager._db"):
            assert _ensure_assignment(exam, "s2") == 1

    def test_cursor_wraps_around_when_forms_run_out(self):
        from class_manager import _ensure_assignment
        exam = self._exam(assignments={"s1": 0, "s2": 1}, variant_cursor=2)
        with patch("class_manager._db"):
            assert _ensure_assignment(exam, "s3") == 0  # 2 % 2

    def test_existing_assignment_is_stable_and_does_not_advance(self):
        from class_manager import _ensure_assignment
        exam = self._exam(assignments={"s1": 1}, variant_cursor=5)
        with patch("class_manager._db") as db:
            assert _ensure_assignment(exam, "s1") == 1
        db.return_value.collection.return_value.document.return_value.update.assert_not_called()

    def test_divides_by_actual_form_count_not_stale_field(self):
        from class_manager import _ensure_assignment
        # stale num_variants says 1, but 3 real forms exist
        exam = self._exam(variants={"0": [], "1": [], "2": []}, num_variants=1,
                          assignments={"s1": 0, "s2": 1}, variant_cursor=2)
        with patch("class_manager._db"):
            assert _ensure_assignment(exam, "s3") == 2  # 2 % 3, not 2 % 1


# ── Distinct per-form variant storage ─────────────────────────────────────────

class TestSetExamVariants:
    def test_stores_distinct_variants_and_resets_cursor(self):
        import class_manager
        exam = {"id": "exam-1", "class_id": "class-1", "teacher_uid": "t1"}
        captured = {}
        with patch("class_manager.get_class_exam", return_value=exam), \
             patch("class_manager._db") as db:
            db.return_value.collection.return_value.document.return_value.update.side_effect = captured.update
            class_manager.set_exam_variants("t1", "exam-1", {"0": [{"q": 1}], "1": [{"q": 2}]}, "multiple")
        assert captured["num_variants"] == 2
        assert captured["question_type"] == "multiple"
        assert captured["assignments"] == {}
        assert captured["variant_cursor"] == 0
        assert captured["questions"] == [{"q": 1}]           # representative = form 0
        assert set(captured["variants"].keys()) == {"0", "1"}

    def test_normalises_keys_to_zero_based(self):
        import class_manager
        exam = {"id": "e", "class_id": "c", "teacher_uid": "t1"}
        captured = {}
        with patch("class_manager.get_class_exam", return_value=exam), \
             patch("class_manager._db") as db:
            db.return_value.collection.return_value.document.return_value.update.side_effect = captured.update
            class_manager.set_exam_variants("t1", "e", {"3": [{"q": "a"}], "7": [{"q": "b"}]})
        assert set(captured["variants"].keys()) == {"0", "1"}

    def test_wrong_teacher_raises_permission_error(self):
        import class_manager
        exam = {"id": "e", "teacher_uid": "someone-else"}
        with patch("class_manager.get_class_exam", return_value=exam), patch("class_manager._db"):
            with pytest.raises(PermissionError):
                class_manager.set_exam_variants("t1", "e", {"0": []})
