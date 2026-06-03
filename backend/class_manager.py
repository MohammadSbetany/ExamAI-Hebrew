"""
class_manager.py — Full classroom and exam management for teachers.

Firestore structure:
  classes/{class_id}                          — class info + roster
  class_exams/{exam_id}                       — exam with variants + schedule
  class_results/{exam_id}/submissions/{uid}  — student submissions
"""

import uuid
import random
import string
import re
from datetime import datetime, timezone
from firebase_admin import firestore


def _db():
    return firestore.client()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _generate_unique_code(exclude_class_id: str | None = None) -> str:
    classes = _db().collection("classes")
    for _ in range(30):
        candidate = _code()
        docs = classes.where(
            filter=firestore.FieldFilter("code", "==", candidate)
        ).limit(1).stream()
        existing = next(docs, None)
        if not existing or existing.id == exclude_class_id:
            return candidate
    return uuid.uuid4().hex[:6].upper()


def _sanitize_question_for_student(question: dict) -> dict:
    safe = dict(question or {})
    safe.pop("answer", None)
    options = safe.get("options")
    if isinstance(options, dict):
        cleaned_options = {}
        for key, value in options.items():
            if isinstance(value, dict):
                cleaned_value = dict(value)
                cleaned_value.pop("answer", None)
                cleaned_value.pop("correct", None)
                cleaned_value.pop("is_correct", None)
                cleaned_options[key] = cleaned_value
            else:
                cleaned_options[key] = value
        safe["options"] = cleaned_options
    return safe


def _sanitize_questions_for_student(questions: list) -> list:
    return [_sanitize_question_for_student(q) for q in (questions or [])]


def _is_student_in_class(class_doc: dict, student_uid: str) -> bool:
    return any(s.get("uid") == student_uid for s in class_doc.get("students", []))


def _ensure_assignment(exam: dict, student_uid: str) -> int:
    assignments = exam.get("assignments", {}) or {}
    if student_uid in assignments:
        return int(assignments[student_uid])
    num_variants = max(1, int(exam.get("num_variants", 1)))
    variant_idx = len(assignments) % num_variants
    assignments[student_uid] = variant_idx
    _db().collection("class_exams").document(exam["id"]).update({"assignments": assignments})
    exam["assignments"] = assignments
    return variant_idx


# ── Classes ───────────────────────────────────────────────────────────────────

def create_class(teacher_uid: str, name: str) -> dict:
    class_id = str(uuid.uuid4())
    code = _generate_unique_code()
    data = {
        "id": class_id,
        "teacher_uid": teacher_uid,
        "name": name,
        "code": code,
        "students": [],
        "student_uids": [],
        "created_at": _now(),
    }
    _db().collection("classes").document(class_id).set(data)
    return data


def get_teacher_classes(teacher_uid: str) -> list:
    try:
        docs = _db().collection("classes").where(
            filter=firestore.FieldFilter("teacher_uid", "==", teacher_uid)
        ).stream()
        return [d.to_dict() for d in docs]
    except Exception:
        return []


def get_class(class_id: str) -> dict | None:
    doc = _db().collection("classes").document(class_id).get()
    return doc.to_dict() if doc.exists else None


def delete_class(teacher_uid: str, class_id: str) -> None:
    cls = get_class(class_id)
    if not cls or cls["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    db = _db()
    exam_docs = db.collection("class_exams").where(
        filter=firestore.FieldFilter("class_id", "==", class_id)
    ).stream()
    for exam_doc in exam_docs:
        exam_id = exam_doc.id
        submissions = db.collection("class_results").document(exam_id).collection("submissions").stream()
        for sub_doc in submissions:
            sub_doc.reference.delete()
        db.collection("class_results").document(exam_id).delete()
        exam_doc.reference.delete()
    _db().collection("classes").document(class_id).delete()


def regenerate_code(teacher_uid: str, class_id: str) -> str:
    cls = get_class(class_id)
    if not cls or cls["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    code = _generate_unique_code(class_id)
    _db().collection("classes").document(class_id).update({"code": code})
    return code


def add_student_to_class(class_id: str, student_uid: str, student_name: str, student_email: str) -> None:
    cls = _db().collection("classes").document(class_id).get()
    if not cls.exists:
        raise ValueError("כיתה לא נמצאה")
    cls_data = cls.to_dict()
    students = cls_data.get("students", [])
    if any(s["uid"] == student_uid for s in students):
        return  # Already enrolled
    students.append({"uid": student_uid, "name": student_name, "email": student_email, "joined_at": _now()})
    student_uids = cls_data.get("student_uids", [])
    if student_uid not in student_uids:
        student_uids.append(student_uid)
    _db().collection("classes").document(class_id).update({"students": students, "student_uids": student_uids})


def remove_student_from_class(teacher_uid: str, class_id: str, student_uid: str) -> None:
    cls = get_class(class_id)
    if not cls or cls["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    students = [s for s in cls.get("students", []) if s["uid"] != student_uid]
    student_uids = [uid for uid in cls.get("student_uids", []) if uid != student_uid]
    db = _db()
    db.collection("classes").document(class_id).update({"students": students, "student_uids": student_uids})
    exam_docs = db.collection("class_exams").where(
        filter=firestore.FieldFilter("class_id", "==", class_id)
    ).stream()
    for exam_doc in exam_docs:
        exam_data = exam_doc.to_dict()
        assignments = exam_data.get("assignments", {}) or {}
        if student_uid in assignments:
            assignments.pop(student_uid, None)
            exam_doc.reference.update({"assignments": assignments})
        db.collection("class_results").document(exam_doc.id).collection("submissions").document(student_uid).delete()


def join_class_by_code(code: str, student_uid: str, student_name: str, student_email: str) -> dict:
    docs = _db().collection("classes").where(
        filter=firestore.FieldFilter("code", "==", code.upper())
    ).limit(1).stream()
    cls_doc = next(docs, None)
    if not cls_doc:
        raise ValueError("קוד כיתה לא תקין")
    cls = cls_doc.to_dict()
    add_student_to_class(cls["id"], student_uid, student_name, student_email)
    return cls


# ── Class Exams ───────────────────────────────────────────────────────────────

_FORBIDDEN_PATTERNS = [
    "ignore", "forget", "disregard", "override", "bypass", "pretend",
    "act as", "you are now", "new instruction", "system prompt",
    "התעלם", "שכח", "עקוף", "תהיה", "אתה עכשיו", "הוראה חדשה",
    "jailbreak", "dan", "developer mode", "sudo",
]

def _validate_comment(comment: str) -> tuple[bool, str]:
    """
    Validate teacher comment — must be about exam subject only.
    Returns (is_valid, reason).
    """
    if not comment or not comment.strip():
        return True, ""
    
    lower = comment.lower()
    
    # Block prompt injection attempts
    for pattern in _FORBIDDEN_PATTERNS:
        expr = rf"(?<![\w\u0590-\u05FF]){re.escape(pattern)}(?![\w\u0590-\u05FF])"
        if re.search(expr, lower):
            return False, f"ההוראה מכילה תוכן לא מורשה: '{pattern}'. ניתן לכתוב הוראות הקשורות לנושא הבחינה בלבד."
    
    # Block if comment is too long (possible injection)
    if len(comment) > 500:
        return False, "ההוראה ארוכה מדי. מקסימום 500 תווים."
    
    # Block if comment contains code-like content
    code_indicators = ["```", "<script", "SELECT ", "DROP TABLE", "eval(", "exec("]
    for indicator in code_indicators:
        if indicator.lower() in lower:
            return False, "ההוראה מכילה תוכן לא מורשה."
    
    return True, ""

def create_class_exam(
    teacher_uid: str,
    class_id: str,
    title: str,
    questions: list,
    num_variants: int = 1,
    assignments = None,
    open_at: str | None = None,
    close_at: str | None = None,
    comment = None,
) -> dict:
    """
    Create an exam for a class.
    - num_variants: how many different exam variants (1 = same for everyone)
    - assignments: explicit mapping of student → variant, or None for random
    """
    cls = get_class(class_id)
    if not cls or cls["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    
    # Validate comment
    if comment:
        is_valid, reason = _validate_comment(comment)
        if not is_valid:
            raise ValueError(reason)

    students = cls.get("students", [])
    exam_id = str(uuid.uuid4())

    # Clamp variants
    num_variants = max(1, min(num_variants, 10))
    # Build variants by shuffling questions
    # Build variants as a dict (Firestore doesn't support nested arrays)
    variants = {}
    for vi in range(num_variants):
        shuffled = questions.copy()
        random.shuffle(shuffled)
        variants[str(vi)] = shuffled

    # Build assignments
    if not assignments:
        final_assignments = {}
        for i, s in enumerate(students):
            final_assignments[s["uid"]] = i % num_variants
    else:
        final_assignments = assignments

    data = {
        "id": exam_id,
        "class_id": class_id,
        "teacher_uid": teacher_uid,
        "title": title,
        "questions": questions,       # master question list (editable)
        "variants": variants,         # per-variant shuffled lists
        "assignments": final_assignments,
        "num_variants": num_variants,
        "open_at": open_at,
        "close_at": close_at,
        "visible": True,
        "created_at": _now(),
        "question_type": "open",
        "teacher_comment": comment or "",
    }
    _db().collection("class_exams").document(exam_id).set(data)
    return data


def get_class_exams(teacher_uid: str, class_id: str) -> list:
    docs = _db().collection("class_exams").where(
        filter=firestore.FieldFilter("class_id", "==", class_id)
    ).stream()
    exams = [d.to_dict() for d in docs if d.to_dict().get("teacher_uid") == teacher_uid]
    return sorted(exams, key=lambda x: x.get("created_at", ""), reverse=True)


def get_class_exam(exam_id: str) -> dict | None:
    doc = _db().collection("class_exams").document(exam_id).get()
    return doc.to_dict() if doc.exists else None


def update_exam_questions(teacher_uid: str, exam_id: str, questions: list, question_type: str | None = None) -> None:
    exam = get_class_exam(exam_id)
    if not exam or exam["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    num_variants = max(1, min(int(exam.get("num_variants", 1)), 10))

    # Rebuild all variant shuffles from the new question list
    variants = {}
    for vi in range(num_variants):
        shuffled = questions.copy()
        random.shuffle(shuffled)
        variants[str(vi)] = shuffled

    # Rebuild assignments so students are spread across variants evenly
    # (important when questions are added after exam creation with num_variants > 1)
    cls_doc = _db().collection("classes").document(exam.get("class_id", "")).get()
    students = cls_doc.to_dict().get("students", []) if cls_doc.exists else []
    assignments = {s["uid"]: i % num_variants for i, s in enumerate(students)}

    update_data = {
        "questions": questions,
        "variants": variants,
        "assignments": assignments,
    }
    if question_type:
        update_data["question_type"] = question_type
    _db().collection("class_exams").document(exam_id).update(update_data)


def update_exam_schedule(teacher_uid: str, exam_id: str, open_at: str | None, close_at: str | None, visible: bool) -> None:
    exam = get_class_exam(exam_id)
    if not exam or exam["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    _db().collection("class_exams").document(exam_id).update({
        "open_at": open_at, "close_at": close_at, "visible": visible
    })


def delete_class_exam(teacher_uid: str, exam_id: str) -> None:
    exam = get_class_exam(exam_id)
    if not exam or exam["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    db = _db()
    submissions = db.collection("class_results").document(exam_id).collection("submissions").stream()
    for sub in submissions:
        sub.reference.delete()
    db.collection("class_results").document(exam_id).delete()
    db.collection("class_exams").document(exam_id).delete()


def add_question(teacher_uid: str, exam_id: str, question: dict) -> None:
    exam = get_class_exam(exam_id)
    if not exam or exam["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    questions = exam.get("questions", [])
    questions.append(question)
    _db().collection("class_exams").document(exam_id).update({"questions": questions})


def delete_question(teacher_uid: str, exam_id: str, question_index: int) -> None:
    exam = get_class_exam(exam_id)
    if not exam or exam["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    questions = exam.get("questions", [])
    if 0 <= question_index < len(questions):
        questions.pop(question_index)
    _db().collection("class_exams").document(exam_id).update({"questions": questions})


# ── Student submissions ───────────────────────────────────────────────────────

def get_student_exam(exam_id: str, student_uid: str) -> dict | None:
    """Get the exam variant assigned to this student."""
    exam = get_class_exam(exam_id)
    if not exam:
        return None
    cls = get_class(exam.get("class_id", ""))
    if not cls or not _is_student_in_class(cls, student_uid):
        return {"error": "אינך רשום לכיתה זו"}
    if not exam.get("visible", True):
        return {"error": "הבחינה אינה זמינה"}
    # Check open/close
    now = datetime.now(timezone.utc)
    open_at = _parse_iso(exam.get("open_at"))
    close_at = _parse_iso(exam.get("close_at"))
    if open_at and now < open_at:
        return {"error": "הבחינה טרם נפתחה"}
    if close_at and now > close_at:
        return {"error": "הבחינה נסגרה"}
    variant_idx = _ensure_assignment(exam, student_uid)
    variants = exam.get("variants", {})
    questions = variants.get(str(variant_idx), exam.get("questions", []))
    return {
        "exam_id": exam_id,
        "title": exam["title"],
        "questions": _sanitize_questions_for_student(questions),
        "question_type": exam.get("question_type", "open"),
    }


def submit_class_exam(
    exam_id: str,
    student_uid: str,
    student_name: str,
    answers: list,
    variant_idx: int | None = None,
) -> None:
    _db().collection("class_results").document(exam_id).collection("submissions").document(student_uid).set({
        "student_uid": student_uid,
        "student_name": student_name,
        "answers": answers,
        "variant_idx": variant_idx,
        "grade_result": None,
        "graded_by": None,
        "grade_overrides": {},
        "submitted_at": _now(),
    })


def get_all_submissions(teacher_uid: str, exam_id: str) -> list:
    exam = get_class_exam(exam_id)
    if not exam or exam["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    docs = _db().collection("class_results").document(exam_id).collection("submissions").stream()
    return [d.to_dict() for d in docs]


def save_grade_result(teacher_uid: str, exam_id: str, student_uid: str, grade_result: dict, graded_by: str = "ai") -> None:
    exam = get_class_exam(exam_id)
    if not exam or exam["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    _db().collection("class_results").document(exam_id).collection("submissions").document(student_uid).update({
        "grade_result": grade_result,
        "graded_by": graded_by,
        "score": grade_result.get("score"),
        "graded_at": _now(),
    })


def override_question_grade(
    teacher_uid: str, exam_id: str, student_uid: str,
    question_index: int, new_points: float, note: str
) -> None:
    exam = get_class_exam(exam_id)
    if not exam or exam["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    sub_ref = _db().collection("class_results").document(exam_id).collection("submissions").document(student_uid)
    sub = sub_ref.get().to_dict()
    if not sub:
        raise ValueError("הגשה לא נמצאה")

    # Update feedback for this question
    grade_result = sub.get("grade_result", {})
    feedback = grade_result.get("feedback", [])
    if question_index < len(feedback):
        feedback[question_index]["points"] = new_points
        feedback[question_index]["correct"] = new_points == 1
        feedback[question_index]["override_note"] = note

    new_score = sum(f.get("points", 0) for f in feedback)
    grade_result["feedback"] = feedback
    grade_result["score"] = new_score

    overrides = sub.get("grade_overrides", {})
    overrides[str(question_index)] = {"points": new_points, "note": note}

    sub_ref.update({
        "grade_result": grade_result,
        "score": new_score,
        "grade_overrides": overrides,
        "override_at": _now(),
    })
    if new_points not in (0, 0.5, 1):
        raise ValueError("ניקוד לא חוקי")
