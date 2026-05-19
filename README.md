# ExamAI-Hebrew 📝

An AI-powered full-stack educational platform for Hebrew-speaking students and teachers. Generate exams, digitize existing ones, manage classrooms, track performance, and study with flashcards — all in Hebrew RTL.

---

## 📌 Overview

ExamAI-Hebrew transforms passive study material into active learning experiences. Teachers can create and assign exams to classes, grade student submissions (manually or via AI), and analyze class-wide performance trends. Students can join classes, take exams interactively, review their results, and study with AI-generated flashcards.

---

## ✨ Features

### 🎓 Exam Generation
- **Multi-format Upload** — PDF, DOCX, PPTX, TXT, JPG, PNG (up to 5 files simultaneously)
- **Four Question Types** — Open-ended, Yes/No, Multiple Choice (א/ב/ג/ד), and Merged (mix of all)
- **Four Difficulty Levels** — Easy (Bloom L1–L2), Medium (L3–L4), Hard (L5–L6), Merged
- **AI-Powered Grading** — Open questions graded by GPT against critical points
- **Local Grading** — Yes/No and Multiple Choice graded instantly in the browser
- **Exam Timer** — Enable/disable toggle with AI-estimated or manual hours:minutes:seconds, auto-submit on expiry

### 📄 Exam Digitization
- Upload an existing printed exam — AI extracts and parses questions exactly as written
- Auto-detects question types and uses knowledge base for answer keys when none provided

### 💾 Exam History (My Exams)
- Save generated or digitized exams to Firestore
- Gallery view with search and filter (All / Graded / Pending)
- Inline solve and grade saved exams
- Export blank or graded exams as PDF or Word

### 🃏 Flashcards
- Upload study material — AI extracts 10–30 key concepts and definitions
- 3D CSS flip animation, shuffle (Fisher-Yates), reverse mode (definition first)
- Deck navigation with progress bar and collapsible full card list

### 🏫 Classroom Management (Teacher)
- Create multiple classes with auto-generated 6-character join codes
- Students join by entering the code
- Create class exams with 1–10 variants (shuffled versions) assigned randomly
- Set optional open/close datetimes (stored UTC, displayed in local timezone)
- Toggle exam visibility (show/hide) at any time regardless of schedule
- Add special instructions per exam (validated against prompt injection)
- Question Editor — add or delete questions manually
- AI Question Generator — generate questions from uploaded files directly into a class exam
- View all student submissions per exam
- Grade submissions with AI or manually
- Override AI grades per question (1 / 0.5 / 0 points) with teacher notes
- Grading panel shows student answers, correct answers, AI feedback, and override history

### 📊 Class Statistics (Teacher)
- **Class-wide view** — select a class to see:
  - Overall stats: total exams, graded count, overall average, total submissions
  - Chronological trend line chart (class average across all exams, RTL direction)
  - Comparative highlights: best exam, hardest exam, highest failure rate, highest score variance
  - Exam matrix table: all exams with date, submissions, average, failure rate, std deviation, drill-down button
- **Exam drill-down** — click any exam for detailed analysis:
  - Score distribution bar chart (color-coded brackets)
  - Per-question success rate with progress bars
  - Distractor analysis for multiple choice (which wrong answers were picked most)
  - Searchable student results table

### 📈 Dashboard
- **Student view** — greeting, stat cards, Bloom's Taxonomy radar chart, quick actions, recent exams, pending exams
- **Teacher view** — greeting, class stats cards, quick actions, recent exams list

### 👤 Settings
- Account: name, email, role-specific profile fields, password change
- Appearance: Light / Dark theme toggle (applies instantly)
- Role settings (Teacher only): office hours, PDF signature, auto-publish toggle
- Privacy: export all exams as PDF, logout, account deletion with confirmation phrase

### 🏛️ Student Class View (My Classes)
- Gallery of enrolled classes with join code display
- Join new class via code modal
- Per-class exam list with status badges: Open / Scheduled / Closed / Hidden
- Always shows open/close times or "ללא מגבלת זמן" if timeless
- Grade field showing score or "ממתין לבדיקה"
- Real-time exam status updates every 30 seconds
- Full exam-taking screen with open/yes-no/multiple choice inputs
- Blocked from resubmitting (409 error)
- View previous submission and answers even after exam closes

---

## 🛠️ Technology Stack

### Frontend
- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- React Router v6
- Recharts (radar chart, bar chart, line chart)
- Firebase SDK (Auth + Firestore)
- jsPDF + Heebo Hebrew font (PDF export)
- docx library (Word export)
- Vitest + React Testing Library

### Backend
- Python 3.11+ + FastAPI + Uvicorn
- Firebase Admin SDK (token verification + Firestore)
- PyMuPDF, python-docx, python-pptx (text extraction)
- pytesseract + Pillow (OCR for scanned PDFs and images)
- SlowAPI (rate limiting)
- pytest + httpx (unit testing)

### AI
- GPT-5.4-mini via OpenRouter API
- Used for: question generation, exam digitization, open-question grading, flashcard extraction, class analytics recommendations, AI timer estimation

### Infrastructure
- Docker + Docker Compose (3 services: frontend, backend, nginx)
- Nginx (reverse proxy: `/` → frontend, `/backend/` → FastAPI)
- GitHub Actions CI/CD

---

## 📁 Project Structure

```
ExamAI-Hebrew/
├── backend/
│   ├── main.py              # All FastAPI routes (30+ endpoints)
│   ├── engine.py            # Text extraction + question generation + grading
│   ├── digitize.py          # Existing exam parser
│   ├── flashcards.py        # Flashcard generation
│   ├── exams_db.py          # Personal exam CRUD (Firestore)
│   ├── class_manager.py     # Full classroom management system
│   ├── analytics.py         # Class statistics + trend analysis
│   ├── firebase_auth.py     # Token verification dependency
│   └── tests/               # pytest suite (38 tests)
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Index.tsx        # Exam generation + digitization + timer
│       │   ├── MyExams.tsx      # Personal exam history + solve + export
│       │   ├── Flashcards.tsx   # Flashcard study UI
│       │   ├── Dashboard.tsx    # Role-based dashboard
│       │   ├── Students.tsx     # Teacher classroom management
│       │   ├── MyClasses.tsx    # Student class view + exam taking
│       │   ├── ClassStats.tsx   # Class analytics dashboard
│       │   ├── Settings.tsx     # 4-tab settings page
│       │   ├── Login.tsx
│       │   └── Signup.tsx
│       ├── components/
│       │   ├── Sidebar.tsx      # RTL sidebar, role-based nav, profile popover
│       │   ├── QuestionsList.tsx
│       │   ├── FileUpload.tsx
│       │   └── ProtectedRoute.tsx
│       ├── lib/
│       │   ├── examsApi.ts      # Personal exam API client
│       │   ├── exportUtils.ts   # PDF + DOCX export with Heebo font
│       │   └── settingsApi.ts   # Settings API + theme utils
│       ├── context/
│       │   └── AuthContext.tsx  # Global auth state
│       ├── types/questions.ts
│       └── utils/gradingUtils.ts
│
├── nginx/nginx.conf
├── docker-compose.yml
└── .github/workflows/ci.yml
```

---

## 🗄️ Firestore Collections

| Collection | Purpose |
|-----------|---------|
| `users/{uid}` | User profile: name, email, role, settings |
| `exams/{uid}/records/{exam_id}` | Personal saved exams |
| `classes/{class_id}` | Class info: name, code, students array, teacher_uid |
| `class_exams/{exam_id}` | Class exam: questions, variants dict, assignments, schedule |
| `class_results/{exam_id}/submissions/{uid}` | Student submissions + grades + overrides |
| `shared_exams/{exam_id}` | Analytics-system shared exams |
| `shared_results/{exam_id}/submissions/{uid}` | Analytics submissions |

---

## ⚙️ Local Development Setup

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker Desktop (optional)
- Firebase project with Authentication and Firestore enabled
- OpenRouter API key

---

### Option A — Docker (Recommended)

```bash
git clone https://github.com/MohammadSbetany/ExamAI-Hebrew.git
cd ExamAI-Hebrew
cp .env.example .env
```

Fill in `.env`:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

OPENROUTER_API_KEY=...
ALLOWED_ORIGINS=http://localhost
FIREBASE_CREDENTIALS_PATH=./backend/serviceAccountKey.json
```

Download your Firebase service account key and save as `backend/serviceAccountKey.json`.

```bash
docker compose up --build
```

Open `http://localhost`.

---

### Option B — Manual

**Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Mac/Linux | .\venv\Scripts\activate on Windows
pip install -r requirements.txt
```

Create `backend/.env`:
```env
OPENROUTER_API_KEY=your_key_here
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
```

```bash
uvicorn main:app --reload
```

**Frontend**
```bash
cd frontend
npm install
```

Create `frontend/.env.local`:
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_BASE_URL=http://localhost:8000
```

```bash
npm run dev
```

Open `http://localhost:5173`.

---

## 🔥 Firebase Setup

1. Create a project at [firebase.google.com](https://firebase.google.com)
2. Enable **Authentication → Email/Password**
3. Create a **Firestore Database**
4. Add Firestore security rules (authenticated access):

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

5. Go to **Project Settings → Your Apps** → add a Web app → copy config to `.env`
6. Go to **Project Settings → Service Accounts** → Generate private key → save as `backend/serviceAccountKey.json`

---

## 🧪 Running Tests

### Backend (38 tests)
```bash
cd backend
pytest
```

### Frontend (47 tests)
```bash
cd frontend
npm test
```

| Suite | Tests |
|-------|-------|
| Backend — engine.py | 21 |
| Backend — main.py | 17 |
| Frontend — ErrorMessage | 5 |
| Frontend — Login | 7 |
| Frontend — Signup | 9 |
| Frontend — ProtectedRoute | 5 |
| Frontend — Grading logic | 14 |
| Frontend — TypeScript types | 8 |
| **Total** | **85** |

---

## 🚀 CI/CD Pipeline

Every push to `master`, `main`, or `feature/**` triggers:

1. **Frontend** — `npm cache clean` → install → ESLint → TypeScript check → Vitest → build
2. **Backend** — pip install → Tesseract install → pytest → py_compile syntax check

---

## 📡 API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Health check |
| POST | `/upload` | ✅ | Generate questions from files |
| POST | `/grade` | ✅ | AI grade open answers |
| POST | `/digitize` | ✅ | Parse existing exam file |
| POST | `/flashcards` | ✅ | Generate flashcards |
| GET/PATCH | `/settings` | ✅ | User settings |
| PATCH | `/profile` | ✅ | Update profile |
| POST | `/exams/save` | ✅ | Save personal exam |
| GET | `/exams` | ✅ | List personal exams |
| GET/DELETE | `/exams/{id}` | ✅ | Get/delete personal exam |
| POST | `/classes` | ✅ | Create class |
| GET | `/classes` | ✅ | List teacher's classes |
| DELETE | `/classes/{id}` | ✅ | Delete class |
| POST | `/classes/{id}/regenerate-code` | ✅ | New join code |
| POST | `/classes/{id}/add-student` | ✅ | Add student manually |
| DELETE | `/classes/{id}/students/{uid}` | ✅ | Remove student |
| POST | `/classes/join` | ✅ | Student joins by code |
| POST | `/classes/{id}/exams` | ✅ | Create class exam |
| GET | `/classes/{id}/exams` | ✅ | List class exams |
| PATCH | `/class-exams/{id}/questions` | ✅ | Update questions |
| POST | `/class-exams/{id}/questions` | ✅ | Add question |
| DELETE | `/class-exams/{id}/questions/{idx}` | ✅ | Delete question |
| PATCH | `/class-exams/{id}/schedule` | ✅ | Set visibility + times |
| DELETE | `/class-exams/{id}` | ✅ | Delete exam |
| GET | `/student/class-exam/{id}` | ✅ | Get student's variant |
| POST | `/student/class-exam/{id}/submit` | ✅ | Submit answers |
| GET | `/student/class-exam/{id}/my-submission` | ✅ | Check submission status |
| GET | `/student/classes` | ✅ | List student's classes |
| GET | `/student/classes/{id}/exams` | ✅ | List class exams for student |
| GET | `/class-exams/{id}/submissions` | ✅ | All submissions |
| POST | `/class-exams/{id}/submissions/{uid}/grade-ai` | ✅ | AI grade submission |
| PATCH | `/class-exams/{id}/submissions/{uid}/override` | ✅ | Override grade |
| POST | `/teacher/share-exam` | ✅ | Share exam for analytics |
| GET | `/teacher/shared-exams` | ✅ | List shared exams |
| GET | `/teacher/analytics/{exam_id}` | ✅ | Single exam analytics |
| GET | `/teacher/analytics/class/{class_id}` | ✅ | Full class trend analytics |
| GET | `/teacher/analytics/class-exam/{exam_id}` | ✅ | Class exam drill-down |

---

## 🔐 Security

- Passwords handled entirely by Firebase Authentication
- Firebase ID tokens verified on every backend request
- Upload: max 10MB/file, max 5 files, whitelisted extensions only
- Rate limiting: 10 req/min on generation, 20 req/min on grading
- Teacher comment validation blocks prompt injection, code patterns, and forbidden keywords (Hebrew + English)
- Resubmission blocked at API level (409 Conflict)
- Grade overrides require teacher UID match against exam ownership
- Students can only access exams from classes they are enrolled in

---

## 🗺️ Navigation

### Student Sidebar
- לוח בקרה — Dashboard
- יצירת בחינה — Exam Generator
- הבחינות שלי — My Exams
- כרטיסיות לימוד — Flashcards
- הכיתות שלי — My Classes

### Teacher Sidebar
- לוח בקרה — Dashboard
- יצירת בחינה — Exam Generator
- הבחינות שלי — My Exams
- כרטיסיות לימוד — Flashcards
- ניהול תלמידים — Student Management
- סטטיסטיקות כיתה — Class Statistics

### Bottom (always visible)
- הגדרות — Settings
- Profile popover with name, email, role, and logout button

---

## 👤 Author

**Mohammad Sbetany**  
Software Engineering Student — Azrieli Academic College of Engineering

---

## 📄 License

This project is developed for academic and educational purposes.
