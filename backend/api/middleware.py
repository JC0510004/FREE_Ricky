import logging
import time
from django.utils import timezone

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
