import sys
import os

# Add the backend directory to Python path so tests can import engine, firebase_auth, main
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

os.environ.setdefault("OPENROUTER_API_KEY", "test-key-mock")
os.environ.setdefault("FIREBASE_CREDENTIALS_PATH", "/tmp/fake-key.json")
os.environ.setdefault("ALLOWED_ORIGINS", "http://localhost:3000")