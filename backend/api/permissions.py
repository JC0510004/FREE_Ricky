from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    def has_permission(self, request, view):
        return request.user and request.user.is_authenticated and getattr(request.user, 'rol', None) == 'admin'


class IsEmailVerified(BasePermission):
    """Exige que el correo del usuario esté verificado para poder jugar.

    Motivo: sin esto, la verificación de email era decorativa. El registro
    mandaba el correo y la vista de verificación marcaba `is_verified=True`,
    pero NINGUNA vista consultaba ese campo después. Es decir, se podía
    registrar con cualquier correo, no pulsar nunca el enlace, y jugar
    igual. El campo se escribía, pero no se leía en ningún sitio.

    Se comprueba aquí y no solo en el frontend porque deshabilitar un botón es
    cosmético: quien conozca la URL puede llamar a la API directamente. El
    backend es el único sitio donde no se puede saltar la regla.

    Decisión de producto (2026-10-01): para jugar, el correo debe estar
    verificado. No es una inferencia técnica.

    NO se exige para el resto de la API, a propósito. Entrar, ver el perfil o
    pedir un restablecimiento de contraseña deben seguir funcionando con un
    correo sin verificar: si no, el usuario que perdió su correo se quedaría
    sin poder ni recuperar su cuenta, que es justo cuando más lo necesita.
    """

    message = (
        'Debes verificar tu correo electrónico para poder jugar. '
        'Revisa tu bandeja de entrada o reenvía el correo de verificación.'
    )

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return bool(getattr(request.user, 'is_verified', False))
