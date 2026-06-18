from exams_db import save_exam, list_exams, get_exam, delete_exam, update_exam
from pydantic import BaseModel
from flashcards import generate_flashcards
import os
import logging
from analytics import (
    share_exam,
    list_shared_exams,
    submit_student_result,
    compute_analytics,
    compute_class_analytics,
    compute_class_exam_analytics,
)
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
from class_manager import (
    create_class, get_teacher_classes, get_class, delete_class,
    regenerate_code, add_student_to_class, remove_student_from_class,
    join_class_by_code, create_class_exam, get_class_exams, get_class_exam,
    update_exam_questions, update_exam_schedule, delete_class_exam,
    add_question, delete_question, get_student_exam, submit_class_exam,
    get_all_submissions, save_grade_result, override_question_grade,
)

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

    try:
        classes_docs = db.collection("classes").where(
            filter=fs.FieldFilter("teacher_uid", "==", uid)
        ).stream()
        classes = [d.to_dict() for d in classes_docs]
        total_students = sum(len(c.get("students", [])) for c in classes)
        
        class_exams_docs = db.collection("class_exams").where(
            filter=fs.FieldFilter("teacher_uid", "==", uid)
        ).stream()
        active_exams = sum(1 for e in class_exams_docs if e.to_dict().get("visible", True))
        
        teacher_data = {
            "total_students": total_students,
            "active_exams": active_exams,
            "class_average": None,
            "recent_submissions": 0,
            "struggling_count": 0,
        }
    except Exception:
        teacher_data = {
            "total_students": 0, "active_exams": 0,
            "class_average": None, "recent_submissions": 0, "struggling_count": 0,
        }

    return {"recent_exams": recent_exams, "teacher_data": teacher_data}

# ── Classes ───────────────────────────────────────────────────────────────────

@app.post("/classes")
async def create_class_endpoint(data: dict, user=Depends(verify_token)):
    cls = create_class(user.get("uid"), data.get("name", "כיתה חדשה"))
    return cls

@app.get("/classes")
async def list_classes(user=Depends(verify_token)):
    try:
        return {"classes": get_teacher_classes(user.get("uid"))}
    except Exception as e:
        logger.error("List classes error | user=%s error=%s", user.get("uid"), str(e))
        return {"classes": []}

@app.patch("/classes/{class_id}")
async def rename_class_endpoint(class_id: str, data: dict, user=Depends(verify_token)):
    from class_manager import get_class, _db
    cls = get_class(class_id)
    if not cls or cls.get("teacher_uid") != user.get("uid"):
        raise HTTPException(status_code=403, detail="אין הרשאה")
    name = (data.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="שם הכיתה לא יכול להיות ריק")
    _db().collection("classes").document(class_id).update({"name": name})
    return {"ok": True, "name": name}

@app.delete("/classes/{class_id}")
async def delete_class_endpoint(class_id: str, user=Depends(verify_token)):
    try:
        delete_class(user.get("uid"), class_id)
        return {"ok": True}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.post("/classes/{class_id}/regenerate-code")
async def regen_code(class_id: str, user=Depends(verify_token)):
    try:
        code = regenerate_code(user.get("uid"), class_id)
        return {"code": code}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.post("/classes/{class_id}/add-student")
async def add_student_endpoint(class_id: str, data: dict, user=Depends(verify_token)):
    cls = get_class(class_id)
    if not cls or cls.get("teacher_uid") != user.get("uid"):
        raise HTTPException(status_code=403, detail="אין הרשאה")
    try:
        add_student_to_class(class_id, data["uid"], data["name"], data.get("email", ""))
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/classes/{class_id}/add-student-by-email")
async def add_student_by_email_endpoint(class_id: str, data: dict, user=Depends(verify_token)):
    """Add a registered user to a class by their email address."""
    from firebase_admin import auth as fb_auth, firestore as fs
    cls = get_class(class_id)
    if not cls or cls.get("teacher_uid") != user.get("uid"):
        raise HTTPException(status_code=403, detail="אין הרשאה")

    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=422, detail="כתובת אימייל היא שדה חובה")

    try:
        student = fb_auth.get_user_by_email(email)
    except fb_auth.UserNotFoundError:
        raise HTTPException(status_code=404, detail="לא נמצא משתמש רשום עם כתובת אימייל זו")
    except ValueError:
        raise HTTPException(status_code=422, detail="כתובת אימייל לא תקינה")

    if student.uid == user.get("uid"):
        raise HTTPException(status_code=400, detail="לא ניתן להוסיף את עצמך ככיתה")
    if any(s.get("uid") == student.uid for s in cls.get("students", [])):
        raise HTTPException(status_code=409, detail="התלמיד כבר רשום לכיתה")

    # Resolve display name: auth profile → users doc → email prefix
    name = student.display_name
    if not name:
        try:
            doc = fs.client().collection("users").document(student.uid).get()
            if doc.exists:
                name = (doc.to_dict() or {}).get("name")
        except Exception:
            name = None
    if not name:
        name = email.split("@")[0]

    student_email = student.email or email
    try:
        add_student_to_class(class_id, student.uid, name, student_email)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, "student": {"uid": student.uid, "name": name, "email": student_email}}

@app.delete("/classes/{class_id}/students/{student_uid}")
async def remove_student_endpoint(class_id: str, student_uid: str, user=Depends(verify_token)):
    try:
        remove_student_from_class(user.get("uid"), class_id, student_uid)
        return {"ok": True}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.post("/classes/join")
async def join_class_endpoint(data: dict, user=Depends(verify_token)):
    try:
        cls = join_class_by_code(
            data.get("code", ""),
            user.get("uid"),
            data.get("name", "תלמיד"),
            user.get("email", ""),
        )
        return cls
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

# ── Class Exams ───────────────────────────────────────────────────────────────

@app.post("/classes/{class_id}/exams")
async def create_exam_endpoint(class_id: str, data: dict, user=Depends(verify_token)):
    try:
        exam = create_class_exam(
            teacher_uid=user.get("uid"),
            class_id=class_id,
            title=data.get("title", "בחינה"),
            questions=data.get("questions", []),
            num_variants=data.get("num_variants", 1),
            assignments=data.get("assignments"),
            open_at=data.get("open_at"),
            close_at=data.get("close_at"),
            comment=data.get("comment"),
        )
        return exam
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.get("/classes/{class_id}/exams")
async def list_class_exams(class_id: str, user=Depends(verify_token)):
    try:
        return {"exams": get_class_exams(user.get("uid"), class_id)}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.patch("/class-exams/{exam_id}/questions")
async def update_questions_endpoint(exam_id: str, data: dict, user=Depends(verify_token)):
    try:
        update_exam_questions(
            user.get("uid"),
            exam_id,
            data.get("questions", []),
            data.get("question_type"),
        )
        return {"ok": True}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.post("/class-exams/{exam_id}/questions")
async def add_question_endpoint(exam_id: str, data: dict, user=Depends(verify_token)):
    try:
        add_question(user.get("uid"), exam_id, data.get("question", {}))
        return {"ok": True}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.delete("/class-exams/{exam_id}/questions/{question_index}")
async def delete_question_endpoint(exam_id: str, question_index: int, user=Depends(verify_token)):
    try:
        delete_question(user.get("uid"), exam_id, question_index)
        return {"ok": True}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.patch("/class-exams/{exam_id}/schedule")
async def update_schedule_endpoint(exam_id: str, data: dict, user=Depends(verify_token)):
    try:
        update_exam_schedule(
            user.get("uid"), exam_id,
            data.get("open_at"), data.get("close_at"), data.get("visible", True)
        )
        return {"ok": True}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.delete("/class-exams/{exam_id}")
async def delete_exam_endpoint(exam_id: str, user=Depends(verify_token)):
    try:
        delete_class_exam(user.get("uid"), exam_id)
        return {"ok": True}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

# ── Student endpoints ─────────────────────────────────────────────────────────

@app.get("/student/classes")
async def get_student_classes(user=Depends(verify_token)):
    from firebase_admin import firestore as fs
    db = fs.client()
    uid = user.get("uid")
    try:
        docs = db.collection("classes").where(
            filter=fs.FieldFilter("student_uids", "array_contains", uid)
        ).stream()
        classes = [d.to_dict() for d in docs]
        if not classes:
            fallback_docs = db.collection("classes").stream()
            classes = [
                d.to_dict() for d in fallback_docs
                if any(s.get("uid") == uid for s in d.to_dict().get("students", []))
            ]
        return {"classes": classes}
    except Exception as e:
        logger.error("Get student classes error | user=%s error=%s", uid, str(e))
        return {"classes": []}


def _sanitize_question_for_student(question: dict) -> dict:
    safe = dict(question or {})
    safe.pop("answer", None)
    options = safe.get("options")
    if isinstance(options, dict):
        cleaned = {}
        for key, value in options.items():
            if isinstance(value, dict):
                option = dict(value)
                option.pop("answer", None)
                option.pop("correct", None)
                option.pop("is_correct", None)
                cleaned[key] = option
            else:
                cleaned[key] = value
        safe["options"] = cleaned
    return safe


@app.get("/student/classes/{class_id}/exams")
async def get_student_class_exams(class_id: str, user=Depends(verify_token)):
    from firebase_admin import firestore as fs
    db = fs.client()
    uid = user.get("uid")
    # Verify student is in this class
    cls_doc = db.collection("classes").document(class_id).get()
    if not cls_doc.exists:
        raise HTTPException(status_code=404, detail="כיתה לא נמצאה")
    cls = cls_doc.to_dict()
    if not any(s.get("uid") == uid for s in cls.get("students", [])):
        raise HTTPException(status_code=403, detail="אינך רשום לכיתה זו")
    # Get visible exams
    docs = db.collection("class_exams").where(
        filter=fs.FieldFilter("class_id", "==", class_id)
    ).stream()
    all_exams = [d.to_dict() for d in docs]
    exams = []
    for exam in all_exams:
        submission_doc = db.collection("class_results").document(exam["id"]).collection("submissions").document(uid).get()
        submission = submission_doc.to_dict() if submission_doc.exists else None
        exams.append({
            "id": exam["id"],
            "title": exam.get("title"),
            "questions": [_sanitize_question_for_student(q) for q in exam.get("questions", [])],
            "question_type": exam.get("question_type", "open"),
            "visible": exam.get("visible", True),
            "open_at": exam.get("open_at"),
            "close_at": exam.get("close_at"),
            "created_at": exam.get("created_at"),
            "my_submission": submission,
        })
    return {"exams": sorted(exams, key=lambda x: x.get("created_at", ""), reverse=True)}

@app.get("/student/class-exam/{exam_id}")
async def get_student_exam_endpoint(exam_id: str, user=Depends(verify_token)):
    result = get_student_exam(exam_id, user.get("uid"))
    if result and "error" in result:
        raise HTTPException(status_code=403, detail=result["error"])
    if not result:
        raise HTTPException(status_code=404, detail="בחינה לא נמצאה")
    return result

@app.post("/student/class-exam/{exam_id}/submit")
async def submit_exam_endpoint(exam_id: str, data: dict, user=Depends(verify_token)):
    from firebase_admin import firestore as fs
    db = fs.client()
    access = get_student_exam(exam_id, user.get("uid"))
    if not access:
        raise HTTPException(status_code=404, detail="בחינה לא נמצאה")
    if "error" in access:
        raise HTTPException(status_code=403, detail=access["error"])
    existing = db.collection("class_results").document(exam_id).collection("submissions").document(user.get("uid")).get()
    if existing.exists:
        raise HTTPException(status_code=409, detail="כבר הגשת את הבחינה הזו")
    exam = get_class_exam(exam_id)
    variant_idx = int((exam.get("assignments") or {}).get(user.get("uid"), 0)) if exam else 0
    submit_class_exam(
        exam_id,
        user.get("uid"),
        data.get("student_name", "תלמיד"),
        data.get("answers", []),
        variant_idx=variant_idx,
    )
    return {"ok": True}

@app.get("/student/class-exam/{exam_id}/my-submission")
async def get_my_submission(exam_id: str, user=Depends(verify_token)):
    from firebase_admin import firestore as fs
    db = fs.client()
    doc = db.collection("class_results").document(exam_id).collection("submissions").document(user.get("uid")).get()
    if not doc.exists:
        return {"submitted": False}
    return {"submitted": True, "submission": doc.to_dict()}

# ── Teacher grading ───────────────────────────────────────────────────────────

@app.get("/class-exams/{exam_id}/submissions")
async def get_submissions_endpoint(exam_id: str, user=Depends(verify_token)):
    try:
        return {"submissions": get_all_submissions(user.get("uid"), exam_id)}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.post("/class-exams/{exam_id}/submissions/{student_uid}/grade-ai")
async def grade_ai_endpoint(exam_id: str, student_uid: str, user=Depends(verify_token)):
    try:
        from firebase_admin import firestore as _fs
        db = _fs.client()
        exam = get_class_exam(exam_id)
        if not exam or exam["teacher_uid"] != user.get("uid"):
            raise HTTPException(status_code=403, detail="אין הרשאה")
        docs = db.collection("class_results").document(exam_id).collection("submissions").document(student_uid).get()
        if not docs.exists:
            raise HTTPException(status_code=404, detail="הגשה לא נמצאה")
        sub = docs.to_dict()
        variant_idx = sub.get("variant_idx")
        if variant_idx is None:
            variant_idx = int((exam.get("assignments") or {}).get(student_uid, 0))
        variant_questions = (exam.get("variants") or {}).get(str(variant_idx), exam.get("questions", []))
        result_json = grade_answers(variant_questions, sub["answers"], exam.get("question_type", "open"))
        import json
        grade_result = json.loads(result_json)
        save_grade_result(user.get("uid"), exam_id, student_uid, grade_result, "ai")
        return grade_result
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))

@app.patch("/class-exams/{exam_id}/submissions/{student_uid}/override")
async def override_grade_endpoint(exam_id: str, student_uid: str, data: dict, user=Depends(verify_token)):
    try:
        override_question_grade(
            user.get("uid"), exam_id, student_uid,
            data.get("question_index", 0),
            data.get("new_points", 0),
            data.get("note", ""),
        )
        return {"ok": True}
    except (PermissionError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))

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


@app.patch("/exams/{exam_id}")
async def update_exam_endpoint(exam_id: str, data: dict, user=Depends(verify_token)):
    answers = data.get("answers")
    grade_result = data.get("grade_result")  # None if not provided — never default to {}
    if answers is None:
        raise HTTPException(status_code=422, detail="answers שדה חובה")
    result = update_exam(
        uid=user.get("uid"),
        exam_id=exam_id,
        answers=answers,
        grade_result=grade_result if grade_result else None,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="בחינה לא נמצאה")
    return {"ok": True}


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


@app.get("/teacher/analytics/class/{class_id}")
async def get_class_analytics(class_id: str, user=Depends(verify_token)):
    result = compute_class_analytics(class_id, user.get("uid"))
    if "error" in result:
        status_code = 404 if result["error"] == "הכיתה לא נמצאה" else 403
        raise HTTPException(status_code=status_code, detail=result["error"])
    return result


@app.get("/teacher/analytics/class-exam/{exam_id}")
async def get_class_exam_analytics(exam_id: str, user=Depends(verify_token)):
    result = compute_class_exam_analytics(exam_id, user.get("uid"))
    if "error" in result:
        status_code = 404 if result["error"] == "בחינה לא נמצאה" else 403
        raise HTTPException(status_code=status_code, detail=result["error"])
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
