"""
students_db.py — Student roster management, intervention, and exam control.

Firestore structure:
  classes/{teacher_uid}/students/{student_uid}  — roster entry
  classes/{teacher_uid}/config                  — class code
  shared_exams/{exam_id}                        — visibility, deadline
  shared_results/{exam_id}/submissions/{uid}    — student results
"""

import uuid
import string
import random
from datetime import datetime, timezone
from firebase_admin import firestore


def _db():
    return firestore.client()


def _now():
    return datetime.now(timezone.utc).isoformat()


# ── Class code ────────────────────────────────────────────────────────────────

def generate_class_code(teacher_uid: str) -> str:
    """Generate a new 6-character class code and store it."""
    code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    _db().collection("classes").document(teacher_uid).set({
        "class_code": code,
        "teacher_uid": teacher_uid,
        "updated_at": _now(),
    }, merge=True)
    return code


def get_class_config(teacher_uid: str) -> dict:
    doc = _db().collection("classes").document(teacher_uid).get()
    return doc.to_dict() if doc.exists else {}


def join_class_by_code(student_uid: str, student_name: str, student_email: str, code: str) -> str:
    """Student joins a class using the invite code. Returns teacher_uid or raises."""
    # Find teacher with this code
    docs = _db().collection("classes").where("class_code", "==", code).limit(1).stream()
    teacher_doc = next(docs, None)
    if not teacher_doc:
        raise ValueError("קוד כיתה לא תקין")

    teacher_uid = teacher_doc.id

    # Add student to roster
    _db().collection("classes").document(teacher_uid).collection("students").document(student_uid).set({
        "student_uid": student_uid,
        "student_name": student_name,
        "student_email": student_email,
        "joined_at": _now(),
        "notes": "",
    }, merge=True)

    return teacher_uid


# ── Roster ────────────────────────────────────────────────────────────────────

def get_roster(teacher_uid: str) -> list:
    docs = _db().collection("classes").document(teacher_uid).collection("students").stream()
    return [d.to_dict() for d in docs]


def remove_student(teacher_uid: str, student_uid: str) -> None:
    _db().collection("classes").document(teacher_uid).collection("students").document(student_uid).delete()


def save_note(teacher_uid: str, student_uid: str, note: str) -> None:
    _db().collection("classes").document(teacher_uid).collection("students").document(student_uid).update({
        "notes": note,
        "notes_updated_at": _now(),
    })


# ── Student history ───────────────────────────────────────────────────────────

def get_student_history(teacher_uid: str, student_uid: str) -> list:
    """Get all exam submissions for a student across all shared exams."""
    # Get all shared exams for this teacher
    exams_docs = _db().collection("shared_exams").where("teacher_uid", "==", teacher_uid).stream()
    exams = {d.id: d.to_dict() for d in exams_docs}

    history = []
    for exam_id, exam in exams.items():
        sub_doc = (
            _db().collection("shared_results")
            .document(exam_id)
            .collection("submissions")
            .document(student_uid)
            .get()
        )
        if sub_doc.exists:
            sub = sub_doc.to_dict()
            history.append({
                "exam_id": exam_id,
                "exam_title": exam.get("title", ""),
                "question_type": exam.get("question_type", ""),
                "total_questions": len(exam.get("questions", [])),
                "score": sub.get("score"),
                "submitted_at": sub.get("submitted_at"),
                "grade_result": sub.get("grade_result"),
                "answers": sub.get("answers", []),
            })

    return sorted(history, key=lambda x: x.get("submitted_at", ""), reverse=True)


# ── Attempt management ────────────────────────────────────────────────────────

def reset_attempt(teacher_uid: str, exam_id: str, student_uid: str) -> None:
    """Delete a student's submission so they can re-take the exam."""
    # Verify exam belongs to this teacher
    exam_doc = _db().collection("shared_exams").document(exam_id).get()
    if not exam_doc.exists or exam_doc.to_dict().get("teacher_uid") != teacher_uid:
        raise PermissionError("אין הרשאה")
    _db().collection("shared_results").document(exam_id).collection("submissions").document(student_uid).delete()


def override_grade(teacher_uid: str, exam_id: str, student_uid: str, new_score: float, override_note: str) -> None:
    """Override the AI grade for a student's submission."""
    exam_doc = _db().collection("shared_exams").document(exam_id).get()
    if not exam_doc.exists or exam_doc.to_dict().get("teacher_uid") != teacher_uid:
        raise PermissionError("אין הרשאה")

    sub_ref = (
        _db().collection("shared_results")
        .document(exam_id)
        .collection("submissions")
        .document(student_uid)
    )
    sub_ref.update({
        "score": new_score,
        "grade_overridden": True,
        "override_note": override_note,
        "overridden_at": _now(),
    })


# ── Exam control ──────────────────────────────────────────────────────────────

def set_exam_visibility(teacher_uid: str, exam_id: str, visible: bool) -> None:
    exam_doc = _db().collection("shared_exams").document(exam_id).get()
    if not exam_doc.exists or exam_doc.to_dict().get("teacher_uid") != teacher_uid:
        raise PermissionError("אין הרשאה")
    _db().collection("shared_exams").document(exam_id).update({"visible": visible})


def set_exam_deadline(teacher_uid: str, exam_id: str, deadline: str | None) -> None:
    exam_doc = _db().collection("shared_exams").document(exam_id).get()
    if not exam_doc.exists or exam_doc.to_dict().get("teacher_uid") != teacher_uid:
        raise PermissionError("אין הרשאה")
    _db().collection("shared_exams").document(exam_id).update({"deadline": deadline})