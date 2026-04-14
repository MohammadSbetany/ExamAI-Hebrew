from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Depends
from firebase_auth import verify_token
import json
from engine import generate_questions, grade_answers

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    # Add 8080 to this list!
    allow_origins=[
        "http://localhost:5173", 
        "http://localhost:3000", 
        "http://localhost:8080"
    ], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...), question_type: str = Form("open"), question_count: int = Form(5), difficulty: str = Form("medium"), user=Depends(verify_token)):
    ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "pptx"}
    ext = file.filename.lower().split(".")[-1]
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported file type. Allowed: PDF, DOCX, TXT, PPTX")

    try:
        content = await file.read()
        result_json_string = generate_questions(content, file.filename, question_type, question_count, difficulty)
        return json.loads(result_json_string)
        
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        print(f"Server Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process the file")

@app.post("/grade")
async def grade(data: dict, user=Depends(verify_token)):
    try:
        questions = data.get("questions", [])
        answers = data.get("answers", [])
        question_type = data.get("question_type", "open")
        result = grade_answers(questions, answers, question_type)
        return json.loads(result)
    except Exception as e:
        print(f"Grading Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to grade answers")        