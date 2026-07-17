import os
import sys
from pathlib import Path
from decouple import config
from datetime import timedelta
import hashlib

# ─── CONFIGURACIÓN SEGURA ───────────────────────────────────────────────
SECRET_KEY = os.environ.get('SECRET_KEY') or config('SECRET_KEY', default='')

DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

BASE_DIR = Path(__file__).resolve().parent.parent

# ─── HOSTS SEGUROS ─────────────────────────────────────────────────────
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
USE_X_FORWARDED_HOST = True
TRUSTED_PROXIES = os.environ.get('TRUSTED_PROXIES', '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16').split(',')

# ─── FRONTEND / API URLS (configurables por env) ───────────────────────
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')
API_BASE_URL = os.environ.get('API_BASE_URL', 'http://localhost:8000')

# ─── APPLICATION DEFINITION ────────────────────────────────────────────
AUTH_USER_MODEL = 'api.Usuario'

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Third party
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',
    'django_ratelimit',
    # Local
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'api.middleware.SecurityHeadersMiddleware',
    'api.middleware.AuditLogMiddleware',
]

if 'test' not in sys.argv:
    MIDDLEWARE.append('api.middleware.BruteForceIPMiddleware')

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# ─── CACHE ─────────────────────────────────────────────────────────────
# Desarrollo: LocMemCache (por proceso). Producción: usar Redis o Memcached
# para que rate limiting y brute force protection funcionen entre workers.
# Ejemplo Redis: CACHE_URL=redis://127.0.0.1:6379/0
_cache_url = os.environ.get('CACHE_URL', '')
if _cache_url and 'redis' in _cache_url:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': _cache_url,
        }
    }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'default-cache',
        }
    }

SILENCED_SYSTEM_CHECKS = ['django_ratelimit.E003', 'django_ratelimit.W001']

# ─── DATABASE ──────────────────────────────────────────────────────────
_database_url = os.environ.get('DATABASE_URL', '')
if _database_url.startswith('sqlite'):
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': _database_url.split('//', 1)[-1] if '//' in _database_url else ':memory:',
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': os.environ.get('DB_NAME') or config('DB_NAME', default=''),
            'USER': os.environ.get('DB_USER') or config('DB_USER', default=''),
            'PASSWORD': os.environ.get('DB_PASSWORD') or config('DB_PASSWORD', default=''),
            'HOST': os.environ.get('DB_HOST') or config('DB_HOST', default=''),
            'PORT': os.environ.get('DB_PORT') or config('DB_PORT', default=''),
            'OPTIONS': {
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            },
            'CONN_MAX_AGE': 600,
        }
    }

# ─── PASSWORD HASHING ───────────────────────────────────────────────────
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher',
]

ARGON2_TIMEOUT = 3
ARGON2_MEMORY_COST = 19456  # 19 MB — mínimo OWASP 2023
ARGON2_TIME_COST = 3
ARGON2_PARALLELISM = 2

# ─── PASSWORD VALIDATION ───────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─── REST FRAMEWORK + JWT ──────────────────────────────────────────────
_access_minutes = int(os.environ.get('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', '15'))
_refresh_days = int(os.environ.get('JWT_REFRESH_TOKEN_LIFETIME_DAYS', '1'))

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',
        'user': '120/minute',
        'login': '5/minute',
        'register': '3/minute',
        'password_reset': '3/hour',
        'change_password': '10/minute',
    },
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    'EXCEPTION_HANDLER': 'api.utils.custom_exception_handler',
}

if 'test' in sys.argv:
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['login'] = '100/minute'
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['register'] = '100/minute'
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['password_reset'] = '100/minute'
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['change_password'] = '100/minute'
    REST_FRAMEWORK['PAGE_SIZE'] = 100

# ─── JWT ────────────────────────────────────────────────────────────────
# Clave separada para firmar JWT. En producción, JWT_SECRET_KEY es obligatorio.
_jwt_secret = os.environ.get('JWT_SECRET_KEY', '')
if not _jwt_secret:
    if not DEBUG:
        raise ValueError('JWT_SECRET_KEY debe estar seteado en producción')
    _jwt_secret = hashlib.sha256(SECRET_KEY.encode()).hexdigest()

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=_access_minutes),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=_refresh_days),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'UPDATE_LAST_LOGIN': True,
    'ALGORITHM': 'HS256',
    'SIGNING_KEY': _jwt_secret,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'JTI_CLAIM': 'jti',
    'SLIDING_TOKEN_REFRESH_EXP_CLAIM': 'refresh_exp',
}

# ─── CORS SEGURO ───────────────────────────────────────────────────────
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173'
).split(',')
CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ['Content-Type', 'X-CSRFToken']
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']
CORS_ALLOW_HEADERS = [
    'accept', 'authorization', 'content-type', 'x-csrftoken',
    'x-requested-with', 'x-client-id',
]

# ─── SEGURIDAD DE HEADERS ──────────────────────────────────────────────
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = 'Lax'

if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True
    SECURE_BROWSER_XSS_FILTER = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True

    _ssl_redirect = os.environ.get('SECURE_SSL_REDIRECT', 'False')
    if _ssl_redirect.lower() == 'true' and 'test' not in sys.argv:
        SECURE_SSL_REDIRECT = True

SESSION_COOKIE_AGE = 1800
SESSION_EXPIRE_AT_BROWSER_CLOSE = True

# ─── INTERNATIONALIZATION ──────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# ─── LOGGING DE SEGURIDAD ──────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{asctime}] {levelname} {name} {message}',
            'style': '{',
        },
        'seguridad': {
            'format': '[{asctime}] {levelname} [SEGURIDAD] {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'seguridad_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'seguridad.log',
            'maxBytes': 10485760,
            'backupCount': 10,
            'formatter': 'seguridad',
        },
        'auditoria_file': {
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'auditoria.log',
            'maxBytes': 10485760,
            'backupCount': 10,
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'seguridad': {
            'handlers': ['console', 'seguridad_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'auditoria': {
            'handlers': ['auditoria_file'],
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console', 'seguridad_file'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}

# ─── EMAIL ──────────────────────────────────────────────────────────────
_email_user = os.environ.get('EMAIL_HOST_USER', '')
_email_pass = os.environ.get('EMAIL_HOST_PASSWORD', '')
EMAIL_BACKEND = (
    'django.core.mail.backends.smtp.EmailBackend'
    if _email_user and _email_pass
    else 'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() == 'true'
EMAIL_HOST_USER = _email_user
EMAIL_HOST_PASSWORD = _email_pass
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@free-ricky.com')

# ─── STATIC ────────────────────────────────────────────────────────────
STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Crear directorio de logs si no existe
LOGS_DIR = BASE_DIR / 'logs'
os.makedirs(LOGS_DIR, exist_ok=True)
