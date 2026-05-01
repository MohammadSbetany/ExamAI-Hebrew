from exams_db import save_exam, list_exams, get_exam, delete_exam
from pydantic import BaseModel
from flashcards import generate_flashcards
import os
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from typing import List
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from firebase_auth import verify_token
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