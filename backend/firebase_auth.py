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
    global _initialized
    if not _initialized:
        cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH", os.path.join(os.path.dirname(__file__), "serviceAccountKey.json"))
        cred = credentials.Certificate(cred_path)
        firebase_admin.initialize_app(cred)
        _initialized = True

_init_firebase()

bearer_scheme = HTTPBearer()

def verify_token(credentials: HTTPAuthorizationCredentials = Security(bearer_scheme)) -> dict:
    """
    FastAPI dependency — verifies the Firebase ID token from the Authorization header.
    Use as: user = Depends(verify_token)
    Returns the decoded token dict with uid, email, etc.
    """
    try:
        token   = credentials.credentials
        decoded = auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="טוקן לא תקין או פג תוקף. התחבר מחדש.")

