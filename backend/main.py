from exams_db import save_exam, list_exams, get_exam, delete_exam
from pydantic import BaseModel
from flashcards import generate_flashcards
import os
import logging
from analytics import share_exam, list_shared_exams, submit_student_result, compute_analytics
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from firebase_auth import verify_token
from students_db import (
    generate_class_code, get_class_config, join_class_by_code,
    get_roster, remove_student, save_note,
    get_student_history, reset_attempt, override_grade,
    set_exam_visibility, set_exam_deadline,
)
import json
from engine import generate_questions, grade_answers, extract_text_from_file
from digitize import digitize_exam

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("examai")

# ── Rate limiter ──────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)
app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS — origins from environment ──────────────────────────────────────────
_raw_origins = os.environ.get(
    "ALLOWED_ORIGINS",
    "http://localhost:5173,http://localhost:3000,http://localhost:8080"
)
allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Constants ─────────────────────────────────────────────────────────────────
MAX_UPLOAD_BYTES   = 10 * 1024 * 1024   # 10 MB per file
MAX_QUESTION_COUNT = 100
MAX_FILES          = 5
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "pptx", "jpg", "jpeg", "png"}

# ── Health endpoint ───────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}

# ── Dashboard summary ─────────────────────────────────────────────────────────
@app.get("/dashboard/summary")
async def dashboard_summary(user=Depends(verify_token)):
    from firebase_admin import firestore as fs
    db = fs.client()
    uid = user.get("uid")

    # Get user's saved exams (last 5)
    try:
        exams_docs = (
            db.collection("exams").document(uid).collection("records")
            .order_by("created_at", direction=fs.Query.DESCENDING)
            .limit(5)
            .stream()
        )
        recent_exams = [d.to_dict() for d in exams_docs]
    except Exception:
        recent_exams = []

    # Teacher-specific: class overview
    teacher_data = None
    if user.get("role") == "teacher" or True:  # role comes from Firestore, not token — compute both
        try:
            shared_docs = (
                db.collection("shared_exams")
                .where("teacher_uid", "==", uid)
                .stream()
            )
            shared_exams = [d.to_dict() for d in shared_docs]
            exam_ids = [e["id"] for e in shared_exams]

            total_students = len(
                db.collection("classes").document(uid).collection("students").stream()
                .__class__.__mro__  # just check existence
            ) if False else sum(1 for _ in db.collection("classes").document(uid).collection("students").stream())

            # Get recent submissions across all shared exams
            all_submissions = []
            for exam_id in exam_ids[:5]:
                subs = db.collection("shared_results").document(exam_id).collection("submissions").stream()
                all_submissions.extend([s.to_dict() for s in subs])

            scores = [s.get("score", 0) for s in all_submissions if s.get("score") is not None]
            total_q_map = {e["id"]: len(e.get("questions", [])) for e in shared_exams}

            pcts = []
            for s in all_submissions:
                exam_id = None
                for eid in exam_ids:
                    sub_doc = db.collection("shared_results").document(eid).collection("submissions").document(s.get("student_uid", "")).get()
                    if sub_doc.exists:
                        score = sub_doc.to_dict().get("score", 0)
                        total = total_q_map.get(eid, 1)
                        pcts.append(round((score / total) * 100) if total else 0)
                        break

            struggling = [
                s for s in all_submissions
                if s.get("score") is not None and
                len(total_q_map) > 0 and
                any(round((s.get("score", 0) / total_q_map.get(eid, 1)) * 100) < 60
                    for eid in exam_ids if total_q_map.get(eid))
            ]

            teacher_data = {
                "total_students": total_students,
                "active_exams": len(shared_exams),
                "class_average": round(sum(pcts) / len(pcts), 1) if pcts else None,
                "recent_submissions": len(all_submissions),
                "struggling_count": len(struggling),
            }
        except Exception:
            teacher_data = {
                "total_students": 0, "active_exams": 0,
                "class_average": None, "recent_submissions": 0, "struggling_count": 0,
            }

    return {
        "recent_exams": recent_exams,
        "teacher_data": teacher_data,
    }

# ── Digitize ──────────────────────────────────────────────────────────────────
@app.post("/digitize")
@limiter.limit("10/minute")
async def digitize(
    request: Request,
    files: List[UploadFile] = File(...),
    user=Depends(verify_token),
):

    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"ניתן להעלות עד {MAX_FILES} קבצים בו-זמנית")

    all_texts = []
    for file in files:
        ext = (file.filename or "").lower().split(".")[-1]
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"סוג קובץ לא נתמך: {file.filename}")
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"הקובץ {file.filename} גדול מדי. גודל מקסימלי: 10MB")
        text = extract_text_from_file(content, file.filename)
        if text.strip():
            all_texts.append(f"[קובץ: {file.filename}]\n{text}")

    combined_text = "\n\n---\n\n".join(all_texts)

    try:
        logger.info("Digitizing exam | user=%s files=%d", user.get("uid"), len(files))
        result = digitize_exam(combined_text)
        return json.loads(result)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Digitize error | user=%s error=%s", user.get("uid"), str(e))
        raise HTTPException(status_code=500, detail="שגיאה בעיבוד קובץ הבחינה")
    

# ── Flashcards ────────────────────────────────────────────────────────────────
@app.post("/flashcards")
@limiter.limit("10/minute")
async def flashcards(
    request: Request,
    files: List[UploadFile] = File(...),
    user=Depends(verify_token),
):
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"ניתן להעלות עד {MAX_FILES} קבצים בו-זמנית")

    all_texts = []
    for file in files:
        ext = (file.filename or "").lower().split(".")[-1]
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"סוג קובץ לא נתמך: {file.filename}")
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"הקובץ {file.filename} גדול מדי.")
        text = extract_text_from_file(content, file.filename)
        if text.strip():
            all_texts.append(text)

    combined = "\n\n---\n\n".join(all_texts)

    try:
        logger.info("Generating flashcards | user=%s", user.get("uid"))
        result = generate_flashcards(combined)
        return json.loads(result)
    except Exception as e:
        logger.error("Flashcards error | user=%s error=%s", user.get("uid"), str(e))
        raise HTTPException(status_code=500, detail="שגיאה ביצירת כרטיסיות")
    
    
# ── Upload ────────────────────────────────────────────────────────────────────
@app.post("/upload")
@limiter.limit("10/minute")
async def upload_pdf(
    request: Request,
    files: List[UploadFile] = File(...),
    question_type: str = Form("open"),
    question_count: int = Form(5),
    difficulty: str = Form("medium"),
    time_mode: str = Form("ai"),
    manual_minutes: int = Form(None),
    difficulty_dist: str = Form(None),
    format_counts: str = Form(None),
    user=Depends(verify_token),
):
    if question_type not in ("open", "yesno", "multiple", "merged"):
        raise HTTPException(status_code=400, detail="סוג שאלה לא חוקי")
    if not (1 <= question_count <= MAX_QUESTION_COUNT):
        raise HTTPException(status_code=400, detail=f"מספר השאלות חייב להיות בין 1 ל-{MAX_QUESTION_COUNT}")
    if difficulty not in ("easy", "medium", "hard", "merged"):
        raise HTTPException(status_code=400, detail="רמת קושי לא חוקית")
    if len(files) > MAX_FILES:
        raise HTTPException(status_code=400, detail=f"ניתן להעלות עד {MAX_FILES} קבצים בו-זמנית")

    file_data = []
    for file in files:
        ext = (file.filename or "").lower().split(".")[-1]
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"סוג קובץ לא נתמך: {file.filename}. מותר: PDF, DOCX, TXT, PPTX, JPG, PNG")
        content = await file.read()
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"הקובץ {file.filename} גדול מדי. גודל מקסימלי: 10MB")
        file_data.append((content, file.filename))

    try:
        logger.info("Generating questions | user=%s files=%d type=%s count=%d", user.get("uid"), len(files), question_type, question_count)
        dist_parsed = json.loads(difficulty_dist) if difficulty_dist else None
        fmt_parsed = json.loads(format_counts) if format_counts else None
        result_json_string = generate_questions(
            file_data, question_type, question_count, difficulty,
            time_mode=time_mode,
            manual_minutes=manual_minutes,
            difficulty_dist=dist_parsed,
            format_counts=fmt_parsed,
        )
        return json.loads(result_json_string)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("Upload error | user=%s error=%s", user.get("uid"), str(e))
        raise HTTPException(status_code=500, detail="שגיאה בעיבוד הקובץ")
    
# ── Grade ─────────────────────────────────────────────────────────────────────
@app.post("/grade")
@limiter.limit("20/minute")
async def grade(request: Request, data: dict, user=Depends(verify_token)):
    try:
        questions     = data.get("questions", [])
        answers       = data.get("answers", [])
        question_type = data.get("question_type", "open")
        logger.info("Grading | user=%s questions=%d", user.get("uid"), len(questions))
        result = grade_answers(questions, answers, question_type)
        return json.loads(result)
    except Exception as e:
        logger.error("Grading error | user=%s error=%s", user.get("uid"), str(e))
        raise HTTPException(status_code=500, detail="שגיאה בבדיקת התשובות")
    
# ── Exams CRUD ────────────────────────────────────────────────────────────────

class SaveExamBody(BaseModel):
    title: str
    exam_type: str          # "generated" | "digitized"
    question_type: str
    questions: list
    answers: list = []
    grade_result: dict | None = None


@app.post("/exams/save")
async def save_exam_endpoint(body: SaveExamBody, user=Depends(verify_token)):
    try:
        uid = user.get("uid")
        record = save_exam(
            uid=uid,
            title=body.title,
            exam_type=body.exam_type,
            question_type=body.question_type,
            questions=body.questions,
            answers=body.answers,
            grade_result=body.grade_result,
        )
        logger.info("Exam saved | user=%s exam_id=%s", uid, record["id"])
        return {"ok": True, "exam_id": record["id"]}
    except Exception as e:
        logger.error("Save exam error | user=%s error=%s", user.get("uid"), str(e))
        raise HTTPException(status_code=500, detail="שגיאה בשמירת הבחינה")


@app.get("/exams")
async def list_exams_endpoint(user=Depends(verify_token)):
    try:
        return {"exams": list_exams(user.get("uid"))}
    except Exception as e:
        logger.error("List exams error | user=%s error=%s", user.get("uid"), str(e))
        raise HTTPException(status_code=500, detail="שגיאה בטעינת הבחינות")


@app.get("/exams/{exam_id}")
async def get_exam_endpoint(exam_id: str, user=Depends(verify_token)):
    exam = get_exam(user.get("uid"), exam_id)
    if not exam:
        raise HTTPException(status_code=404, detail="הבחינה לא נמצאה")
    return exam


@app.delete("/exams/{exam_id}")
async def delete_exam_endpoint(exam_id: str, user=Depends(verify_token)):
    deleted = delete_exam(user.get("uid"), exam_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="הבחינה לא נמצאה")
    return {"ok": True} 


# ── Teacher Analytics ─────────────────────────────────────────────────────────

class ShareExamBody(BaseModel):
    title: str
    question_type: str
    questions: list


@app.post("/teacher/share-exam")
async def share_exam_endpoint(body: ShareExamBody, user=Depends(verify_token)):
    uid = user.get("uid")
    exam_id = share_exam(uid, body.dict())
    logger.info("Exam shared | teacher=%s exam_id=%s", uid, exam_id)
    return {"ok": True, "exam_id": exam_id}


@app.get("/teacher/shared-exams")
async def list_shared_exams_endpoint(user=Depends(verify_token)):
    return {"exams": list_shared_exams(user.get("uid"))}


@app.get("/teacher/analytics/{exam_id}")
async def get_analytics(exam_id: str, user=Depends(verify_token)):
    result = compute_analytics(exam_id, user.get("uid"))
    if "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])
    return result


@app.post("/student/submit/{exam_id}")
async def submit_result(exam_id: str, data: dict, user=Depends(verify_token)):
    try:
        submit_student_result(
            exam_id=exam_id,
            student_uid=user.get("uid"),
            student_name=data.get("student_name", "תלמיד"),
            answers=data.get("answers", []),
            grade_result=data.get("grade_result", {}),
        )
        return {"ok": True}
    except Exception as e:
        logger.error("Submit result error | user=%s error=%s", user.get("uid"), str(e))
        raise HTTPException(status_code=500, detail="שגיאה בשמירת התוצאה")
    
# ── Teacher: Roster ───────────────────────────────────────────────────────────

@app.get("/teacher/class")
async def get_class(user=Depends(verify_token)):
    uid = user.get("uid")
    config = get_class_config(uid)
    roster = get_roster(uid)
    return {"class_code": config.get("class_code"), "students": roster}


@app.post("/teacher/class/generate-code")
async def gen_code(user=Depends(verify_token)):
    code = generate_class_code(user.get("uid"))
    return {"class_code": code}


@app.delete("/teacher/students/{student_uid}")
async def remove_student_endpoint(student_uid: str, user=Depends(verify_token)):
    remove_student(user.get("uid"), student_uid)
    return {"ok": True}


@app.get("/teacher/students/{student_uid}/history")
async def student_history(student_uid: str, user=Depends(verify_token)):
    history = get_student_history(user.get("uid"), student_uid)
    return {"history": history}


@app.delete("/teacher/students/{student_uid}/attempts/{exam_id}")
async def reset_attempt_endpoint(student_uid: str, exam_id: str, user=Depends(verify_token)):
    try:
        reset_attempt(user.get("uid"), exam_id, student_uid)
        return {"ok": True}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.patch("/teacher/students/{student_uid}/attempts/{exam_id}/grade")
async def override_grade_endpoint(student_uid: str, exam_id: str, data: dict, user=Depends(verify_token)):
    try:
        override_grade(user.get("uid"), exam_id, student_uid, data.get("score", 0), data.get("note", ""))
        return {"ok": True}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.post("/teacher/students/{student_uid}/notes")
async def save_note_endpoint(student_uid: str, data: dict, user=Depends(verify_token)):
    save_note(user.get("uid"), student_uid, data.get("note", ""))
    return {"ok": True}


# ── Teacher: Exam control ─────────────────────────────────────────────────────

@app.patch("/teacher/exams/{exam_id}/visibility")
async def set_visibility(exam_id: str, data: dict, user=Depends(verify_token)):
    try:
        set_exam_visibility(user.get("uid"), exam_id, data.get("visible", True))
        return {"ok": True}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@app.patch("/teacher/exams/{exam_id}/deadline")
async def set_deadline(exam_id: str, data: dict, user=Depends(verify_token)):
    try:
        set_exam_deadline(user.get("uid"), exam_id, data.get("deadline"))
        return {"ok": True}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


# ── Student: Join class ───────────────────────────────────────────────────────

@app.post("/student/join-class")
async def join_class(data: dict, user=Depends(verify_token)):
    try:
        teacher_uid = join_class_by_code(
            student_uid=user.get("uid"),
            student_name=data.get("student_name", "תלמיד"),
            student_email=user.get("email", ""),
            code=data.get("class_code", "").strip().upper(),
        )
        return {"ok": True, "teacher_uid": teacher_uid}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))    
    

# ── User Settings ─────────────────────────────────────────────────────────────
@app.get("/settings")
async def get_settings(user=Depends(verify_token)):
    from firebase_admin import firestore as fs
    db = fs.client()
    doc = db.collection("users").document(user.get("uid")).get()
    data = doc.to_dict() if doc.exists else {}
    return data.get("settings", {})

@app.patch("/settings")
async def update_settings(data: dict, user=Depends(verify_token)):
    from firebase_admin import firestore as fs
    db = fs.client()
    db.collection("users").document(user.get("uid")).set(
        {"settings": data}, merge=True
    )
    return {"ok": True}

@app.patch("/profile")
async def update_profile(data: dict, user=Depends(verify_token)):
    from firebase_admin import firestore as fs
    db = fs.client()
    allowed = {"name", "title", "department", "institution", "year_of_study", "field_of_study", "office_hours"}
    update = {k: v for k, v in data.items() if k in allowed}
    db.collection("users").document(user.get("uid")).update(update)
    return {"ok": True}
