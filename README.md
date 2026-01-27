# ExamAI-Hebrew 📝📖

Automatic generation of open-ended questions in Hebrew from learning materials.

---

## 📌 Overview
ExamAI-Hebrew is a software engineering project designed to automatically generate **open-ended questions in Hebrew** from learning materials (PDFs).  
The system leverages AI to support teachers and students by transforming static documents into dynamic study resources.

---

## 🎯 Project Goals
- Automate question generation from Hebrew learning materials.
- Support self-learning and exam preparation.
- Provide a clean, RTL-friendly interface for Hebrew users.
- Maintain a neutral, non-political presentation focused purely on education and technology.

---

## ✨ Features (MVP Scope)
- **PDF Upload:** Upload local PDF learning materials.
- **Hebrew Text Extraction:** Accurate extraction using PyMuPDF.
- **AI-Based Question Generation:** High-quality open-ended questions powered by DeepSeek-V3.
- **RTL User Interface:** Frontend designed specifically for Hebrew (Right-to-Left) display.

---

## 🛠️ Technology Stack

### Frontend
- React (Vite)
- RTL-friendly UI

### Backend
- Python (FastAPI)
- RESTful API architecture

### AI & Processing
- DeepSeek-V3 (OpenAI-compatible API)
- PyMuPDF (fitz) for PDF processing

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/MohammadSbetany/ExamAI-Hebrew.git
cd ExamAI-Hebrew
```

---

### 2️⃣ Backend Setup

```bash
cd backend
python -m venv venv
```

Activate the virtual environment:

- **Windows**
```bash
.\venv\Scripts\activate
```

- **Mac / Linux**
```bash
source venv/bin/activate
```

Install dependencies:
```bash
pip install "fastapi[standard]" pymupdf openai python-dotenv
```

---

### 3️⃣ Environment Variables (Security)

To protect API credentials, the `.env` file is excluded using `.gitignore`.

Create a `.env` file inside the `/backend` directory:

```env
DEEPSEEK_API_KEY=your_actual_key_here
```

---

### 4️⃣ Running the Application

#### Start the Backend
```bash
# From the /backend directory
uvicorn main:app --reload
```

#### Start the Frontend
```bash
# From the /frontend directory
npm install
npm run dev
```

---

## 📊 Project Status
**Current Phase:** MVP development  
**Status:** Backend–Frontend integration completed (CORS enabled)

---

## 👤 Author
**Mohammad Sbetany**  
Software Engineering Student

---

## 📄 License
This project is developed for academic and educational purposes.
