from rest_framework.throttling import AnonRateThrottle, UserRateThrottle


class LoginThrottle(AnonRateThrottle):
    scope = 'login'


class AdminLoginThrottle(AnonRateThrottle):
    # Mismo ritmo que /api/login/: el panel de administración es el activo
    # más crítico y su login tampoco debe permitir fuerza bruta por IP.
    scope = 'admin_login'


class RegisterThrottle(AnonRateThrottle):
    scope = 'register'


class PasswordResetThrottle(AnonRateThrottle):
    scope = 'password_reset'


class CodigoResetThrottle(AnonRateThrottle):
    # Scope separado del de password_reset: probar un código incorrecto varias
    # veces no debe consumir la cuota de 3/hora que limita el envío de emails.
    scope = 'password_reset_codigo'


class ChangePasswordThrottle(UserRateThrottle):
    scope = 'change_password'


class RefreshThrottle(AnonRateThrottle):
    scope = 'refresh'


class VerificacionThrottle(AnonRateThrottle):
    # Verificar un token: 5 por hora por IP. Adivinar un token de verificación
    # (hash de 128 bits) ya es inviable; el límite protege además el envío de emails.
    scope = 'verificar_email'
