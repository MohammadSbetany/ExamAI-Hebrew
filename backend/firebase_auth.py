import os
import json
import logging
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth

logger = logging.getLogger("examai.auth")

# ─────────────────────────────────────────────────────────────────────────────
# 🔧 SETUP: provide the Firebase Admin service-account credentials one of these
# ways (checked in this order):
#   1. FIREBASE_CREDENTIALS_JSON — the whole service-account JSON as a single
#      env value (best for hosts that manage everything through one env file;
#      no separate file to place on the server)
#   2. FIREBASE_CREDENTIALS_PATH — path to the service-account JSON file. It is
#      tried as given (relative to the working directory) AND relative to the
#      backend/ directory, so it works regardless of where the process starts.
#   3. serviceAccountKey.json next to this file, or in the working directory.
# ─────────────────────────────────────────────────────────────────────────────

_initialized = False


def _candidate_paths() -> list[str]:
    """All the places a service-account JSON file might live, in priority order."""
    here = os.path.dirname(os.path.abspath(__file__))
    cwd = os.getcwd()
    configured = os.environ.get("FIREBASE_CREDENTIALS_PATH")
    paths: list[str] = []
    if configured:
        paths.append(configured)                       # as given (relative to CWD, or absolute)
        if not os.path.isabs(configured):
            paths.append(os.path.join(here, configured))  # relative to backend/
            paths.append(os.path.join(cwd, configured))   # explicit CWD join
    paths.append(os.path.join(here, "serviceAccountKey.json"))  # default next to the code
    paths.append(os.path.join(cwd, "serviceAccountKey.json"))   # default in the working dir
    # De-dupe while preserving order
    seen: set[str] = set()
    return [p for p in paths if not (p in seen or seen.add(p))]


def _load_credentials() -> credentials.Certificate:
    """Build the Firebase credential from env-var JSON or the first JSON file found."""
    cred_json = os.environ.get("FIREBASE_CREDENTIALS_JSON")
    if cred_json and cred_json.strip():
        return credentials.Certificate(json.loads(cred_json))

    for path in _candidate_paths():
        if path and os.path.exists(path):
            return credentials.Certificate(path)

    raise FileNotFoundError(
        "Firebase service-account credentials not found. Set FIREBASE_CREDENTIALS_JSON, "
        "or provide the JSON file via FIREBASE_CREDENTIALS_PATH / serviceAccountKey.json. "
        "Looked in: " + ", ".join(_candidate_paths())
    )

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

