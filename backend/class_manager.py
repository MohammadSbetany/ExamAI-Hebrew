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
from datetime import datetime, timezone
from firebase_admin import firestore


def _db():
    return firestore.client()


def _now():
    return datetime.now(timezone.utc).isoformat()


def _code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


# ── Classes ───────────────────────────────────────────────────────────────────

def create_class(teacher_uid: str, name: str) -> dict:
    class_id = str(uuid.uuid4())
    code = _code()
    data = {
        "id": class_id,
        "teacher_uid": teacher_uid,
        "name": name,
        "code": code,
        "students": [],
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
    _db().collection("classes").document(class_id).delete()


def regenerate_code(teacher_uid: str, class_id: str) -> str:
    cls = get_class(class_id)
    if not cls or cls["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    code = _code()
    _db().collection("classes").document(class_id).update({"code": code})
    return code


def add_student_to_class(class_id: str, student_uid: str, student_name: str, student_email: str) -> None:
    cls = _db().collection("classes").document(class_id).get()
    if not cls.exists:
        raise ValueError("כיתה לא נמצאה")
    students = cls.to_dict().get("students", [])
    if any(s["uid"] == student_uid for s in students):
        return  # Already enrolled
    students.append({"uid": student_uid, "name": student_name, "email": student_email, "joined_at": _now()})
    _db().collection("classes").document(class_id).update({"students": students})


def remove_student_from_class(teacher_uid: str, class_id: str, student_uid: str) -> None:
    cls = get_class(class_id)
    if not cls or cls["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    students = [s for s in cls.get("students", []) if s["uid"] != student_uid]
    _db().collection("classes").document(class_id).update({"students": students})


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
        if pattern in lower:
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


def update_exam_questions(teacher_uid: str, exam_id: str, questions: list) -> None:
    exam = get_class_exam(exam_id)
    if not exam or exam["teacher_uid"] != teacher_uid:
        raise PermissionError("אין הרשאה")
    _db().collection("class_exams").document(exam_id).update({"questions": questions})


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
    _db().collection("class_exams").document(exam_id).delete()


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
    # Check open/close
    now = _now()
    if exam.get("open_at") and now < exam["open_at"]:
        return {"error": "הבחינה טרם נפתחה"}
    if exam.get("close_at") and now > exam["close_at"]:
        return {"error": "הבחינה נסגרה"}
    if not exam.get("visible", True):
        return {"error": "הבחינה אינה זמינה"}
    variant_idx = exam.get("assignments", {}).get(student_uid, 0)
    variants = exam.get("variants", {})
    questions = variants.get(str(variant_idx), exam.get("questions", []))
    return {
        "exam_id": exam_id,
        "title": exam["title"],
        "questions": questions,
        "question_type": exam.get("question_type", "open"),
    }


def submit_class_exam(exam_id: str, student_uid: str, student_name: str, answers: list) -> None:
    _db().collection("class_results").document(exam_id).collection("submissions").document(student_uid).set({
        "student_uid": student_uid,
        "student_name": student_name,
        "answers": answers,
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