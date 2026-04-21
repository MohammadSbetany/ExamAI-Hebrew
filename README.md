# ExamAI-Hebrew 📝
 
An AI-powered exam question generator and grader for Hebrew learning materials.
 
---
 
## 📌 Overview
 
ExamAI-Hebrew is a full-stack web application that automatically generates exam questions in Hebrew from uploaded study documents. It supports multiple question types, difficulty levels, AI-powered grading for open questions, and a role-based system for students and teachers.
 
---
 
## ✨ Features
 
- **Multi-format Upload** — PDF, DOCX, PPTX, and TXT support
- **Three Question Types** — Open-ended, Yes/No, and Multiple Choice (א/ב/ג/ד)
- **Three Difficulty Levels** — Easy, Medium, Hard
- **AI-Powered Grading** — Open questions graded against critical points by GPT-4.1-mini via OpenRouter
- **Local Grading** — Yes/No and Multiple Choice graded instantly in the browser (no API call)
- **Role-Based Access** — Student and Teacher roles with different sidebar sections
- **Firebase Authentication** — Email/Password login and signup
- **Firestore Database** — User profiles stored securely
- **Protected Routes** — Unauthenticated users redirected to login
- **Hebrew RTL Interface** — Full right-to-left layout using the Heebo font
- **Docker Support** — Full containerized deployment with Nginx reverse proxy
- **CI/CD Pipeline** — GitHub Actions workflow with lint, test, and build jobs
- **Unit Tests** — 85 tests across frontend (Vitest) and backend (pytest)
---
 
## 🛠️ Technology Stack
 
### Frontend
- React 18 + TypeScript
- Vite + Tailwind CSS
- shadcn/ui component library
- React Router v6
- Firebase SDK (Auth + Firestore)
- Vitest + React Testing Library
### Backend
- Python 3.11 + FastAPI
- Firebase Admin SDK (token verification)
- PyMuPDF, python-docx, python-pptx (text extraction)
- SlowAPI (rate limiting)
- pytest (unit testing)
### AI
- GPT-4.1-mini via OpenRouter API
### Infrastructure
- Docker + Docker Compose
- Nginx (reverse proxy + static file serving)
- GitHub Actions (CI/CD)
---
 
## 📁 Project Structure
 
```
ExamAI-Hebrew/
├── frontend/                  # React application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── Sidebar.tsx    # RTL sidebar with role-based sections
│   │   │   ├── ProtectedRoute.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   ├── QuestionsList.tsx
│   │   │   └── ErrorMessage.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx  # Global auth state
│   │   ├── pages/
│   │   │   ├── Index.tsx      # Main exam generation page
│   │   │   ├── Login.tsx
│   │   │   └── Signup.tsx
│   │   ├── types/
│   │   │   └── questions.ts   # Shared TypeScript interfaces
│   │   └── lib/
│   │       └── firebase.ts    # Firebase initialization
│   ├── src/__tests__/         # Frontend unit tests (Vitest)
│   ├── Dockerfile
│   ├── nginx-frontend.conf
│   └── vitest.config.ts
│
├── backend/                   # FastAPI application
│   ├── main.py                # API endpoints
│   ├── engine.py              # Text extraction + AI calls
│   ├── firebase_auth.py       # Token verification
│   ├── tests/                 # Backend unit tests (pytest)
│   │   ├── conftest.py
│   │   ├── test_main.py
│   │   └── test_engine.py
│   ├── Dockerfile
│   └── requirements.txt
│
├── nginx/
│   └── nginx.conf             # Reverse proxy config
├── docker-compose.yml
├── .env.example
└── .github/
    └── workflows/
        └── ci.yml             # GitHub Actions pipeline
```
 
---
 
## ⚙️ Local Development Setup
 
### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker Desktop (for containerized setup)
- A Firebase project
- An OpenRouter API key
---
 
### Option A — Docker (Recommended)
 
**1. Clone the repository**
```bash
git clone https://github.com/MohammadSbetany/ExamAI-Hebrew.git
cd ExamAI-Hebrew
```
 
**2. Create your environment file**
```bash
cp .env.example .env
```
 
Fill in your real values in `.env`:
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
 
**3. Add your Firebase service account key**
 
Download from Firebase Console → Project Settings → Service Accounts → Generate new private key.
Save as `backend/serviceAccountKey.json`.
 
**4. Run**
```bash
docker compose up --build
```
 
Open `http://localhost` in your browser.
 
---
 
### Option B — Manual (without Docker)
 
**Backend**
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Mac/Linux
# or: .\venv\Scripts\activate   # Windows
 
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
```
 
```bash
npm run dev
```
 
Open `http://localhost:5173`.
 
---
 
## 🔥 Firebase Setup
 
1. Go to [firebase.google.com](https://firebase.google.com) and create a project
2. Enable **Authentication → Email/Password**
3. Create a **Firestore Database** (start in test mode)
4. Go to **Project Settings → Your Apps** → add a Web app → copy the config into your `.env`
5. Go to **Project Settings → Service Accounts** → Generate new private key → save as `backend/serviceAccountKey.json`
---
 
## 🧪 Running Tests
 
### Backend (pytest) — 38 tests
```bash
cd backend
pip install pytest httpx pytest-asyncio
pytest
```
 
### Frontend (Vitest) — 47 tests
```bash
cd frontend
npm test
```
 
### Full test summary
 
| Suite | Tests | Status |
|-------|-------|--------|
| Backend — engine.py (text extraction, AI calls) | 21 | ✅ |
| Backend — main.py (API endpoints, validation, auth) | 17 | ✅ |
| Frontend — ErrorMessage component | 5 | ✅ |
| Frontend — Login page | 7 | ✅ |
| Frontend — Signup page | 9 | ✅ |
| Frontend — ProtectedRoute | 5 | ✅ |
| Frontend — Local grading logic | 14 | ✅ |
| Frontend — TypeScript type definitions | 8 | ✅ |
| **Total** | **85** | ✅ |
 
---
 
## 🚀 CI/CD Pipeline
 
Every push to `master`, `main`, or `feature/**` branches automatically runs:
 
1. **Frontend job** — install, lint, test, build
2. **Backend job** — install, pytest, syntax check
The pipeline is defined in `.github/workflows/ci.yml`.
 
---
 
## 🔐 Security
 
- Passwords are never stored — handled entirely by Firebase Authentication
- Firebase ID tokens verified on every backend request via `firebase_auth.py`
- Tokens stored in `localStorage` on the frontend
- Upload size capped at **10MB**
- Rate limiting: `/upload` → 10 req/min, `/grade` → 20 req/min
- Input validation on all parameters (question type, count, difficulty)
- CORS origins configurable via environment variable
- `serviceAccountKey.json` and all `.env` files are gitignored
---
 
## 🗺️ Sidebar Navigation
 
### Section "ראשי" (All users)
- לוח בקרה — Dashboard
- יצירת בחינה — Create Exam (main page)
- הבחינות שלי — My Exams
- התקדמות — Progress
- כרטיסיות לימוד — Flashcards
### Section "מורה" (Teachers only)
- ניהול תלמידים — Student Management
- סטטיסטיקות כיתה — Class Statistics
### Bottom (Always visible)
- הגדרות — Settings
- User profile with name, role, and logout
---
 
## 📄 API Endpoints
 
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | None | Health check |
| POST | `/upload` | ✅ | Upload file and generate questions |
| POST | `/grade` | ✅ | Grade open-ended answers |
 
### `/upload` Parameters
| Field | Type | Values |
|-------|------|--------|
| `file` | File | PDF, DOCX, TXT, PPTX (max 10MB) |
| `question_type` | string | `open`, `yesno`, `multiple` |
| `question_count` | int | 1–50 |
| `difficulty` | string | `easy`, `medium`, `hard` |
 
---
 
## 👤 Author
 
**Mohammad Sbetany**
Software Engineering Student
 
---
 
## 📄 License
 
This project is developed for academic and educational purposes.
 