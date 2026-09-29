import hashlib

from rest_framework.throttling import SimpleRateThrottle, UserRateThrottle

from .middleware import get_client_ip


class PublicIPThrottle(SimpleRateThrottle):
    """Throttle para endpoints publicos, siempre por IP.

    `AnonRateThrottle` de DRF devuelve `None` desde `get_cache_key` cuando la
    peticion llega autenticada, y `allow_request` deja pasar todo lo que no
    tenga clave. Como DRF ejecuta `perform_authentication()` antes de
    `check_throttles()`, un atacante que se registre una vez y adjunte su JWT
    estaba esquivando todos los limites publicos (login, registro, reset...).

    Aqui la clave se deriva SIEMPRE de la IP, exista o no sesion, de modo que
    el limite no se puede eludir autenticandose.

    La IP se resuelve con `middleware.get_client_ip` y no con `NUM_PROXIES` a
    proposito. `NUM_PROXIES` hace que DRF lea el ULTIMO elemento de
    `X-Forwarded-For`, que es justo el campo que puede escribir el cliente: con
    el, basta con mandar otra cabecera en cada peticion para obtener una cubeta
    nueva por intento y no agotar nunca la cuota. `get_client_ip` solo honra el
    header si quien llama (`REMOTE_ADDR`) es un proxy de confianza de
    `TRUSTED_PROXIES`, y prefiere `X-Real-IP` (que nginx fija desde
    `$remote_addr`, no falsificable). Ademas asi el throttle y el middleware de
    fuerza bruta identifican al cliente con la MISMA regla: si divergieran, un
    atacante podría evadir el uno saltándose el otro.
    """

    # El bucket se clave por IP, no por usuario. Si la IP no se puede
    # determinar de forma fiable se usa una identidad fija compartida.
    def get_cache_key(self, request, view):
        return self.cache_format % {
            'scope': self.scope,
            'ident': self._get_ip_hash(request),
        }

    def _get_ip_hash(self, request):
        """Identidad de red estable, hasheada para no exponer IPs en Redis."""
        ip = get_client_ip(request) or 'ip-desconocida'
        return hashlib.sha256(ip.encode()).hexdigest()


class LoginThrottle(PublicIPThrottle):
    scope = 'login'


class AdminLoginThrottle(PublicIPThrottle):
    # Mismo ritmo que /api/login/: el panel de administracion es el activo
    # mas critico y su login tampoco debe permitir fuerza bruta por IP.
    scope = 'admin_login'


class RegisterThrottle(PublicIPThrottle):
    scope = 'register'


class PasswordResetThrottle(PublicIPThrottle):
    scope = 'password_reset'


class CodigoResetThrottle(PublicIPThrottle):
    # Scope separado del de password_reset: probar un codigo incorrecto varias
    # veces no debe consumir la cuota de 3/hora que limita el envio de emails.
    scope = 'password_reset_codigo'


class ChangePasswordThrottle(UserRateThrottle):
    # Endpoint ya autenticado: aqui si tiene sentido cuota por usuario.
    scope = 'change_password'


class RefreshThrottle(PublicIPThrottle):
    scope = 'refresh'


class VerificacionThrottle(PublicIPThrottle):
    # Verificar un token: 5 por hora por IP. Adivinar un token de verificacion
    # (hash de 128 bits) ya es inviable; el limite protege ademas el envio de emails.
    scope = 'verificar_email'
