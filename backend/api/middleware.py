import ipaddress
import logging
import time

from django.core.cache import cache
from django.conf import settings
from django.http import JsonResponse

logger = logging.getLogger('seguridad')

CACHE_PREFIX_IP = 'bf_ip:'
CACHE_PREFIX_BLOCK = 'bf_block:'

LOCKOUT_MINUTES = [15, 60, 360, 1440]

# Endpoints that record failures for IP-level brute force blocking.
# NOTA: /api/register/ queda fuera deliberadamente: un atacante puede provocar
# 400 a voluntad, y contar esos fallos permitiría auto-bloquear a víctimas
# (ataque de denegación de servicio por IP compartida).
# NOTA: /admin/login/ está incluido porque el panel de administración es el
# activo más crítico. Un login fallido del admin devuelve 200 (no 401/403),
# así que el Middleware por sí solo no lo cuenta: SecureAdminSite.login
# registra los fallos explícitamente vía registrar_fallo_ip().
BRUTE_FORCE_PATHS = (
    '/api/login/',
    '/api/password-reset/',
    '/api/password-reset/confirm/',
    '/api/password-reset/verificar-codigo/',
    '/api/cambiar-password/',
    '/admin/login/',
)


# Redes que consideramos proxies inversos propios (nginx). Una conexión cuyo
# REMOTE_ADDR esté en esta lista es confiable para leer headers de reenvío.
_TRUSTED_NETWORKS = []
for _net in getattr(settings, 'TRUSTED_PROXIES', ''):
    try:
        _TRUSTED_NETWORKS.append(ipaddress.ip_network(_net.strip()))
    except ValueError:
        continue


def _ip_en_proxies_confiables(ip):
    try:
        la = ipaddress.ip_address(ip or '')
    except ValueError:
        return False
    return any(la in net for net in _TRUSTED_NETWORKS)


def get_client_ip(request):
    """Extrae la IP real del cliente sin permitir spoofing de X-Forwarded-For.

    Regla que hace imposible el spoofing:
    - Si el REMOTE_ADDR NO es un proxy de confianza, el cliente conecta
      directamente: se usa REMOTE_ADDR e IGNORAMOS cualquier X-Forwarded-For
      (ahí no hay proxy nuestro que lo haya añadido).
    - Si REMOTE_ADDR SÍ es confiable (detrás de nginx), nginx fija X-Real-IP
      con $remote_addr; si existe, esa es la IP real. Como fallback se toma el
      ÚLTIMO elemento de X-Forwarded-For, que es el que nginx añade con
      $proxy_add_x_forwarded_for; cualquier elemento anterior es spoofeable.
    """
    remote_addr = request.META.get('REMOTE_ADDR') or ''

    if _ip_en_proxies_confiables(remote_addr):
        # Detrás de nuestro proxy: X-Real-IP siempre lo fija nginx con la IP
        # real del cliente (no es spoofeable a través del proxy).
        x_real_ip = (request.META.get('HTTP_X_REAL_IP') or '').strip()
        if x_real_ip:
            return x_real_ip
        xff = request.META.get('HTTP_X_FORWARDED_FOR') or ''
        ips = [p.strip() for p in xff.split(',') if p.strip()]
        if ips:
            # El último valor es el que añadió nginx = cliente real.
            return ips[-1]

    return remote_addr


def _get_block_key(ip):
    return f'{CACHE_PREFIX_BLOCK}{ip}'


def _get_attempts_key(ip, path_prefix):
    return f'{CACHE_PREFIX_IP}{ip}:{path_prefix}'


def ip_bloqueada(ip):
    """Devuelve True si la IP está en lockout por demasiados intentos fallidos."""
    return cache.get(_get_block_key(ip)) is not None


def registrar_fallo_ip(ip, path_prefix):
    """Cuenta un intento fallido de la IP para el path_prefix dado.

    Al llegar a MAX_ATTEMPTS mete la IP en lockout (BLOCK_SECONDS) y devuelve
    True. Se usa tanto por BruteForceIPMiddleware (respuestas 400/401/403/429)
    como por SecureAdminSite.login, donde el login fallido del admin devuelve
    200 y no lo detectaría el middleware solo.
    """
    key = _get_attempts_key(ip, path_prefix)
    attempts = cache.get(key, 0) + 1
    cache.set(key, attempts, BruteForceIPMiddleware.WINDOW_SECONDS)

    if attempts >= BruteForceIPMiddleware.MAX_ATTEMPTS:
        cache.set(_get_block_key(ip), True, BruteForceIPMiddleware.BLOCK_SECONDS)
        logger.warning(f"IP bloqueada por ataque: {ip} ({attempts} intentos en {path_prefix})")
        return True
    return False


class SecurityHeadersMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response['X-Content-Type-Options'] = 'nosniff'
        response['X-Frame-Options'] = 'DENY'
        # Desactivamos el filtro XSS del navegador ('0'): además de obsoleto e
        # ineficaz, nginx lo fija en '0' para no entrar en conflicto (Django
        # no puede pisar el header que nginx ya envió, doblando políticas).
        response['X-XSS-Protection'] = '0'
        response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        response['Cache-Control'] = 'no-store, max-age=0'
        response['Pragma'] = 'no-cache'
        # CSP se fija en nginx; Django solo la añade cuando NINGÚN proxy la ha
        # añadido (acceso directo a Django en desarrollo). nginx siempre envía
        # X-Forwarded-Proto; su ausencia indica acceso directo.
        if not request.META.get('HTTP_X_FORWARDED_PROTO'):
            response['Content-Security-Policy'] = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com data:; "
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

    def _is_blocked(self, ip):
        return ip_bloqueada(ip)

    def _record_failure(self, ip, path_prefix):
        return registrar_fallo_ip(ip, path_prefix)

    # Aliases estáticos para que otras vistas/tests puedan usar la misma lógica
    # de lockout sin instanciar el middleware.
    ip_bloqueada = staticmethod(ip_bloqueada)
    registrar_fallo_ip = staticmethod(registrar_fallo_ip)

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
