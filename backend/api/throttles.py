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

    # `anon` es el scope que se usa cuando esta clase va en
    # DEFAULT_THROTTLE_CLASSES, cubriendo las vistas que no declaran
    # `throttle_classes` proprios. Sin esto, `SimpleRateThrottle.__init__` aborta
    # con "You must set either `.scope` or `.rate`".
    #
    # Antes ese hueco lo cubria `AnonRateThrottle` de DRF, que es justamente la
    # clase evadible: para una peticion autenticada devuelve `None` como clave y
    # `allow_request` la deja pasar. Aqui el nombre engaña menos de lo que parecia:
    # el bucket "anon" ahora cubre tambien a quien va con sesion, porque la clave
    # se deriva siempre de la IP.
    scope = 'anon'

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


class ConfirmarIdentidadThrottle(PublicIPThrottle):
    # POST /api/password-reset/confirmar/ - el endpoint del enlace del email que
    # marca `ConfirmacionReset.confirmado = True`. Estuvo con `AnonRateThrottle`
    # de DRF, que es evadible: autenticarse con un JWT propio devolvia `None` como
    # clave y anulaba el limite, dejando confirmaciones de token SIN TOPE. Aqui lo
    # que protege es la garantia de que el token viene del buzon: si confirmar es
    # ilimitado, "tener el token" deja de ser un requisito dificil.
    # 10 por hora: el flujo real lo usa una vez.
    scope = 'password_reset_confirmar'


class VerificarConfirmacionThrottle(PublicIPThrottle):
    # GET /api/password-reset/verificar/ - consulta si un token quedo confirmado.
    # Tambien estuvo con `AnonRateThrottle`, mismo bypass. Es un oraculo de
    # validez de tokens: aunque los tokens sean de 128 bits (invasibles a fuerza
    # bruta), un endpoint de consulta sin limite es un recurso publico y un
    # generador de logs sin control. 30 por hora da margen a un flujo real
    # (el frontend lo consulta al cargar la vista) sin abrir la puerta.
    scope = 'password_reset_verificar'
