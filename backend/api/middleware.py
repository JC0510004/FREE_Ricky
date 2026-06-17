import logging
import time
from collections import defaultdict
from django.utils import timezone
from django.http import JsonResponse

logger = logging.getLogger('seguridad')


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
            "connect-src 'self' http://127.0.0.1:5173; "
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
                'ip': request.META.get('REMOTE_ADDR', ''),
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
    WINDOW_MINUTES = 15
    BLOCK_MINUTES = 30

    def __init__(self, get_response):
        self.get_response = get_response
        self._attempts = {}
        self._blocked_ips = {}

    def _cleanup(self):
        now = time.time()
        cutoff = now - self.WINDOW_MINUTES * 60
        for ip in list(self._attempts.keys()):
            self._attempts[ip] = [t for t in self._attempts[ip] if t > cutoff]
            if not self._attempts[ip]:
                del self._attempts[ip]

    def _is_blocked(self, ip):
        now = time.time()
        blocked_until = self._blocked_ips.get(ip, 0)
        if blocked_until > now:
            return True
        self._blocked_ips.pop(ip, None)
        return False

    def _record_failure(self, ip):
        if ip not in self._attempts:
            self._attempts[ip] = []
        self._attempts[ip].append(time.time())
        self._cleanup()
        if len(self._attempts[ip]) >= self.MAX_ATTEMPTS:
            self._blocked_ips[ip] = time.time() + self.BLOCK_MINUTES * 60
            logger.warning(f"IP bloqueada por ataque: {ip}")
            return True
        return False

    def __call__(self, request):
        ip = request.META.get('REMOTE_ADDR', '')

        if ip and self._is_blocked(ip):
            logger.warning(f"Request bloqueado por IP: {ip} {request.method} {request.path}")
            return JsonResponse(
                {'error': 'Demasiados intentos. IP bloqueada temporalmente'},
                status=429
            )

        response = self.get_response(request)

        if (
            request.path.startswith('/api/login/')
            and request.method == 'POST'
            and response.status_code in (401, 403, 429)
        ):
            self._record_failure(ip)

        return response
