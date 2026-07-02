import os
import json
import logging
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth

logger = logging.getLogger("examai.auth")

# ─────────────────────────────────────────────────────────────────────────────
# 🔧 SETUP: provide the Firebase Admin service-account credentials one of three
# ways (checked in this order):
#   1. FIREBASE_CREDENTIALS_JSON — the whole service-account JSON as a single
#      env value (best for hosts that manage everything through one env file;
#      no separate file to place on the server)
#   2. FIREBASE_CREDENTIALS_PATH — path to the service-account JSON file
#      (absolute, or relative to the backend/ directory)
#   3. backend/serviceAccountKey.json — default file location
# ─────────────────────────────────────────────────────────────────────────────

_initialized = False

def _load_credentials() -> credentials.Certificate:
    """Build the Firebase credential from env-var JSON or a JSON file."""
    cred_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
    if cred_json and cred_json.strip():
        return credentials.Certificate(json.loads(cred_json))

    cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH") or os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")
    if not os.path.isabs(cred_path):
        cred_path = os.path.join(os.path.dirname(__file__), cred_path)
    return credentials.Certificate(cred_path)

def _init_firebase():
    """Initialize the Firebase Admin SDK once, lazily.

    Called on first token verification (not at import) so that missing or
    misplaced credentials do not crash the whole app on startup — which would
    take the entire API down with a 502.
    """
    global _initialized
    if not _initialized:
        firebase_admin.initialize_app(_load_credentials())
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
    except Exception as exc:
        # Surface the real reason in the server logs (missing file, bad JSON,
        # wrong path…) while keeping the client-facing message generic.
        logger.error("Firebase Admin initialization failed: %s", exc)
        raise HTTPException(status_code=503, detail="שירות האימות אינו זמין כעת. פנה למנהל המערכת.")
    try:
        token   = credentials.credentials
        decoded = auth.verify_id_token(token)
        return decoded
    except Exception:
        raise HTTPException(status_code=401, detail="טוקן לא תקין או פג תוקף. התחבר מחדש.")

