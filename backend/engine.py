import os
import fitz  # PyMuPDF
from docx import Document
from pptx import Presentation
import io
from openai import OpenAI
from dotenv import load_dotenv
import json

load_dotenv()

# Setup DeepSeek client
client = OpenAI(
    api_key=os.environ.get("DEEPSEEK_API_KEY"), 
    base_url="https://api.deepseek.com"
)

def extract_text_from_pdf(file_bytes: bytes):
    """Extracts text from PDF bytes, handling Hebrew RTL properly."""
    text = ""
    with fitz.open(stream=file_bytes, filetype="pdf") as doc:
        for page in doc:
            text += page.get_text()
    return text

def extract_text_from_docx(file_bytes: bytes):
    doc = Document(io.BytesIO(file_bytes))
    return "\n".join([paragraph.text for paragraph in doc.paragraphs])

def extract_text_from_pptx(file_bytes: bytes):
    prs = Presentation(io.BytesIO(file_bytes))
    text = ""
    for slide in prs.slides:
        for shape in slide.shapes:
            if shape.has_text_frame:
                for paragraph in shape.text_frame.paragraphs:
                    text += paragraph.text + "\n"
    return text

def extract_text_from_txt(file_bytes: bytes):
    return file_bytes.decode("utf-8")

def generate_questions(file_bytes: bytes, filename: str):
    # 1. Extract text locally since DeepSeek doesn't host files
    ext = filename.lower().split(".")[-1]

    if ext == "pdf":
        text = extract_text_from_pdf(file_bytes)
    elif ext == "docx":
        text = extract_text_from_docx(file_bytes)
    elif ext == "pptx":
        text = extract_text_from_pptx(file_bytes)
    elif ext == "txt":
        text = extract_text_from_txt(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    prompt = f"""
    Analyze the following text and generate 5 open-ended questions (שאלות פתוחות) in Hebrew.
    
    Before generating questions, check the content:
    - If the text is empty or too short to work with, return: {{"error": "הקובץ שהועלה ריק או קצר מדי. אנא העלה קובץ עם תוכן."}}
    - If the text contains random characters or meaningless content with no real information, return: {{"error": "התוכן בקובץ אינו משמעותי ולא ניתן ליצור ממנו שאלות. אנא העלה קובץ עם חומר לימוד תקין."}}
    - If the text is valid and meaningful, return ONLY a JSON object with a key "questions" containing an array of 5 strings.
    
    Text:
    {text}
    """

    # 2. Use DeepSeek-V3 (deepseek-chat)
    response = client.chat.completions.create(
        model="deepseek-chat", # Use "deepseek-reasoner" if you want the "thinker"
        messages=[
            {"role": "system", "content": "You are an expert educator. You must respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        stream=False,
        max_tokens=1024,
        response_format={"type": "json_object"}
    )

    return response.choices[0].message.content