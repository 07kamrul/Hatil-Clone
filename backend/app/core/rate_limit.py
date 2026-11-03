from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import get_settings

limiter = Limiter(key_func=get_remote_address, enabled=get_settings().rate_limit_enabled)

PUBLIC_POST_LIMIT = get_settings().rate_limit_public_post
LOGIN_LIMIT = get_settings().rate_limit_login
