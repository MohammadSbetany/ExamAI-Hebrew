import os
import logging
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from firebase_auth import verify_token
import json
from engine import generate_questions, grade_answers

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
MAX_UPLOAD_BYTES   = 10 * 1024 * 1024   # 10 MB
MAX_QUESTION_COUNT = 50
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "pptx"}

# ── Health endpoint ───────────────────────────────────────────────────────────
@app.get("/health")
def health():
    return {"status": "ok"}

# ── Upload ────────────────────────────────────────────────────────────────────
@app.post("/upload")
@limiter.limit("10/minute")
async def upload_pdf(
    request: Request,
    file: UploadFile = File(...),
    question_type: str = Form("open"),
    question_count: int = Form(5),
    difficulty: str = Form("medium"),
    user=Depends(verify_token),
):
    if question_type not in ("open", "yesno", "multiple"):
        raise HTTPException(status_code=400, detail="סוג שאלה לא חוקי")
    if not (1 <= question_count <= MAX_QUESTION_COUNT):
        raise HTTPException(status_code=400, detail=f"מספר השאלות חייב להיות בין 1 ל-{MAX_QUESTION_COUNT}")
    if difficulty not in ("easy", "medium", "hard"):
        raise HTTPException(status_code=400, detail="רמת קושי לא חוקית")

    ext = (file.filename or "").lower().split(".")[-1]
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="סוג קובץ לא נתמך. מותר: PDF, DOCX, TXT, PPTX")

    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="הקובץ גדול מדי. גודל מקסימלי: 10MB")

    try:
        logger.info("Generating questions | user=%s type=%s count=%d", user.get("uid"), question_type, question_count)
        result_json_string = generate_questions(content, file.filename, question_type, question_count, difficulty)
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