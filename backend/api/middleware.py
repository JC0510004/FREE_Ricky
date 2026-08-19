import logging
import time
from django.core.cache import cache
from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger('seguridad')

CACHE_PREFIX_IP = 'bf_ip:'
CACHE_PREFIX_BLOCK = 'bf_block:'

LOCKOUT_MINUTES = [15, 60, 360, 1440]

# Endpoints that record failures for IP-level brute force blocking
BRUTE_FORCE_PATHS = (
    '/api/login/',
    '/api/register/',
    '/api/password-reset/',
    '/api/password-reset/confirm/',
    '/api/password-reset/verificar-codigo/',
    '/api/cambiar-password/',
)


def get_client_ip(request):
    """Extrae la IP real del cliente, saltándose proxies de confianza.

    Usa django-ipware que respeta el orden de X-Forwarded-For / X-Real-IP
    y descarta las IPs de TRUSTED_PROXIES configuradas en settings.
    """
    from ipware import get_client_ip as _get_client_ip
    ip, _ = _get_client_ip(
        request,
        request_header_order=['X_FORWARDED_FOR', 'X_REAL_IP'],
        proxy_trusted_ips=settings.TRUSTED_PROXIES,
    )
    if ip:
        return ip
    return request.META.get('REMOTE_ADDR')


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        response['X-XSS-Protection'] = '1; mode=block'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        response['Cache-Control'] = 'no-store, max-age=0'
        response['Pragma'] = 'no-cache'
        response['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data:; "
            "connect-src 'self'; "
            "frame-ancestors 'none'; "
            "form-action 'self'"
        )
        return response


class AuditLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start_time = time.time()
        response = self.get_response(request)
        duration = time.time() - start_time

        if request.path.startswith('/api/'):
            user_id = getattr(request.user, 'id', None) if request.user.is_authenticated else None
            username = getattr(request.user, 'username', None) if request.user.is_authenticated else None
            extra = {
                'method': request.method,
                'path': request.path,
                'status': response.status_code,
                'duration_ms': round(duration * 1000, 2),
                'ip': get_client_ip(request),
                'user_agent': (request.META.get('HTTP_USER_AGENT', '') or '')[:200],
                'user_id': user_id or '',
                'username': username or '',
            }

            if response.status_code >= 400:
                logger.warning(f"Request {request.method} {request.path} -> {response.status_code}", extra=extra)
            else:
                logger.info(f"Request {request.method} {request.path} -> {response.status_code}", extra=extra)

        return response


class BruteForceIPMiddleware:
    MAX_ATTEMPTS = 10
    WINDOW_SECONDS = 900
    BLOCK_SECONDS = 1800

    def __init__(self, get_response):
        self.get_response = get_response

    def _get_block_key(self, ip):
        return f'{CACHE_PREFIX_BLOCK}{ip}'

    def _get_attempts_key(self, ip, path_prefix):
        return f'{CACHE_PREFIX_IP}{ip}:{path_prefix}'

    def _is_blocked(self, ip):
        return cache.get(self._get_block_key(ip)) is not None

    def _record_failure(self, ip, path_prefix):
        key = self._get_attempts_key(ip, path_prefix)
        attempts = cache.get(key, 0) + 1
        cache.set(key, attempts, self.WINDOW_SECONDS)

        if attempts >= self.MAX_ATTEMPTS:
            cache.set(self._get_block_key(ip), True, self.BLOCK_SECONDS)
            logger.warning(f"IP bloqueada por ataque: {ip} ({attempts} intentos en {path_prefix})")
            return True
        return False

    def _get_path_prefix(self, path):
        best = None
        for prefix in BRUTE_FORCE_PATHS:
            if path.startswith(prefix):
                if best is None or len(prefix) > len(best):
                    best = prefix
        return best

    def __call__(self, request):
        ip = get_client_ip(request)

        if not ip:
            return self.get_response(request)

        if self._is_blocked(ip):
            path_prefix = self._get_path_prefix(request.path)
            if path_prefix is not None and request.method == 'POST':
                logger.warning(f"Request bloqueado por IP: {ip} {request.method} {request.path}")
                return JsonResponse(
                    {'error': 'Demasiados intentos. IP bloqueada temporalmente'},
                    status=429
                )

        response = self.get_response(request)

        path_prefix = self._get_path_prefix(request.path)
        if (
            path_prefix is not None
            and request.method == 'POST'
            and response.status_code in (400, 401, 403, 429)
        ):
            self._record_failure(ip, path_prefix)

        return response
