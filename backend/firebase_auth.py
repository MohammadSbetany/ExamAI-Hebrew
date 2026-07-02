import os
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth

# ─────────────────────────────────────────────────────────────────────────────
# 🔧 SETUP: Download your Firebase Admin SDK service account key:
# Firebase Console → Project Settings → Service Accounts → Generate new private key
# Save the file as: backend/serviceAccountKey.json
# ─────────────────────────────────────────────────────────────────────────────

_initialized = False

def _init_firebase():
    """Initialize the Firebase Admin SDK once, lazily.

    Called on first token verification (not at import) so that a missing or
    misplaced credentials file does not crash the whole app on startup — which
    would take the entire API down with a 502. The credential path is resolved
    relative to this file when it is not absolute, so it works regardless of the
    process working directory.
    """
    global _initialized
    if not _initialized:
        cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH") or os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
        if not os.path.isabs(cred_path):
            cred_path = os.path.join(os.path.dirname(__file__), cred_path)
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        _initialized = True

bearer_scheme = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)) -> dict:
    """
    FastAPI dependency — verifies the Firebase ID token from the Authorization header.
    Use as: user = Depends(verify_token)
    Returns the decoded token dict with uid, email, etc.
    """
    try:
        _init_firebase()
    except Exception:
        raise HTTPException(status_code=503, detail="שירות האימות אינו זמין כעת. פנה למנהל המערכת.")
    try:
        token   = credentials.credentials
        decoded = auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="טוקן לא תקין או פג תוקף. התחבר מחדש.")

