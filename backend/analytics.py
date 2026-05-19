"""
analytics.py — Statistical processing for teacher analytics dashboard.

Firestore structure:
  shared_exams/{exam_id}          — teacher-shared exam
  shared_results/{exam_id}/submissions/{student_uid} — student result
"""

from firebase_admin import firestore
from openai import OpenAI
import os
import statistics
import json


def _db():
    return firestore.client()


def _get_client():
    return OpenAI(
        api_key=os.environ.get("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1",
        timeout=90.0,
    )


# ── Shared exam CRUD ──────────────────────────────────────────────────────────

def share_exam(teacher_uid: str, exam: dict) -> str:
    """Share an exam so students can take it. Returns the shared exam ID."""
    import uuid
    from datetime import datetime, timezone

    exam_id = str(uuid.uuid4())
    _db().collection("shared_exams").document(exam_id).set({
        "id": exam_id,
        "teacher_uid": teacher_uid,
        "title": exam.get("title", "בחינה"),
        "question_type": exam.get("question_type", "open"),
        "questions": exam.get("questions", []),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return exam_id


def list_shared_exams(teacher_uid: str) -> list:
    """List all exams shared by this teacher."""
    docs = (
        _db().collection("shared_exams")
        .where(filter=firestore.FieldFilter("teacher_uid", "==", teacher_uid))
        .stream()
    )
    results = [d.to_dict() for d in docs]
    return sorted(results, key=lambda x: x.get("created_at", ""), reverse=True)


def submit_student_result(exam_id: str, student_uid: str, student_name: str, answers: list, grade_result: dict) -> None:
    """Save a student's submission under the shared exam."""
    from datetime import datetime, timezone

    _db().collection("shared_results").document(exam_id).collection("submissions").document(student_uid).set({
        "student_uid": student_uid,
        "student_name": student_name,
        "answers": answers,
        "grade_result": grade_result,
        "score": grade_result.get("score"),
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    })


# ── Analytics ─────────────────────────────────────────────────────────────────

def compute_analytics(exam_id: str, teacher_uid: str) -> dict:
    """
    Pull all student submissions for a shared exam and compute:
    - score distribution (mean, median, std)
    - per-question success rate
    - distractor analysis for multiple choice
    - student table
    """
    # Verify this exam belongs to the teacher
    exam_doc = _db().collection("shared_exams").document(exam_id).get()
    if not exam_doc.exists:
        return {"error": "הבחינה לא נמצאה"}

    exam = exam_doc.to_dict()
    if exam.get("teacher_uid") != teacher_uid:
        return {"error": "אין הרשאה"}

    questions = exam.get("questions", [])
    total_questions = len(questions)

    # Fetch all submissions
    submissions_docs = (
        _db().collection("shared_results")
        .document(exam_id)
        .collection("submissions")
        .stream()
    )
    submissions = [d.to_dict() for d in submissions_docs]

    if not submissions:
        return {
            "exam": exam,
            "student_count": 0,
            "submissions": [],
            "score_stats": None,
            "question_stats": [],
            "distractor_analysis": [],
            "grade_distribution": [],
            "ai_recommendations": None,
        }

    # ── Score statistics ──────────────────────────────────────────────────────
    scores = [s.get("score", 0) for s in submissions]
    pcts = [round((s / total_questions) * 100) if total_questions else 0 for s in scores]

    score_stats = {
        "mean": round(statistics.mean(pcts), 1),
        "median": round(statistics.median(pcts), 1),
        "std": round(statistics.stdev(pcts), 1) if len(pcts) > 1 else 0,
        "min": min(pcts),
        "max": max(pcts),
        "count": len(submissions),
    }

    # ── Grade distribution (brackets) ─────────────────────────────────────────
    brackets = [
        {"label": "0–49", "min": 0, "max": 49, "count": 0},
        {"label": "50–64", "min": 50, "max": 64, "count": 0},
        {"label": "65–74", "min": 65, "max": 74, "count": 0},
        {"label": "75–84", "min": 75, "max": 84, "count": 0},
        {"label": "85–94", "min": 85, "max": 94, "count": 0},
        {"label": "95–100", "min": 95, "max": 100, "count": 0},
    ]
    for pct in pcts:
        for b in brackets:
            if b["min"] <= pct <= b["max"]:
                b["count"] += 1
                break

    # ── Per-question success rate ──────────────────────────────────────────────
    question_stats = []
    for qi, q in enumerate(questions):
        feedbacks = [
            s.get("grade_result", {}).get("feedback", [])[qi]
            for s in submissions
            if len(s.get("grade_result", {}).get("feedback", [])) > qi
        ]
        if not feedbacks:
            question_stats.append({
                "index": qi,
                "question": q.get("question", ""),
                "success_rate": 0,
                "avg_points": 0,
                "answered_count": 0,
            })
            continue

        pts = [f.get("points", 0) for f in feedbacks]
        success_rate = round((sum(1 for p in pts if p == 1) / len(pts)) * 100)

        question_stats.append({
            "index": qi,
            "question": q.get("question", ""),
            "success_rate": success_rate,
            "avg_points": round(statistics.mean(pts), 2),
            "answered_count": len(feedbacks),
        })

    # ── Distractor analysis (multiple choice only) ────────────────────────────
    distractor_analysis = []
    q_type = exam.get("question_type", "open")
    if q_type in ("multiple", "merged"):
        for qi, q in enumerate(questions):
            effective_type = q.get("type", q_type) if q_type == "merged" else q_type
            if effective_type != "multiple":
                continue
            correct_answer = q.get("answer", "")
            options = q.get("options", {})
            answer_counts: dict = {k: 0 for k in options}
            for s in submissions:
                answers = s.get("answers", [])
                if qi < len(answers):
                    chosen = answers[qi]
                    if chosen in answer_counts:
                        answer_counts[chosen] += 1
            distractor_analysis.append({
                "index": qi,
                "question": q.get("question", ""),
                "correct_answer": correct_answer,
                "options": options,
                "answer_counts": answer_counts,
                "total_answers": len(submissions),
            })

    # ── AI teaching recommendations ───────────────────────────────────────────
    worst_questions = sorted(question_stats, key=lambda x: x["success_rate"])[:3]
    worst_summary = "\n".join([
        f"- שאלה {q['index'] + 1}: \"{q['question'][:80]}\" — {q['success_rate']}% הצלחה"
        for q in worst_questions
    ])

    rec_prompt = f"""
You are an expert educational data analyst. Based on the following class exam results, generate 3 specific, actionable teaching recommendations in Hebrew.

Exam: "{exam.get('title', '')}"
Students: {len(submissions)}
Class average: {score_stats['mean']}%
Standard deviation: {score_stats['std']}%

Weakest questions (lowest success rate):
{worst_summary}

Generate exactly 3 recommendations, each as a JSON object with:
- "priority": "high" | "medium" | "low"
- "title": short Hebrew title
- "description": 1-2 sentences in Hebrew explaining what to do

Return a JSON object with key "recommendations" containing the array.
"""
    try:
        rec_response = _get_client().chat.completions.create(
            model="openai/gpt-5.4-mini",
            messages=[
                {"role": "system", "content": "You are an expert educator. Respond with valid JSON only."},
                {"role": "user", "content": rec_prompt},
            ],
            max_tokens=1024,
            response_format={"type": "json_object"},
        )
        ai_recommendations = json.loads(rec_response.choices[0].message.content).get("recommendations", [])
    except Exception:
        ai_recommendations = []

    return {
        "exam": exam,
        "student_count": len(submissions),
        "submissions": [
            {
                "student_uid": s.get("student_uid"),
                "student_name": s.get("student_name", "תלמיד"),
                "score": s.get("score"),
                "pct": round((s.get("score", 0) / total_questions) * 100) if total_questions else 0,
                "submitted_at": s.get("submitted_at"),
            }
            for s in submissions
        ],
        "score_stats": score_stats,
        "question_stats": question_stats,
        "distractor_analysis": distractor_analysis,
        "grade_distribution": brackets,
        "ai_recommendations": ai_recommendations,
    }

# ── Class-wide analytics ──────────────────────────────────────────────────────

def compute_class_analytics(class_id: str, teacher_uid: str) -> dict:
    """
    Aggregate analytics across ALL exams for a class.
    Returns chronological trend, per-exam summary matrix,
    and comparative metrics (highest failure rate, highest std).
    """
    # Verify class belongs to teacher
    cls_doc = _db().collection("classes").document(class_id).get()
    if not cls_doc.exists:
        return {"error": "הכיתה לא נמצאה"}
    cls = cls_doc.to_dict()
    if cls.get("teacher_uid") != teacher_uid:
        return {"error": "אין הרשאה"}

    # Get all class exams
    exams_docs = _db().collection("class_exams").where(
        filter=firestore.FieldFilter("class_id", "==", class_id)
    ).stream()
    exams = [d.to_dict() for d in exams_docs if d.to_dict().get("teacher_uid") == teacher_uid]
    exams = sorted(exams, key=lambda x: x.get("created_at", ""))

    if not exams:
        return {
            "class": {"id": class_id, "name": cls.get("name", "")},
            "exams_summary": [],
            "trend": [],
            "comparative": None,
        }

    exams_summary = []
    trend = []

    for exam in exams:
        exam_id = exam.get("id")
        questions = exam.get("questions", [])
        total_q = len(questions)

        # Fetch submissions (summary only — no full text)
        submissions_docs = (
            _db()
            .collection("class_results")
            .document(exam_id)
            .collection("submissions")
            .select(["score"])
            .stream()
        )
        submissions = [d.to_dict() for d in submissions_docs]

        if total_q == 0:
            exams_summary.append({
                "exam_id": exam_id,
                "title": exam.get("title", ""),
                "created_at": exam.get("created_at", ""),
                "total_submissions": len(submissions),
                "graded_count": 0,
                "avg_pct": None,
                "median_pct": None,
                "std_pct": None,
                "failure_rate": None,
                "min_pct": None,
                "max_pct": None,
            })
            trend.append({
                "exam_title": exam.get("title", ""),
                "date": exam.get("created_at", "")[:10],
                "avg": None,
                "submissions": 0,
            })
            continue

        graded = [s for s in submissions if s.get("score") is not None]
        if not graded:
            exams_summary.append({
                "exam_id": exam_id,
                "title": exam.get("title", ""),
                "created_at": exam.get("created_at", ""),
                "total_submissions": len(submissions),
                "graded_count": 0,
                "avg_pct": None,
                "median_pct": None,
                "std_pct": None,
                "failure_rate": None,
                "min_pct": None,
                "max_pct": None,
            })
            continue

        pcts = [round((s["score"] / total_q) * 100) for s in graded]
        avg = round(statistics.mean(pcts), 1)
        med = round(statistics.median(pcts), 1)
        std = round(statistics.stdev(pcts), 1) if len(pcts) > 1 else 0
        fail_rate = round(sum(1 for p in pcts if p < 50) / len(pcts) * 100, 1)

        exams_summary.append({
            "exam_id": exam_id,
            "title": exam.get("title", ""),
            "created_at": exam.get("created_at", ""),
            "total_submissions": len(submissions),
            "graded_count": len(graded),
            "avg_pct": avg,
            "median_pct": med,
            "std_pct": std,
            "failure_rate": fail_rate,
            "min_pct": min(pcts),
            "max_pct": max(pcts),
        })

        # Trend point
        trend.append({
            "exam_title": exam.get("title", ""),
            "date": exam.get("created_at", "")[:10],
            "avg": avg,
            "submissions": len(graded),
        })

    # Comparative metrics
    graded_exams = [e for e in exams_summary if e["avg_pct"] is not None]
    comparative = None
    if graded_exams:
        highest_fail = max(graded_exams, key=lambda x: x["failure_rate"] or 0)
        highest_std  = max(graded_exams, key=lambda x: x["std_pct"] or 0)
        best_avg     = max(graded_exams, key=lambda x: x["avg_pct"] if x["avg_pct"] is not None else 0)
        worst_avg    = min(graded_exams, key=lambda x: x["avg_pct"] if x["avg_pct"] is not None else 100)
        comparative = {
            "highest_failure_exam": {"title": highest_fail["title"], "rate": highest_fail["failure_rate"]},
            "highest_std_exam":     {"title": highest_std["title"],  "std":  highest_std["std_pct"]},
            "best_exam":            {"title": best_avg["title"],     "avg":  best_avg["avg_pct"]},
            "worst_exam":           {"title": worst_avg["title"],    "avg":  worst_avg["avg_pct"]},
        }

    return {
        "class": {"id": class_id, "name": cls.get("name", "")},
        "exams_summary": exams_summary,
        "trend": trend,
        "comparative": comparative,
    }


def compute_class_exam_analytics(exam_id: str, teacher_uid: str) -> dict:
    exam_doc = _db().collection("class_exams").document(exam_id).get()
    if not exam_doc.exists:
        return {"error": "בחינה לא נמצאה"}

    exam = exam_doc.to_dict()
    if exam.get("teacher_uid") != teacher_uid:
        return {"error": "אין הרשאה"}

    questions = exam.get("questions", [])
    total_q = len(questions)

    subs_docs = _db().collection("class_results").document(exam_id).collection("submissions").stream()
    submissions = [d.to_dict() for d in subs_docs]

    if total_q == 0:
        return {
            "exam": {"title": exam.get("title", ""), "question_type": exam.get("question_type", "open")},
            "student_count": len(submissions),
            "total_submissions": len(submissions),
            "graded_count": 0,
            "submissions": [],
            "score_stats": None,
            "question_stats": [],
            "distractor_analysis": [],
            "grade_distribution": [],
            "ai_recommendations": [],
        }

    graded = [s for s in submissions if s.get("score") is not None]
    pcts = [round((s["score"] / total_q) * 100) for s in graded]

    brackets = [
        {"label": "0–49", "min": 0, "max": 49, "count": 0},
        {"label": "50–64", "min": 50, "max": 64, "count": 0},
        {"label": "65–74", "min": 65, "max": 74, "count": 0},
        {"label": "75–84", "min": 75, "max": 84, "count": 0},
        {"label": "85–94", "min": 85, "max": 94, "count": 0},
        {"label": "95–100", "min": 95, "max": 100, "count": 0},
    ]
    for pct in pcts:
        for b in brackets:
            if b["min"] <= pct <= b["max"]:
                b["count"] += 1
                break

    score_stats = {
        "mean": round(statistics.mean(pcts), 1) if pcts else 0,
        "median": round(statistics.median(pcts), 1) if pcts else 0,
        "std": round(statistics.stdev(pcts), 1) if len(pcts) > 1 else 0,
        "min": min(pcts) if pcts else 0,
        "max": max(pcts) if pcts else 0,
        "count": len(graded),
    }

    question_stats = []
    for qi, q in enumerate(questions):
        feedbacks = [
            s.get("grade_result", {}).get("feedback", [])[qi]
            for s in graded
            if s.get("grade_result") and len(s["grade_result"].get("feedback", [])) > qi
        ]
        if not feedbacks:
            question_stats.append({"index": qi, "question": q.get("question", ""), "success_rate": 0, "avg_points": 0, "answered_count": 0})
            continue
        pts = [f.get("points", 0) for f in feedbacks]
        question_stats.append({
            "index": qi,
            "question": q.get("question", ""),
            "success_rate": round(sum(1 for p in pts if p == 1) / len(pts) * 100),
            "avg_points": round(statistics.mean(pts), 2),
            "answered_count": len(feedbacks),
        })

    distractor_analysis = []
    q_type = exam.get("question_type", "open")
    if q_type in ("multiple", "merged"):
        for qi, q in enumerate(questions):
            eff = q.get("type", q_type) if q_type == "merged" else q_type
            if eff != "multiple":
                continue
            options = q.get("options", {})
            counts = {k: 0 for k in options}
            for s in graded:
                ans = s.get("answers", [])
                if qi < len(ans) and ans[qi] in counts:
                    counts[ans[qi]] += 1
            distractor_analysis.append({
                "index": qi, "question": q.get("question", ""),
                "correct_answer": q.get("answer", ""),
                "options": options, "answer_counts": counts,
                "total_answers": len(graded),
            })

    return {
        "exam": {"title": exam.get("title", ""), "question_type": q_type},
        "student_count": len(submissions),
        "total_submissions": len(submissions),
        "graded_count": len(graded),
        "submissions": [
            {"student_uid": s.get("student_uid"), "student_name": s.get("student_name", "תלמיד"),
             "score": s.get("score"), "pct": round((s["score"] / total_q) * 100) if s.get("score") is not None else 0,
             "submitted_at": s.get("submitted_at", "")}
            for s in graded
        ],
        "score_stats": score_stats,
        "question_stats": question_stats,
        "distractor_analysis": distractor_analysis,
        "grade_distribution": brackets,
        "ai_recommendations": [],
    }
