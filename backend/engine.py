import os
import fitz  # PyMuPDF
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

def generate_questions_from_pdf(file_bytes: bytes):
    # 1. Extract text locally since DeepSeek doesn't host files
    pdf_text = extract_text_from_pdf(file_bytes)

    prompt = f"""
    Analyze the following Hebrew text and generate 5 open-ended questions (שאלות פתוחות) in Hebrew.
    Return ONLY a JSON object with a key "questions" containing an array of strings.
    
    Text:
    {pdf_text}
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