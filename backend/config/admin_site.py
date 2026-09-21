"""AdminSite de Django endurecido con rate limiting y lockout por IP.

El panel de administración es el activo más crítico de la aplicación, pero
el login nativo de Django admin NO tiene protección anti fuerza bruta: cada
POST con credenciales incorrectas devuelve 200 (no 401/403), así que un
middleware que solo cuente respuestas 4xx nunca lo detectaría.

Este AdminSite sustituye al `admin.site` por defecto y añade al login dos
capas equivalentes a las del /api/login/:

1. Rate limit DRF por IP (scope 'admin_login', 5/minuto): tras agotar la
   cuota, el POST ni siquiera intenta autenticar; se re-renderiza el form
   con el error "Demasiados intentos".
2. Lockout por IP: cada login fallido se registra en la caché
   (registrar_fallo_ip) con los mismos umbrales que BruteForceIPMiddleware
   (10 fallos en 15 min => IP bloqueada 30 min). Mientras la IP está en
   lockout, el middleware también corta los POST a /admin/login/ con 429.

En producción /admin/ ni siquiera se registra en las URLs (config/urls.py
lo monta solo con DEBUG=True); estas capas protegen los entornos donde sí
está montado y son defensa en profundidad si DEBUG se activara por error.
"""
import logging

from django.contrib.admin.forms import AdminAuthenticationForm
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import REDIRECT_FIELD_NAME
from django.contrib.auth.views import LoginView
from django.core.exceptions import NON_FIELD_ERRORS
from django.forms.utils import ErrorDict, ErrorList
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.urls import reverse
from django.utils.translation import gettext as _

from api.middleware import get_client_ip, ip_bloqueada, registrar_fallo_ip
from api.throttles import AdminLoginThrottle

logger = logging.getLogger('seguridad')
audit_logger = logging.getLogger('auditoria')

ADMIN_LOGIN_PATH = '/admin/login/'


class SecureAdminSite(AdminSite):
    def login(self, request, extra_context=None):
        """Mismo comportamiento que AdminSite.login + rate limit y lockout."""
        ip = get_client_ip(request)

        if request.method == "GET" and self.has_permission(request):
            index_path = reverse("admin:index", current_app=self.name)
            return HttpResponseRedirect(index_path)

        context = {
            **self.each_context(request),
            "title": _("Log in"),
            "subtitle": None,
            "app_path": request.get_full_path(),
            "username": request.user.get_username(),
        }
        if (
            REDIRECT_FIELD_NAME not in request.GET
            and REDIRECT_FIELD_NAME not in request.POST
        ):
            context[REDIRECT_FIELD_NAME] = reverse("admin:index", current_app=self.name)

        if request.method == "POST" and ip:
            if ip_bloqueada(ip):
                logger.warning(f"[AdminLogin] POST bloqueado por lockout: {ip}")
                return self._login_response(
                    request,
                    context,
                    "Demasiados intentos fallidos. IP bloqueada temporalmente.",
                )

            throttle = AdminLoginThrottle()
            if not throttle.allow_request(request, self):
                wait = int(throttle.wait() or 60)
                logger.warning(
                    f"[AdminLogin] Rate limit excedido por IP {ip} (espera {wait}s)"
                )
                return self._login_response(
                    request,
                    context,
                    f"Demasiados intentos de inicio de sesión. Espere unos "
                    f"{max(1, wait // 60)} minuto(s).",
                )

        context.update(extra_context or {})

        defaults = {
            "extra_context": context,
            "authentication_form": self.login_form or AdminAuthenticationForm,
            "template_name": self.login_template or "admin/login.html",
        }
        request.current_app = self.name
        response = LoginView.as_view(**defaults)(request)

        # El login de Django admin devuelve 200 en fallo (no 401/403): sin esta
        # llamada, el middleware de brute force no contaría nunca el fallo.
        if request.method == "POST" and ip and response.status_code == 200:
            registrar_fallo_ip(ip, ADMIN_LOGIN_PATH)

        return response

    def _login_response(self, request, context, message):
        """Renderiza admin/login.html con un error global sin validar credenciales."""
        form = (self.login_form or AdminAuthenticationForm)(
            request, data=request.POST or None
        )
        form._errors = ErrorDict({NON_FIELD_ERRORS: ErrorList([message])})
        context = {**context, "form": form}
        return render(request, "admin/login.html", context)


# Instancia única del sitio seguro, usada en config/urls.py y api/admin.py.
secure_admin_site = SecureAdminSite(name='admin')
