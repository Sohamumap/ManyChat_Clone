import base64
import hashlib
import hmac
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from cryptography.fernet import Fernet, InvalidToken

from app.config import get_settings

SESSION_COOKIE = "session"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), password_hash.encode())
    except ValueError:
        return False


def create_session_token(user_id: int) -> str:
    settings = get_settings()
    now = datetime.now(UTC)
    claims = {"sub": str(user_id), "iat": now, "exp": now + timedelta(days=settings.session_days)}
    return jwt.encode(claims, settings.secret_key, algorithm="HS256")


def decode_session_token(token: str) -> int | None:
    try:
        claims = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
        return int(claims["sub"])
    except (jwt.PyJWTError, KeyError, ValueError):
        return None


def create_state_token(purpose: str, minutes: int = 15) -> str:
    """Short-lived signed token, used as the OAuth `state` parameter."""
    now = datetime.now(UTC)
    claims = {"purpose": purpose, "exp": now + timedelta(minutes=minutes)}
    return jwt.encode(claims, get_settings().secret_key, algorithm="HS256")


def verify_state_token(token: str, purpose: str) -> bool:
    try:
        claims = jwt.decode(token, get_settings().secret_key, algorithms=["HS256"])
    except jwt.PyJWTError:
        return False
    return claims.get("purpose") == purpose


def _fernet() -> Fernet:
    digest = hashlib.sha256(("token-encryption:" + get_settings().secret_key).encode()).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: str) -> str:
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Could not decrypt token; was SECRET_KEY changed?") from exc


def verify_webhook_signature(body: bytes, signature_header: str | None, app_secret: str) -> bool:
    """Validate Meta's X-Hub-Signature-256 header ("sha256=<hex hmac of raw body>")."""
    if not signature_header or not app_secret:
        return False
    algo, _, received = signature_header.partition("=")
    if algo != "sha256" or not received:
        return False
    expected = hmac.new(app_secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received)
