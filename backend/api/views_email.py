import hashlib
import logging

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import serializers, status
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema, inline_serializer

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Usuario, VerificacionEmail
from .throttles import VerificacionThrottle, ReenviarVerificacionThrottle
from .views_auth import _enviar_verificacion_email, _set_refresh_cookie

logger = logging.getLogger('seguridad')
audit_logger = logging.getLogger('auditoria')


class VerificarEmailView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [VerificacionThrottle]

    @extend_schema(
        tags=['Autenticación'],
        summary='Confirmar correo electrónico',
        description='Valida el token recibido por email y marca el correo del usuario '
        'como verificado. En la reactivación de cuentas desactivadas, este token '
        'además vuelve a activar la cuenta.',
        request=inline_serializer(
            'VerificarEmailRequest',
            {'token': serializers.CharField()},
        ),
        responses={
            200: inline_serializer(
                'VerificarEmailOK',
                {
                    'mensaje': serializers.CharField(),
                    'is_verified': serializers.BooleanField(),
                    'usuario': inline_serializer(
                        'VerificarEmailUsuario',
                        {
                            'id': serializers.IntegerField(),
                            'username': serializers.CharField(),
                            'email': serializers.EmailField(),
                            'rol': serializers.CharField(),
                            'fecha_registro': serializers.DateTimeField(allow_null=True),
                            'is_verified': serializers.BooleanField(),
                            'last_login': serializers.DateTimeField(allow_null=True),
                        },
                    ),
                    'access_token': serializers.CharField(),
                },
            ),
            400: inline_serializer(
                'VerificarEmailError',
                {'error': serializers.CharField()},
            ),
        },
    )
    def post(self, request):
        token = request.data.get('token', '')

        # El tipo se comprueba antes de usarlo. Sin esto, un cuerpo como
        # {"token": {"a": 1}} o {"token": ["x"]} llega aquí como dict o list y
        # revienta con AttributeError al llamar a .encode(), es decir un 500 en
        # un endpoint público y sin autenticar, por una entrada mal formada que
        # solo debería ser un 400.
        if not isinstance(token, str) or not token:
            return Response(
                {'error': 'Token requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        try:
            registro = VerificacionEmail.objects.select_related('usuario').get(token_hash=token_hash)
        except VerificacionEmail.DoesNotExist:
            return Response(
                {'error': 'Token inválido o expirado'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if registro.is_expired:
            # NO se borra el registro: el usuario llega aquí porque su enlace
            # caducó y en esta misma página pulsará 'Reenviar'. El reenvío sin
            # sesión identifica la cuenta por este token y manda un correo nuevo
            # sin tener que escribir el email a mano (flujo del navegador del
            # móvil). Si lo borrásemos aquí, el token expirado dejaría de
            # resolver y 'Reenviar' volvería a pedir el correo tecleado.
            return Response(
                {'error': 'Token inválido o expirado'},
                status=status.HTTP_400_BAD_REQUEST
            )

        usuario = registro.usuario

        # Una cuenta cerrada por un administrador no se reabre validando un
        # email, aunque el token sea auténtico. Este endpoint es público, así
        # que si llegara aquí un VerificacionEmail de una cuenta desactivada
        # (por un fallo previo del borrado, por un registro en curso, o por
        # cualquier otra vía) bastaría con comprobar que el token es válido
        # para devolverle el acceso a alguien que el admin decidió expulsar.
        # La única forma de revertir el cierre es que lo haga un admin.
        if usuario.desactivado_por_admin:
            registro.delete()
            logger.warning(
                f"Intento de verificar una cuenta desactivada por admin: {usuario.username}",
                extra={'user_id': usuario.id, 'username': usuario.username},
            )
            audit_logger.warning(
                f"VERIFICACION RECHAZADA (cuenta desactivada por admin) "
                f"user_id={usuario.id} username={usuario.username}"
            )
            return Response(
                {'error': 'Esta cuenta está desactivada. Contacta con el administrador '
                          'para reactivarla'},
                status=status.HTTP_400_BAD_REQUEST
            )

        usuario.is_verified = True
        usuario.is_active = True
        usuario.save(update_fields=['is_verified', 'is_active'])
        registro.delete()

        logger.info(
            f"Email verificado: {usuario.username}",
            extra={'user_id': usuario.id}
        )
        audit_logger.info(f"EMAIL_VERIFICADO user_id={usuario.id} username={usuario.username}")

        # Auto-login igual que en el restablecimiento de contraseña: el enlace
        # verificado demuestra la posesión del correo, así que se abren tokens y
        # cookie de refresh. Hace que el flujo (sobre todo desde el navegador
        # interno del móvil, sin sesión previa) termine jugando sin otro login.
        refresh = RefreshToken.for_user(usuario)
        refresh['username'] = usuario.username
        refresh['rol'] = usuario.rol
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        response = Response(
            {
                'mensaje': 'Correo verificado',
                'is_verified': True,
                'usuario': {
                    'id': usuario.id,
                    'username': usuario.username,
                    'email': usuario.email,
                    'rol': usuario.rol,
                    'fecha_registro': usuario.fecha_registro.isoformat() if usuario.fecha_registro else None,
                    'is_verified': True,
                    'last_login': usuario.last_login.isoformat() if usuario.last_login else None,
                },
                'access_token': access_token,
            }
        )
        _set_refresh_cookie(response, refresh_token)
        return response


class ReenviarVerificacionView(APIView):
    # La autenticación NO es obligatoria: el reenvío tiene que funcionar desde
    # el navegador interno del correo en el móvil, donde el enlace se abre en un
    # contexto sin sesión ni cookie. Con token JWT se usa el usuario autenticado;
    # sin él, la cuenta se identifica por el token del enlace o por el email del
    # cuerpo. En los tres casos la respuesta es genérica para no delatar si la
    # cuenta existe.
    authentication_classes = [JWTAuthentication]
    permission_classes = [AllowAny]
    # Envia un correo: tiene que tener topo aunque sea autenticado. Sin esto
    # un usuario podia reenviar sin limite (y llenar la bandeja de correos).
    throttle_classes = [ReenviarVerificacionThrottle]

    @extend_schema(
        tags=['Autenticación'],
        summary='Reenviar correo de verificación',
        description='Genera y envía un nuevo token de verificación. Con sesión '
        'JWT usa la cuenta autenticada. Sin sesión identifica la cuenta por el '
        'token del enlace (basta pulsar el botón desde la página del correo en '
        'el móvil, sin teclear nada) o, si el token no resuelve, por el email '
        'del cuerpo. La respuesta es genérica, igual que en /password-reset/: '
        'no confirma si una cuenta existe. Los tokens anteriores siguen siendo '
        'válidos hasta usarse o expirar: ningún enlace recibido se pierde.',
        request=inline_serializer(
            'ReenviarVerificacionRequest',
            {
                'token': serializers.CharField(required=False, allow_blank=True),
                'email': serializers.EmailField(required=False),
            },
        ),
        responses={
            200: inline_serializer(
                'ReenviarVerificacionOK',
                {'mensaje': serializers.CharField()},
            ),
            400: inline_serializer(
                'ReenviarVerificacionError',
                {'error': serializers.CharField()},
            ),
        },
    )
    def post(self, request):
        usuario_autenticado = request.user
        if usuario_autenticado and usuario_autenticado.is_authenticated:
            if usuario_autenticado.is_verified:
                return Response({'mensaje': 'Tu correo ya está verificado'})

            _enviar_verificacion_email(usuario_autenticado)
            logger.info(
                f"Reenvío de verificación de email: {usuario_autenticado.username}",
                extra={'user_id': usuario_autenticado.id}
            )
            return Response({'mensaje': 'Correo de verificación enviado'})

        # Sin sesión: la cuenta se identifica por el token del enlace o por el
        # email. El token manda: el usuario está en la página que falló y no
        # debe escribir su correo a mano. Si el token no resuelve (enlace roto
        # o ya usado) se cae al email del cuerpo. Todo caso no enviable
        # (cuenta inexistente, ya verificada o desactivada por admin) responde
        # exactamente lo mismo, para no servir de oráculo de existencia de
        # cuentas — idéntico criterio al de /password-reset/.
        token = request.data.get('token', '')
        email = request.data.get('email', '')

        usuario_envio = None
        if isinstance(token, str) and token.strip():
            token_hash = hashlib.sha256(token.strip().encode()).hexdigest()
            registro = (
                VerificacionEmail.objects.select_related('usuario')
                .filter(token_hash=token_hash)
                .first()
            )
            if registro:
                candidato = registro.usuario
                if not candidato.is_verified and not candidato.desactivado_por_admin:
                    usuario_envio = candidato
                else:
                    # El token identifica una cuenta que no necesita (o no puede)
                    # reenviar: misma genérica sin enviar, como en el email.
                    logger.info(
                        "Reenvío sin sesión no aplicado por token (respuesta genérica)"
                    )
                    return Response({'mensaje': 'Correo de verificación enviado'})

        if usuario_envio is None and isinstance(email, str) and email.strip() and '@' in email:
            candidato = Usuario.objects.filter(email__iexact=email.strip()).first()
            if (
                candidato
                and not candidato.is_verified
                and not candidato.desactivado_por_admin
            ):
                usuario_envio = candidato

        if usuario_envio is not None:
            _enviar_verificacion_email(usuario_envio)
            logger.info(
                f"Reenvío de verificación de email (sin sesión): {usuario_envio.username}",
                extra={'user_id': usuario_envio.id}
            )
            return Response({'mensaje': 'Correo de verificación enviado'})

        # Un email valido en el cuerpo sigue respondiendo genérico aunque la
        # cuenta no exista / esté verificada (anti enumeración): solo cuando no
        # hay ni token resoluble ni email se devuelve 400 para pedirlos.
        if isinstance(email, str) and email.strip() and '@' in email:
            logger.info(
                "Reenvío de verificación sin sesión no aplicado (respuesta genérica)"
            )
            return Response({'mensaje': 'Correo de verificación enviado'})

        return Response(
            {'error': 'Correo requerido'},
            status=status.HTTP_400_BAD_REQUEST
        )
