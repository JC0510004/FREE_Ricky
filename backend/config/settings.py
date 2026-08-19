import os
import sys
from pathlib import Path
from decouple import config
from datetime import timedelta
import hashlib

# ─── CONFIGURACIÓN SEGURA ───────────────────────────────────────────────
# SECRET_KEY: Clave secreta usada para firmar sesiones, tokens CSRF y otros
# datos sensibles. Se obtiene de variables de entorno con fallback a python-decouple.
SECRET_KEY = os.environ.get('SECRET_KEY') or config('SECRET_KEY', default='')

# DEBUG: Bandera que activa/desactiva el modo de depuración.
# Cuando es True, Django muestra páginas de error detalladas y recarga código automáticamente.
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

# BASE_DIR: Ruta base del proyecto, usada para resolver rutas relativas
# como archivos estáticos, base de datos SQLite y archivos de logs.
BASE_DIR = Path(__file__).resolve().parent.parent

# ─── HOSTS SEGUROS ─────────────────────────────────────────────────────
# ALLOWED_HOSTS: Lista de hosts/domains que pueden servir la aplicación.
# Previene ataques de tipo Host header injection.
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', 'localhost,127.0.0.1,testserver').split(',')

# SECURE_PROXY_SSL_HEADER: Indica a Django que confíe en el header X-Forwarded-Proto
# cuando está detrás de un proxy inverso (nginx, load balancer, etc).
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# USE_X_FORWARDED_HOST: Permite que Django use el header X-Forwarded-Host
# para construir URLs correctas detrás de un proxy.
USE_X_FORWARDED_HOST = True

# TRUSTED_PROXIES: Lista de IPs/rangos de proxies que Django debe confiar
# para headers de seguridad como X-Forwarded-For.
TRUSTED_PROXIES = os.environ.get('TRUSTED_PROXIES', '127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16').split(',')

# ─── FRONTEND / API URLS (configurables por env) ───────────────────────
# FRONTEND_URL: URL base del frontend, usada en CORS y redirecciones.
# Cambia entre desarrollo (localhost:5173) y producción según entorno.
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:5173')

# API_BASE_URL: URL base de la API, usada en emails y notificaciones.
API_BASE_URL = os.environ.get('API_BASE_URL', 'http://localhost:8000')

# ─── APPLICATION DEFINITION ────────────────────────────────────────────
# AUTH_USER_MODEL: Indica a Django que el modelo de usuario personalizado
# se encuentra en la app 'api' y se llama 'Usuario'.
AUTH_USER_MODEL = 'api.Usuario'

# INSTALLED_APPS: Lista de todas las aplicaciones Django instaladas.
# Incluye las apps de Django core, terceras partes y la app local 'api'.
INSTALLED_APPS = [
    'django.contrib.admin',          # Panel de administración de Django
    'django.contrib.auth',           # Sistema de autenticación y usuarios
    'django.contrib.contenttypes',   # Framework de tipos de contenido
    'django.contrib.sessions',       # Framework de sesiones HTTP
    'django.contrib.messages',       # Framework de mensajes (flash messages)
    'django.contrib.staticfiles',    # Servidor de archivos estáticos
    # Third party - Aplicaciones de terceros
    'corsheaders',                   # Manejo de CORS (Cross-Origin Resource Sharing)
    'rest_framework',                # Django REST Framework para APIs
    'rest_framework_simplejwt',      # Autenticación JWT (JSON Web Tokens)
    'rest_framework_simplejwt.token_blacklist',  #黑名单 de tokens JWT
    'django_ratelimit',             # Limitación de tasa de peticiones
    # Local - Aplicaciones propias del proyecto
    'api',                           # App principal con modelos, vistas y lógica de negocio
]

# MIDDLEWARE: Lista de middlewares que procesan cada petición/respuesta.
# El orden importa: se ejecutan de arriba a abajo en requests y de abajo arriba en responses.
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',        # Headers de seguridad (HTTPS, HSTS, etc)
    'corsheaders.middleware.CorsMiddleware',                # Manejo de CORS - debe ir antes de CommonMiddleware
    'django.contrib.sessions.middleware.SessionMiddleware', # Manejo de sesiones
    'django.middleware.common.CommonMiddleware',            # Funcionalidad común (URL trailing slash, etc)
    'django.middleware.csrf.CsrfViewMiddleware',           # Protección CSRF (Cross-Site Request Forgery)
    'django.contrib.auth.middleware.AuthenticationMiddleware', # Asocia usuarios a requests
    'django.contrib.messages.middleware.MessageMiddleware', # Manejo de mensajes flash
    'django.middleware.clickjacking.XFrameOptionsMiddleware', # Protección clickjacking
    'api.middleware.SecurityHeadersMiddleware',             # Headers de seguridad personalizados
    'api.middleware.AuditLogMiddleware',                    # Registro de auditoría de acciones
]

# El middleware de brute force solo se carga en producción (no en tests)
# para no interferir con los tests automatizados.
if 'test' not in sys.argv:
    MIDDLEWARE.append('api.middleware.BruteForceIPMiddleware')

# ROOT_URLCONF: Ruta al archivo de configuración de URLs principal.
ROOT_URLCONF = 'config.urls'

# TEMPLATES: Configuración de plantillas Django.
# Utiliza el backend por defecto de Django con APP_DIRS=True
# para buscar plantillas dentro de cada app.
TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],                   # Sin directorios adicionales de plantillas
        'APP_DIRS': True,             # Busca plantillas en <app>/templates/
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',          # Añade request al contexto
                'django.contrib.auth.context_processors.auth',         # Añade user y perms al contexto
                'django.contrib.messages.context_processors.messages', # Añade messages al contexto
            ],
        },
    },
]

# WSGI_APPLICATION: Punto de entrada WSGI para el servidor de producción.
WSGI_APPLICATION = 'config.wsgi.application'

# ─── CACHE ─────────────────────────────────────────────────────────────
# Sistema de caché configurable: Redis en producción, LocMemCache en desarrollo.
# Es CRÍTICO para que rate limiting y brute force protection funcionen
# entre múltiples workers/procesos. Si se usa LocMemCache, cada proceso
# tiene su propia caché independiente (no compartida).
# Ejemplo Redis: CACHE_URL=redis://127.0.0.1:6379/0
_cache_url = os.environ.get('CACHE_URL', '')
if _cache_url and 'redis' in _cache_url:
    # Redis: caché compartida entre todos los workers del servidor.
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.redis.RedisCache',
            'LOCATION': _cache_url,
        }
    }
else:
    # LocMemCache: caché en memoria del proceso actual (solo para desarrollo).
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'default-cache',
        }
    }

# Lista de checks del sistema que se desactivan silenciosamente.
SILENCED_SYSTEM_CHECKS = []

# ─── DATABASE ──────────────────────────────────────────────────────────
# Configuración de base de datos dinámica según la variable DATABASE_URL.
# Soporta SQLite para desarrollo/testing y MySQL para producción.
_database_url = os.environ.get('DATABASE_URL', '')
if _database_url.startswith('sqlite'):
    # SQLite: base de datos en archivo, ideal para desarrollo y tests.
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            # Extrae la ruta del archivo de la URL. Si no hay ruta, usa :memory: (RAM).
            'NAME': _database_url.split('//', 1)[-1] if '//' in _database_url else ':memory:',
        }
    }
else:
    # MySQL: base de datos para producción, con pooling de conexiones (CONN_MAX_AGE).
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': os.environ.get('DB_NAME') or config('DB_NAME', default=''),
            'USER': os.environ.get('DB_USER') or config('DB_USER', default=''),
            'PASSWORD': os.environ.get('DB_PASSWORD') or config('DB_PASSWORD', default=''),
            'HOST': os.environ.get('DB_HOST') or config('DB_HOST', default=''),
            'PORT': os.environ.get('DB_PORT') or config('DB_PORT', default=''),
            'OPTIONS': {
                # STRICT_TRANS_TABLES: Fuerza validación estricta en tablas de transacciones.
                # Previene datos inconsistentes al rechazar valores inválidos.
                'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
            },
            # CONN_MAX_AGE: Tiempo máximo de vida de una conexión (en segundos).
            # 600 segundos = 10 minutos de reutilización de conexiones.
            'CONN_MAX_AGE': 600,
        }
    }

# ─── PASSWORD HASHING ───────────────────────────────────────────────────
# Algoritmos de hash de contraseñas, ordenados por preferencia.
# Argon2 es el más seguro (ganador del Password Hashing Competition).
# Los demás se mantienen para compatibilidad con contraseñas hasheadas anteriormente.
PASSWORD_HASHERS = [
    'django.contrib.auth.hashers.Argon2PasswordHasher',      # Más seguro (preferido)
    'django.contrib.auth.hashers.PBKDF2PasswordHasher',       # Fallback sólido
    'django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher',   # Fallback PBKDF2 con SHA1
    'django.contrib.auth.hashers.BCryptSHA256PasswordHasher', # Alternativa BCrypt
]

# Parámetros de Argon2 optimizados según OWASP 2023.
# Estos valores equilibran seguridad y rendimiento.
ARGON2_TIMEOUT = 3                # Límite de tiempo en segundos para el hash
ARGON2_MEMORY_COST = 19456        # 19 MB de memoria requerida (mínimo OWASP 2023)
ARGON2_TIME_COST = 3              # 3 iteraciones de computación
ARGON2_PARALLELISM = 2            # 2 hilos de procesamiento paralelo

# ─── PASSWORD VALIDATION ───────────────────────────────────────────────
# Validadores que se ejecutan al crear/cambiar contraseñas.
# Aseguran que las contraseñas sean seguras y cumplan políticas básicas.
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},  # No puede ser similar al username/email
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},            # Longitud mínima (8 por defecto)
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},           # No puede ser una contraseña común
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},          # No puede ser solo números
]

# ─── REST FRAMEWORK + JWT ──────────────────────────────────────────────
# Duración de tokens JWT configurable por variables de entorno.
_access_minutes = int(os.environ.get('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', '15'))
_refresh_days = int(os.environ.get('JWT_REFRESH_TOKEN_LIFETIME_DAYS', '1'))

# Configuración global de Django REST Framework.
REST_FRAMEWORK = {
    # Autenticación por defecto: JWT (JSON Web Token).
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    # Permisos por defecto: solo usuarios autenticados pueden acceder.
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    # Paginación por número de página, 50 elementos por página.
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 50,

    # Rate limiting: limita la cantidad de peticiones por tiempo para prevenir abusos.
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',  # Limita usuarios anónimos
        'rest_framework.throttling.UserRateThrottle',   # Limita usuarios autenticados
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '60/minute',           # Anónimos: 60 peticiones por minuto
        'user': '120/minute',          # Autenticados: 120 peticiones por minuto
        'login': '5/minute',           # Login: 5 intentos por minuto (anti brute force)
        'register': '3/minute',        # Registro: 3 por minuto (anti spam)
        'password_reset': '3/hour',    # Reset password: 3 por hora
        'change_password': '10/minute', # Cambio de contraseña: 10 por minuto
    },

    # Solo renderiza JSON (sinBrowsable API por seguridad).
    'DEFAULT_RENDERER_CLASSES': (
        'rest_framework.renderers.JSONRenderer',
    ),
    # Manejador de excepciones personalizado para respuestas de error consistentes.
    'EXCEPTION_HANDLER': 'api.utils.custom_exception_handler',
}

# En modo testing, se relajan los límites de rate para no fallar tests automatizados.
if 'test' in sys.argv:
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['login'] = '100/minute'
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['register'] = '100/minute'
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['password_reset'] = '100/minute'
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['change_password'] = '100/minute'
    REST_FRAMEWORK['PAGE_SIZE'] = 100  # Más elementos por página en tests

# En modo DEBUG se relajan los límites para facilitar el desarrollo.
if DEBUG:
    REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']['password_reset'] = '60/minute'

# ─── JWT ────────────────────────────────────────────────────────────────
# JWT_SECRET_KEY: Clave separada para firmar tokens JWT.
# En producción es OBLIGATORIO definir JWT_SECRET_KEY en las variables de entorno.
# En desarrollo se genera una clave derivada de SECRET_KEY usando SHA-256.
_jwt_secret = os.environ.get('JWT_SECRET_KEY', '')
if not _jwt_secret:
    if not DEBUG:
        # En producción, sin JWT_SECRET_KEY no se puede arrancar (error de seguridad).
        raise ValueError('JWT_SECRET_KEY debe estar seteado en producción')
    # En desarrollo: derivamos una clave del SECRET_KEY para no usarlo directamente.
    _jwt_secret = hashlib.sha256(SECRET_KEY.encode()).hexdigest()

# Configuración de Simple JWT (tokens de autenticación).
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=_access_minutes),  # Vida del token de acceso
    'REFRESH_TOKEN_LIFETIME': timedelta(days=_refresh_days),      # Vida del token de refresco
    'ROTATE_REFRESH_TOKENS': True,       # Cada refresh genera un nuevo token (seguridad)
    'BLACKLIST_AFTER_ROTATION': True,     # El token viejo se invalida al rotar
    'UPDATE_LAST_LOGIN': True,            # Actualiza last_login al autenticarse
    'ALGORITHM': 'HS256',                 # Algoritmo HMAC-SHA256 para firmar
    'SIGNING_KEY': _jwt_secret,           # Clave secreta para firmar tokens
    'AUTH_HEADER_TYPES': ('Bearer',),     # Tipo de header: Authorization: Bearer <token>
    'AUTH_HEADER_NAME': 'HTTP_AUTHORIZATION',  # Nombre del header HTTP
    'USER_ID_FIELD': 'id',               # Campo del modelo que identifica al usuario
    'USER_ID_CLAIM': 'user_id',          # Claim JWT que contiene el ID del usuario
    'JTI_CLAIM': 'jti',                  # Claim JWT único por token (para blacklisting)
    'SLIDING_TOKEN_REFRESH_EXP_CLAIM': 'refresh_exp',  # Claim de expiración del refresh
}

# ─── CORS SEGURO ───────────────────────────────────────────────────────
# CORS: Cross-Origin Resource Sharing.
# Controla qué dominios externos pueden hacer peticiones a esta API.
CORS_ALLOW_ALL_ORIGINS = False  # NUNCA permitir todos los orígenes en producción
CORS_ALLOWED_ORIGINS = os.environ.get(
    'CORS_ALLOWED_ORIGINS',
    'http://localhost:5173,http://127.0.0.1:5173'  # Frontend en desarrollo (Vite)
).split(',')
CORS_ALLOW_CREDENTIALS = True   # Permite cookies y headers de autenticación
CORS_EXPOSE_HEADERS = ['Content-Type', 'X-CSRFToken']  # Headers expuestos al frontend
CORS_ALLOW_METHODS = ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT']  # Métodos HTTP permitidos
CORS_ALLOW_HEADERS = [
    'accept',           # Tipo de contenido aceptado
    'authorization',    # Header de autenticación (Bearer token)
    'content-type',     # Tipo del body de la petición
    'x-csrftoken',      # Token CSRF para proteger contra CSRF
    'x-requested-with', # Identificador de petición AJAX
    'x-client-id',      # Identificador del cliente (para auditoría)
]

# ─── SEGURIDAD DE HEADERS ──────────────────────────────────────────────
# Headers de seguridad HTTP que Django agrega automáticamente a las respuestas.
SECURE_CONTENT_TYPE_NOSNIFF = True  # Previene que el navegador adivine el tipo de contenido
X_FRAME_OPTIONS = 'DENY'           # Impide que la página se incruste en iframes (clickjacking)
SESSION_COOKIE_HTTPONLY = True      # La cookie de sesión no es accesible por JavaScript
SESSION_COOKIE_SAMESITE = 'Lax'    # Protección CSRF parcial para cookies
CSRF_COOKIE_HTTPONLY = True        # La cookie CSRF no es accesible por JavaScript
CSRF_COOKIE_SAMESITE = 'Lax'      # Misma política para la cookie CSRF

# Configuraciones adicionales SOLO en producción (no DEBUG).
if not DEBUG:
    SECURE_HSTS_SECONDS = 31536000         # HSTS: 1 año. Obliga a usar HTTPS.
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True  # HSTS aplica a todos los subdominios
    SECURE_HSTS_PRELOAD = True             # Permite incluir el dominio en listas de preload HSTS
    SECURE_BROWSER_XSS_FILTER = True       # Filtro XSS del navegador (legado pero útil)
    SESSION_COOKIE_SECURE = True           # Cookie de sesión solo se envía por HTTPS
    CSRF_COOKIE_SECURE = True              # Cookie CSRF solo se envía por HTTPS

    # SSL_REDIRECT: Redirige todas las peticiones HTTP a HTTPS.
    _ssl_redirect = os.environ.get('SECURE_SSL_REDIRECT', 'False')
    if _ssl_redirect.lower() == 'true' and 'test' not in sys.argv:
        SECURE_SSL_REDIRECT = True

# Configuración de sesiones HTTP.
SESSION_COOKIE_AGE = 1800                    # 30 minutos de expiración de sesión
SESSION_EXPIRE_AT_BROWSER_CLOSE = True       # La sesión se cierra al cerrar el navegador

# ─── INTERNATIONALIZATION ──────────────────────────────────────────────
# Configuración de idioma y zona horaria.
LANGUAGE_CODE = 'en-us'   # Idioma de la interfaz (inglés por defecto)
TIME_ZONE = 'UTC'         # Zona horaria del servidor (UTC para consistencia)
USE_I18N = True           # Activa la internacionalización
USE_TZ = True             # Activa soporte de zona horaria (almacena fechas en UTC)

# ─── LOGGING DE SEGURIDAD ──────────────────────────────────────────────
# Sistema de logging configurado para registrar eventos de seguridad y auditoría.
# Los logs se rotan automáticamente cuando alcanzan 10MB, manteniendo 10 backups.
LOGGING = {
    'version': 1,                          # Versión del formato de logging de Django
    'disable_existing_loggers': False,     # No desactiva loggers existentes de otras apps

    # Formateadores: definen cómo se estructuran los mensajes de log.
    'formatters': {
        'verbose': {
            # Formato estándar con timestamp, nivel, nombre del logger y mensaje.
            'format': '[{asctime}] {levelname} {name} {message}',
            'style': '{',
        },
        'seguridad': {
            # Formato específico para eventos de seguridad (ataques, intentos sospechosos).
            'format': '[{asctime}] {levelname} [SEGURIDAD] {message}',
            'style': '{',
        },
        'auditoria': {
            # Formato para registros de auditoría (acciones de usuarios en el sistema).
            'format': '[{asctime}] {levelname} [AUDITORIA] {message}',
            'style': '{',
        },
    },

    # Handlers: definen DÓNDE se escriben los logs.
    'handlers': {
        'console': {
            # Envía logs a la consola estándar (útil en desarrollo).
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'seguridad_file': {
            # Archivo rotatorio para logs de seguridad.
            # Máximo 10MB por archivo, 10 backups automáticos.
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'seguridad.log',
            'maxBytes': 10485760,       # 10 MB por archivo
            'backupCount': 10,          # Mantener 10 archivos de respaldo
            'formatter': 'seguridad',
        },
        'auditoria_file': {
            # Archivo rotatorio para logs de auditoría.
            'class': 'logging.handlers.RotatingFileHandler',
            'filename': BASE_DIR / 'logs' / 'auditoria.log',
            'maxBytes': 10485760,       # 10 MB por archivo
            'backupCount': 10,          # Mantener 10 archivos de respaldo
            'formatter': 'auditoria',
        },
    },

    # Loggers: conectan los formateadores con los handlers por nombre.
    'loggers': {
        'seguridad': {
            # Logger para eventos de seguridad (intentos de login fallidos, IPs bloqueadas, etc).
            'handlers': ['console', 'seguridad_file'],  # Escribe a consola Y archivo
            'level': 'INFO',              # Registra INFO y superiores
            'propagate': False,           # No propaga a loggers superiores
        },
        'auditoria': {
            # Logger para auditoría de acciones de usuarios (creaciones, actualizaciones, etc).
            'handlers': ['auditoria_file'],  # Solo escribe a archivo (no consola)
            'level': 'INFO',
            'propagate': False,
        },
        'django.request': {
            # Logger nativo de Django para peticiones HTTP con errores.
            'handlers': ['console', 'seguridad_file'],  # Loguea errores de petición en seguridad
            'level': 'ERROR',             # Solo errores
            'propagate': False,
        },
    },
}

# ─── EMAIL ──────────────────────────────────────────────────────────────
# Configuración de correo electrónico para envío de notificaciones.
_email_user = os.environ.get('EMAIL_HOST_USER', '')
_email_pass = os.environ.get('EMAIL_HOST_PASSWORD', '')

# Si hay credenciales de SMTP configuradas, usa el backend real.
# Si no, usa el backend de consola (imprime emails en la terminal, útil en desarrollo).
EMAIL_BACKEND = (
    'django.core.mail.backends.smtp.EmailBackend'
    if _email_user and _email_pass
    else 'django.core.mail.backends.console.EmailBackend'
)
EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')       # Servidor SMTP
EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))             # Puerto SMTP (587 = TLS)
EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', 'True').lower() == 'true'  # Usar cifrado TLS
EMAIL_HOST_USER = _email_user       # Usuario/correo SMTP
EMAIL_HOST_PASSWORD = _email_pass   # Contraseña SMTP (app password de Gmail)
DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'noreply@free-ricky.com')  # Email remitente

# ─── STATIC ────────────────────────────────────────────────────────────
# STATIC_URL: URL base para archivos estáticos (CSS, JS, imágenes).
STATIC_URL = 'static/'

# DEFAULT_AUTO_FIELD: Tipo de campo por defecto para claves primarias auto-generadas.
# BigAutoField (64 bits) en lugar de AutoField (32 bits) para soportar muchos registros.
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# Crear directorio de logs si no existe (necesario para los handlers de logging).
LOGS_DIR = BASE_DIR / 'logs'
os.makedirs(LOGS_DIR, exist_ok=True)
