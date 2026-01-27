from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import json
from engine import generate_questions_from_pdf

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
async def upload_pdf(file: UploadFile = File(...)):
    # Stronger validation: Check both extension and MIME type
    if not file.filename.lower().endswith('.pdf') or file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only actual PDF files are allowed")

    try:
        content = await file.read()
        result_json_string = generate_questions_from_pdf(content)
        return json.loads(result_json_string)
        
    except Exception as e:
        # Log the real error for you, but keep the client response clean
        print(f"Server Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to process Hebrew PDF")