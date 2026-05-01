"""
flashcards.py — Flashcard generation engine.
Extracts key concepts and definitions from study material.
"""
from openai import OpenAI
import os
import json

def _get_client():
    return OpenAI(
        api_key=os.environ.get("OPENROUTER_API_KEY"),
        base_url="https://openrouter.ai/api/v1",
        timeout=90.0,
    )

FLASHCARD_PROMPT = """
You are an expert educator creating study flashcards from academic material.

Your task is to identify the most important key concepts, terms, and definitions from the text below.

Rules:
1. Extract ONLY real academic concepts, not generic sentences.
2. The "front" should be a specific term, concept, or question.
3. The "back" should be a clear, concise explanation or definition in Hebrew.
4. Generate between 10 and 30 cards depending on the richness of the content.
5. Write both front and back in Hebrew unless the term itself is in another language (e.g., English technical terms are fine on the front).
6. Do NOT include trivial or obvious facts.

Return a JSON object with:
- "cards": array of objects, each with:
  - "front": the term or concept (short, 1-10 words)
  - "back": the definition or explanation (1-4 sentences)

Return ONLY valid JSON.

Text:
{text}
"""


def generate_flashcards(text: str) -> str:
    if not text.strip():
        return json.dumps({"error": "הקובץ שהועלה ריק. אנא העלה קובץ עם תוכן."})

    prompt = FLASHCARD_PROMPT.format(text=text[:12000])  # cap to avoid token overflow

    response = _get_client().chat.completions.create(
        model="openai/gpt-5.4-mini",
        messages=[
            {"role": "system", "content": "You are an expert educator. Respond with valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        stream=False,
        max_tokens=4096,
        timeout=90,
        response_format={"type": "json_object"},
    )

    return response.choices[0].message.content