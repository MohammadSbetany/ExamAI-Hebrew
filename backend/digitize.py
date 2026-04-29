"""
digitize.py — Exam Digitization Engine

Takes an existing exam file and uses the AI to:
1. Extract questions exactly as written (no rewriting)
2. Detect the type of each question (yesno, multiple, open)
3. Return structured JSON matching our Question schema
"""
from openai import OpenAI
import os

client = OpenAI(
    api_key=os.environ.get("OPENROUTER_API_KEY"),
    base_url="https://openrouter.ai/api/v1",
    timeout=90.0,
)

DIGITIZE_PROMPT = """
You are an expert exam parser. Your task is to extract questions from an existing exam document.

CRITICAL RULES:
1. Copy questions EXACTLY as written — do NOT rephrase, summarize, or rewrite them.
2. Preserve all sub-parts (1a, 1b, etc.) as separate questions.
3. Detect the type of each question automatically:
   - "yesno" — if the question asks for a yes/no or true/false answer
   - "multiple" — if the question has labeled options (א/ב/ג/ד, A/B/C/D, 1/2/3/4, etc.)
   - "open" — all other questions (calculations, explanations, essays, etc.)
4. If you find the answer key in the document, include it. Otherwise, use your knowledge to determine the correct answer.
5. For open questions where no answer key exists, write a model answer in Hebrew.

Return a JSON object with:
- "questions": array of question objects, each with:
  - "type": "yesno" | "multiple" | "open"
  - "question": the exact question text (in original language)
  - "answer": the correct answer
  - For "multiple": also include "options" as an object with the option labels as keys
  - For "open": also include "critical_points" (3-5 key points in Hebrew that a complete answer must cover)

Return ONLY valid JSON.

Exam text:
{text}
"""


def digitize_exam(text: str) -> str:
    """Parse an existing exam into structured questions."""
    if not text.strip():
        import json
        return json.dumps({"error": "הקובץ שהועלה ריק. אנא העלה קובץ בחינה עם תוכן."})

    prompt = DIGITIZE_PROMPT.format(text=text)

    response = client.chat.completions.create(
        model="openai/gpt-5.4-mini",
        messages=[
            {"role": "system", "content": "You are an expert exam parser. Respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        stream=False,
        max_tokens=8192,
        timeout=90,
        response_format={"type": "json_object"},
    )

    return response.choices[0].message.content