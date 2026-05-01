"""
exams_db.py — Firestore persistence layer for saved exams.

Collection structure:
  exams/{uid}/records/{exam_id}
    - id: str
    - uid: str
    - title: str
    - exam_type: "generated" | "digitized"
    - question_type: str
    - questions: list
    - answers: list | None
    - grade_result: dict | None
    - score: float | None
    - total: int
    - created_at: ISO timestamp
    - graded_at: ISO timestamp | None
"""

from datetime import datetime, timezone
import uuid
from firebase_admin import firestore

def _get_db():
    return firestore.client()


def _col(uid: str):
    return _get_db().collection("exams").document(uid).collection("records")


def save_exam(
    uid: str,
    title: str,
    exam_type: str,
    question_type: str,
    questions: list,
    answers: list | None = None,
    grade_result: dict | None = None,
) -> dict:
    exam_id = str(uuid.uuid4())
    score = grade_result.get("score") if grade_result else None
    now = datetime.now(timezone.utc).isoformat()

    record = {
        "id": exam_id,
        "uid": uid,
        "title": title,
        "exam_type": exam_type,          # "generated" | "digitized"
        "question_type": question_type,
        "questions": questions,
        "answers": answers or [],
        "grade_result": grade_result,
        "score": score,
        "total": len(questions),
        "created_at": now,
        "graded_at": now if grade_result else None,
    }

    _col(uid).document(exam_id).set(record)
    return record


def list_exams(uid: str) -> list:
    docs = (
        _col(uid)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(100)
        .stream()
    )
    return [d.to_dict() for d in docs]


def get_exam(uid: str, exam_id: str) -> dict | None:
    doc = _col(uid).document(exam_id).get()
    return doc.to_dict() if doc.exists else None


def delete_exam(uid: str, exam_id: str) -> bool:
    ref = _col(uid).document(exam_id)
    if not ref.get().exists:
        return False
    ref.delete()
    return True