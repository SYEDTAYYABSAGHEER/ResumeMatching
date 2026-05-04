import hashlib
import hmac
import secrets


def hash_password(password: str, salt: str | None = None) -> str:
    used_salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), used_salt.encode('utf-8'), 120000).hex()
    return f'{used_salt}${digest}'


def verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, _ = stored_hash.split('$', 1)
    except ValueError:
        return False
    check = hash_password(password, salt=salt)
    return hmac.compare_digest(check, stored_hash)
