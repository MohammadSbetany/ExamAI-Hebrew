# ExamAI-Hebrew 📝

An AI-powered, full-stack educational platform for Hebrew-speaking students and teachers. Generate exams from study material, manage classrooms, grade submissions (manually or with AI), analyze class performance, and study with AI-generated flashcards — all in a fully Hebrew, right-to-left (RTL) interface.

> **Live:** https://examai-hebrew.jce.ac/

---

## 📌 Overview

ExamAI-Hebrew turns passive study material into active learning. Teachers create classes, assign exams (with randomized variants and scheduling), grade student submissions, and analyze class-wide performance trends. Students join classes with a code, take exams interactively, review their graded results, and generate flashcards from their own material.

The stack is a **React + TypeScript (Vite)** frontend, a **FastAPI (Python)** backend, **Firebase** (Authentication + Firestore), and an **LLM** (OpenAI `gpt-5.4-mini` via OpenRouter) for generation, grading, and analytics.

---

## ✨ Features

### 🎓 Exam Generation
- **Multi-format upload** — PDF, DOCX, PPTX, TXT, JPG, PNG (up to 5 files at once). Scanned PDFs and images are OCR'd (Hebrew + English).
- **Four question types** — Open-ended, Yes/No (כן/לא), Multiple Choice (א/ב/ג/ד), and Merged (a configurable mix). For Merged, a distribution bar sets how many of each type.
- **Four difficulty levels** — Easy (Bloom L1–L2), Medium (L3–L4), Hard (L5–L6), and Merged (a distribution across levels).
- **AI grading** — open/merged answers graded by the LLM against critical points, with per-question feedback (covered points, missed points, explanation).
- **Local grading** — Yes/No and Multiple Choice graded instantly in the browser.
- **Exam timer** — optional AI-estimated or manual `hh:mm:ss` limit, live countdown, and auto-submit on expiry.
- **Export** — download any exam as a Word (`.docx`) document, either **blank** or **graded**, with proper Hebrew RTL formatting.

### 💾 My Exams (Personal Exam History)
- Save generated exams to Firestore.
- Gallery with search and filter (All / Graded / Pending).
- Re-open a saved exam to solve and grade it inline.
- Export blank or graded copies as Word.

### 🃏 Flashcards
- Upload study material — the AI extracts key concepts and definitions.
- 3D CSS flip animation, shuffle (Fisher–Yates), and reverse mode (definition-first).
- Deck navigation with a progress bar and a collapsible full-list view.

### 🏫 Classroom Management (Teacher)
- Create classes with auto-generated 6-character join codes; rename or delete anytime.
- Add students by join code, manually, or by email; remove students.
- Create class exams with **1–10 variants** (distinct question sets) assigned randomly to students.
- Optional open/close datetimes (stored UTC, shown in local time) and a visibility toggle independent of the schedule.
- Per-exam special instructions (validated against prompt injection).
- **Question editor** — add/edit/delete questions per variant.
- **AI generator** — generate questions from uploaded files straight into a class exam.
- View all student submissions per exam; grade with AI or manually.
- **Grade overrides** — set 1 / 0.5 / 0 per question with an optional teacher note; override history is shown.

### 🏛️ My Classes (Student)
- Gallery of enrolled classes; join a new class by code.
- Per-class exam list with status badges: Open / Scheduled / Closed / Hidden, plus open/close times or “no time limit”.
- Grade shown once graded, or “awaiting grading”.
- Status auto-refreshes every 30 seconds.
- Full exam-taking screen for open / yes-no / multiple-choice; resubmission is blocked (409).
- Review a previous submission and answers even after the exam closes.

### 📊 Class Statistics (Teacher)
- **Class overview** — total exams, graded count, overall average, total submissions; a chronological average-trend line chart (RTL); comparative highlights (best/hardest exam, highest failure rate, highest score spread); and an exam matrix (date, submissions, average, failure rate, std-dev, drill-down).
- **Exam drill-down** — score-distribution bar chart, per-question success rate, distractor analysis for multiple-choice (which wrong options were most chosen), and a searchable student results table.

### 📈 Dashboard
- **Student** — greeting, stat cards, quick actions, open/pending exams, recent activity.
- **Teacher** — greeting, class stat cards, quick actions, recent created exams, submissions to grade.

### 👤 Settings
- **Account** — full name, email (read-only), role-specific profile fields (teacher: title; student: institution, field of study, year), and password change (Firebase re-authentication).
- **Appearance** — Light / Dark theme toggle (applies instantly).

### 🔐 Authentication
- **Email / password** sign-up and sign-in via Firebase.
- **Sign in with Google** (popup) on both the Login and Signup pages — first-time Google users pick a teacher/student role before entering.
- Client-side validation (email format, required fields), a show/hide-password toggle, and friendly localized error messages.

### 🌐 Internationalization (i18n)
- The app ships **Hebrew-only**, but is fully internationalized: every user-facing string comes from a single locale file (`frontend/src/locales/he.json`, 500+ keys) via `i18next` / `react-i18next`.
- Direction (RTL/LTR) and the `<html dir/lang>` attributes are bound to the active locale.
- Adding a language later = add one `locales/<lang>.json`, register it in `lib/i18n.ts`, and (if RTL) add its code to `RTL_LANGS`. The backend has a matching lightweight i18n layer (`backend/i18n.py` + `backend/locales/`).

---

## 🛠️ Technology Stack

### Frontend
- React 18 + TypeScript + Vite 5
- Tailwind CSS + shadcn/ui (Radix UI primitives)
- React Router v6
- Recharts (bar / line charts)
- Firebase Web SDK (Auth + Firestore)
- `docx` + `file-saver` (Word export)
- `i18next` + `react-i18next` (i18n)
- Vitest + React Testing Library

### Backend
- Python 3.11+ · FastAPI · Uvicorn
- Firebase Admin SDK (ID-token verification + Firestore)
- PyMuPDF, python-docx, python-pptx (text extraction)
- pytesseract + Pillow (OCR for scanned PDFs and images)
- SlowAPI (rate limiting)
- python-dotenv (env loading)
- pytest + httpx (tests)

### AI
- `openai/gpt-5.4-mini` via the OpenRouter API — used for question generation, open-answer grading, flashcard extraction, class-analytics recommendations, and AI timer estimation.

---

## 📁 Project Structure

```
ExamAI-Hebrew/
├── backend/
│   ├── main.py            # FastAPI app + all routes
│   ├── engine.py          # File text extraction + question generation + grading
│   ├── flashcards.py      # Flashcard generation
│   ├── exams_db.py        # Personal exam CRUD (Firestore)
│   ├── class_manager.py   # Classroom + class-exam + submission logic
│   ├── students_db.py     # Class/student helpers
│   ├── analytics.py       # Class + exam analytics, trends, distractor analysis
│   ├── firebase_auth.py   # Firebase Admin init + token-verification dependency
│   ├── i18n.py            # Backend localization (Accept-Language)
│   ├── locales/he.json    # Backend Hebrew strings
│   ├── requirements.txt / requirements-dev.txt
│   └── tests/             # pytest suite (test_engine, test_main, test_class_management, test_class_logic)
│
├── frontend/
│   └── src/
│       ├── pages/         # Index, MyExams, Flashcards, Dashboard, Students,
│       │                  # MyClasses, ClassStats, Settings, Login, Signup, NotFound
│       ├── components/    # Sidebar, QuestionsList, FileUpload, ExportMenu,
│       │                  # ShareExamModal, DistributionBar, GoogleSignInButton,
│       │                  # ErrorMessage, LoadingSpinner, NavLink, ProtectedRoute, ui/
│       ├── lib/           # firebase.ts, i18n.ts, examsApi.ts, settingsApi.ts, exportUtils.ts, utils.ts
│       ├── locales/he.json# Single source of all UI strings
│       ├── context/       # AuthContext.tsx
│       ├── types/         # questions.ts
│       └── utils/         # gradingUtils.ts, distribution.ts
│
└── .github/workflows/ci.yml
```

---

## 🗄️ Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `users/{uid}` | User profile: name, email, role, settings |
| `exams/{uid}/records/{exam_id}` | Personal saved exams |
| `classes/{class_id}` | Class: name, code, students, teacher_uid |
| `class_exams/{exam_id}` | Class exam: questions, variants, assignments, schedule, visibility |
| `class_results/{exam_id}/submissions/{uid}` | Student submissions + grades + overrides |
| `shared_exams/{exam_id}` | Analytics-shared exams |
| `shared_results/{exam_id}/submissions/{uid}` | Analytics submissions |

---

## ⚙️ Environment Variables

### Backend (`backend/.env`)
| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | ✅ | OpenRouter API key for the LLM |
| `ALLOWED_ORIGINS` | ✅ | Comma-separated CORS origins |
| `FIREBASE_CREDENTIALS_JSON` | one of these | The whole service-account JSON as a single value (best for one-file env hosts) |
| `FIREBASE_CREDENTIALS_PATH` | one of these | Path to the service-account JSON (absolute, or relative to `backend/`) |

If neither Firebase variable is set, the backend falls back to `backend/serviceAccountKey.json`. Credentials load **lazily**, so a missing key no longer crashes the app at startup — only auth-protected routes return a clear error.

### Frontend (`frontend/.env` — baked in at **build** time)
| Variable | Description |
|----------|-------------|
| `VITE_FIREBASE_API_KEY` | Firebase web config |
| `VITE_FIREBASE_AUTH_DOMAIN` | " |
| `VITE_FIREBASE_PROJECT_ID` | " |
| `VITE_FIREBASE_STORAGE_BUCKET` | " |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | " |
| `VITE_FIREBASE_APP_ID` | " |
| `VITE_API_BASE_URL` | Backend base URL (e.g. `/backend` in production, `http://localhost:8000` in dev) |

> Secrets (`backend/.env`, `frontend/.env`, `backend/serviceAccountKey.json`) are gitignored and never committed.

---

## 🚀 Local Development

### Prerequisites
- Node.js 20+
- Python 3.11+
- A Firebase project (Authentication + Firestore)
- An OpenRouter API key

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: .\venv\Scripts\activate
pip install -r requirements.txt
# create backend/.env (see table above) and place serviceAccountKey.json
uvicorn main:app --reload         # http://localhost:8000
```

### Frontend
```bash
cd frontend
npm install
# create frontend/.env with the VITE_* vars (set VITE_API_BASE_URL=http://localhost:8000)
npm run dev                        # http://localhost:5173
```

---

## 🔥 Firebase Setup

1. Create a project at [firebase.google.com](https://firebase.google.com).
2. **Authentication → Sign-in method** → enable **Email/Password** and **Google**.
3. **Authentication → Settings → Authorized domains** → add your production domain (e.g. `examai-hebrew.jce.ac`). `localhost` is allowed by default.
4. Create a **Firestore** database and add rules (authenticated access):
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
5. **Project Settings → Your Apps** → add a Web app → copy the config into the `VITE_FIREBASE_*` vars.
6. **Project Settings → Service Accounts** → *Generate new private key* → provide it to the backend via `FIREBASE_CREDENTIALS_JSON`, `FIREBASE_CREDENTIALS_PATH`, or `backend/serviceAccountKey.json`.

---

## 🧪 Tests

```bash
# Backend  (149 tests)
cd backend && pytest

# Frontend (92 tests)
cd frontend && npm test
```

| Area | Files | Tests |
|------|-------|-------|
| Backend | `test_engine.py`, `test_main.py`, `test_class_management.py`, `test_class_logic.py` | **149** |
| Frontend | `ClassroomFeatures`, `Login`, `Signup`, `ExportMenu`, `ShareExamModal`, `DistributionBar`, `ProtectedRoute`, `ErrorMessage`, `gradingLogic`, `distribution`, `questions.types` | **92** |
| **Total** | | **241** |

LLM/API calls are mocked, so tests run without real credentials or network.

---

## 🔄 CI/CD

`.github/workflows/ci.yml` runs on pushes/PRs:
- **Frontend** — install → ESLint → `tsc --noEmit` → Vitest → `vite build` → upload artifact.
- **Backend** — install Tesseract (heb+eng) → `pip install -r requirements-dev.txt` → pytest → syntax check.

---

## 📡 API

All routes require a Firebase ID token (`Authorization: Bearer <token>`) except `GET /health`.

**Core & AI**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check (no auth) |
| GET | `/dashboard/summary` | Role-based dashboard aggregates |
| POST | `/upload` | Generate questions from uploaded files |
| POST | `/grade` | AI-grade open answers |
| POST | `/flashcards` | Generate flashcards from files |

**Personal exams & settings**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/exams/save` | Save a personal exam |
| GET | `/exams` | List personal exams |
| GET | `/exams/{exam_id}` | Get one exam |
| PATCH | `/exams/{exam_id}` | Update answers/grade |
| DELETE | `/exams/{exam_id}` | Delete exam |
| GET / PATCH | `/settings` | Get / update user settings |
| PATCH | `/profile` | Update profile fields |

**Classes (teacher)**
| Method | Path | Description |
|--------|------|-------------|
| POST / GET | `/classes` | Create / list classes |
| PATCH / DELETE | `/classes/{class_id}` | Rename / delete class |
| POST | `/classes/{class_id}/regenerate-code` | New join code |
| POST | `/classes/{class_id}/add-student` | Add student manually |
| POST | `/classes/{class_id}/add-student-by-email` | Add student by email |
| DELETE | `/classes/{class_id}/students/{student_uid}` | Remove student |
| POST | `/classes/join` | Student joins by code |

**Class exams (teacher)**
| Method | Path | Description |
|--------|------|-------------|
| POST / GET | `/classes/{class_id}/exams` | Create / list class exams |
| PATCH | `/class-exams/{exam_id}/questions` | Update questions |
| PATCH | `/class-exams/{exam_id}/variants` | Set variants |
| POST | `/class-exams/{exam_id}/questions` | Add question |
| DELETE | `/class-exams/{exam_id}/questions/{question_index}` | Delete question |
| PATCH | `/class-exams/{exam_id}/schedule` | Set visibility + open/close |
| DELETE | `/class-exams/{exam_id}` | Delete class exam |
| GET | `/class-exams/{exam_id}/submissions` | List all submissions |
| POST | `/class-exams/{exam_id}/submissions/{student_uid}/grade-ai` | AI-grade a submission |
| PATCH | `/class-exams/{exam_id}/submissions/{student_uid}/override` | Override a question grade |

**Student**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/student/classes` | List enrolled classes |
| GET | `/student/classes/{class_id}/exams` | List class exams for the student |
| GET | `/student/class-exam/{exam_id}` | Get the student's assigned variant |
| POST | `/student/class-exam/{exam_id}/submit` | Submit answers |
| GET | `/student/class-exam/{exam_id}/my-submission` | Check submission status |

**Analytics**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/teacher/share-exam` | Share an exam for analytics |
| GET | `/teacher/shared-exams` | List shared exams |
| GET | `/teacher/analytics/{exam_id}` | Single-exam analytics |
| GET | `/teacher/analytics/class/{class_id}` | Full class trend analytics |
| GET | `/teacher/analytics/class-exam/{exam_id}` | Class-exam drill-down |

---

## 🔐 Security

- Passwords and identity handled entirely by Firebase Authentication; every backend request verifies the Firebase ID token.
- Firebase Admin credentials are provided via env/secret (never committed) and loaded lazily.
- Uploads: size/count limits and a whitelist of extensions (PDF, DOCX, PPTX, TXT, JPG, PNG).
- Rate limiting via SlowAPI on generation/grading routes.
- Teacher exam instructions are validated to block prompt-injection / code patterns.
- Resubmission blocked at the API level (409).
- Grade overrides require the teacher to own the exam; students can only access exams from classes they belong to.

---

## 🌍 Deployment

Production serves the **built frontend** as static files behind an **nginx** reverse proxy that forwards `/backend/*` to the FastAPI (uvicorn) service. The backend needs its environment (`OPENROUTER_API_KEY`, `ALLOWED_ORIGINS`) and Firebase Admin credentials (`FIREBASE_CREDENTIALS_JSON` or a key file) present **on the server**; the `VITE_*` variables must be present at frontend **build** time. Secrets live only on the server, never in the repository.

---

## 👤 Author

**Mohammad Sbetany** — Software Engineering, Azrieli Academic College of Engineering.

## 📄 License

Developed for academic and educational purposes.
