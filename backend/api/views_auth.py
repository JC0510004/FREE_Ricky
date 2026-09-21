import hashlib
import logging
from uuid import uuid4

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers, status
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema, inline_serializer

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from .models import Usuario, VerificacionEmail
from .serializers import RegisterSerializer, LoginSerializer, UsuarioSerializer
from .throttles import LoginThrottle, RegisterThrottle, RefreshThrottle

logger = logging.getLogger('seguridad')
audit_logger = logging.getLogger('auditoria')


def _enviar_verificacion_email(usuario):
    """Genera y envía un token de un solo uso para confirmar el email.

    Se usa en el alta normal (confirmación de correo) y en la reactivación de
    cuentas desactivadas (donde además es la llave que vuelve a activar la
    cuenta). Almacena solo el hash SHA-256 del token.
    """
    token = uuid4().hex
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    with transaction.atomic():
        VerificacionEmail.objects.filter(usuario=usuario).delete()
        VerificacionEmail.objects.create(usuario=usuario, token_hash=token_hash)

    url = f"{settings.FRONTEND_URL}/verificar-email?token={token}"
    send_mail(
        subject='Confirma tu correo - FREE RICKY',
        message=(
            f'Hola {usuario.username}, confirma tu correo para activar tu cuenta:\n\n'
            f'{url}\n\n'
            'El enlace expira en 60 minutos.'
        ),
        html_message=(
            '<p>Hola <strong>%s</strong>, confirma tu correo para activar tu cuenta.</p>'
            '<p><a href="%s">Confirmar mi correo</a></p>'
            '<p style="font-size:12px;color:#6b7280;">El enlace expira en 60 minutos.</p>'
        ) % (usuario.username, url),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[usuario.email],
        fail_silently=True,
    )


def _set_refresh_cookie(response, response_obj):
    # Secure: en producción siempre; en DEBUG solo si se fuerza HTTPS detrás
    # del proxy (SECURE_SSL_REDIRECT=True), para no romper el desarrollo local.
    _secure = not settings.DEBUG or getattr(settings, 'SECURE_SSL_REDIRECT', False)
    response.set_cookie(
        'refresh_token',
        response_obj,
        httponly=True,
        samesite='Lax',
        max_age=86400,
        path='/api/',
        secure=_secure,
    )


def _clear_refresh_cookie(response_obj):
    response_obj.delete_cookie('refresh_token', path='/api/')


class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]

    @extend_schema(
        tags=['Autenticación'],
        summary='Registrar usuario',
        description='Registra un nuevo usuario jugador y devuelve tokens de acceso.',
        request=RegisterSerializer,
        responses={
            201: inline_serializer(
                'RegistroResponse',
                {
                    'mensaje': serializers.CharField(),
                    'usuario': inline_serializer(
                        'UsuarioInfo',
                        {
                            'id': serializers.IntegerField(),
                            'username': serializers.CharField(),
                            'email': serializers.EmailField(),
                            'rol': serializers.CharField(),
                        },
                    ),
                    'access_token': serializers.CharField(),
                },
            ),
            400: inline_serializer(
                'RegistroError',
                {'errores': serializers.DictField(child=serializers.ListField(child=serializers.CharField()))},
            ),
        },
    )
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            logger.warning(
                f"Registro fallido - validación: {serializer.errors}",
                extra={'ip': request.META.get('REMOTE_ADDR')}
            )
            return Response(
                {'errores': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        usuario = serializer.save()

        if getattr(usuario, '_reactivado', False):
            audit_logger.info(
                f"REACTIVACION cuenta desactivada id={usuario.id} "
                f"username={usuario.username} email={usuario.email}",
            )
            # La cuenta sigue inactiva: el email de verificación es la llave
            # que la activa. NO se emiten tokens de sesión.
            _enviar_verificacion_email(usuario)
            logger.info(
                f"Cuenta reactivada, pendiente de verificación: {usuario.username}",
                extra={'user_id': usuario.id, 'username': usuario.username},
            )
            return Response(
                {
                    'mensaje': 'Cuenta reactivada. Revisa tu correo para confirmar el email.',
                    'usuario': {
                        'id': usuario.id,
                        'username': usuario.username,
                        'email': usuario.email,
                        'rol': usuario.rol,
                    },
                    'is_active': usuario.is_active,
                },
                status=status.HTTP_201_CREATED,
            )

        audit_logger.info(
            f"REGISTRO nuevo usuario id={usuario.id} username={usuario.username} email={usuario.email}",
        )
        _enviar_verificacion_email(usuario)

        refresh = RefreshToken.for_user(usuario)
        refresh_token = str(refresh)
        access_token = str(refresh.access_token)

        logger.info(
            f"Registro exitoso: {usuario.username}",
            extra={'user_id': usuario.id, 'username': usuario.username}
        )

        response = Response(
            {
                'mensaje': 'Registro exitoso. Revisa tu correo para confirmar tu email.',
                'usuario': {
                    'id': usuario.id,
                    'username': usuario.username,
                    'email': usuario.email,
                    'rol': usuario.rol,
                },
                'access_token': access_token,
            },
            status=status.HTTP_201_CREATED,
        )
        _set_refresh_cookie(response, refresh_token)
        return response


class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    @extend_schema(
        tags=['Autenticación'],
        summary='Iniciar sesión',
        description='Autentica un usuario (username o email + contraseña) y devuelve un token '
        'de acceso. El refresh token se envía en una cookie HTTP-only.',
        request=LoginSerializer,
        responses={
            200: inline_serializer(
                'LoginResponse',
                {
                    'mensaje': serializers.CharField(),
                    'usuario': inline_serializer(
                        'UsuarioPerfil',
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
            400: inline_serializer('LoginError400', {'error': serializers.CharField()}),
            401: inline_serializer('LoginError401', {'error': serializers.CharField()}),
            403: inline_serializer('LoginError403', {'error': serializers.CharField()}),
            429: inline_serializer('LoginError429', {'error': serializers.CharField()}),
        },
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Credenciales inválidas'},
                status=status.HTTP_400_BAD_REQUEST
            )

        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        try:
            usuario = Usuario.objects.get(
                Q(username__iexact=username) | Q(email__iexact=username)
            )
        except Usuario.DoesNotExist:
            Usuario.dummy_check_password()
            logger.warning(
                f"Login fallido - usuario no encontrado: {username}",
                extra={'ip': request.META.get('REMOTE_ADDR')}
            )
            return Response(
                {'error': 'Credenciales incorrectas'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not usuario.is_active:
            # Ejecutamos el check de contraseña igualmente: el tiempo de
            # respuesta debe ser el mismo que para un login válido, para que
            # no se pueda diferenciar por timing (CWE-208) una cuenta inactiva.
            usuario.check_password(password)
            logger.warning(
                f"Login bloqueado - cuenta inactiva: {usuario.username}",
                extra={'user_id': usuario.id}
            )
            return Response(
                {'error': 'Cuenta desactivada'},
                status=status.HTTP_403_FORBIDDEN
            )

        if usuario.is_locked():
            usuario.check_password(password)
            remaining = max(0, int((usuario.locked_until - timezone.now()).total_seconds() / 60))
            logger.warning(
                f"Login bloqueado - cuenta temporalmente bloqueada: {usuario.username}",
                extra={'user_id': usuario.id}
            )
            return Response(
                {'error': f'Cuenta bloqueada. Intente de nuevo en {remaining} minutos'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        usuario.clear_lockout()

        if not usuario.check_password(password):
            usuario.increment_failed_attempts()
            logger.warning(
                f"Login fallido - contraseña incorrecta: {usuario.username} "
                f"(intento {usuario.failed_attempts}/5)",
                extra={'user_id': usuario.id}
            )
            return Response(
                {'error': 'Credenciales incorrectas'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        usuario.reset_failed_attempts()

        refresh = RefreshToken.for_user(usuario)
        refresh['username'] = usuario.username
        refresh['rol'] = usuario.rol
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        logger.info(
            f"Login exitoso: {usuario.username}",
            extra={
                'user_id': usuario.id,
                'username': usuario.username,
            }
        )
        audit_logger.info(f"LOGIN exitoso user_id={usuario.id} username={usuario.username}")

        response = Response(
            {
                'mensaje': 'Sesión iniciada',
                'usuario': {
                    'id': usuario.id,
                    'username': usuario.username,
                    'email': usuario.email,
                    'rol': usuario.rol,
                    'fecha_registro': usuario.fecha_registro.isoformat() if usuario.fecha_registro else None,
                    'is_verified': usuario.is_verified,
                    'last_login': usuario.last_login.isoformat() if usuario.last_login else None,
                },
                'access_token': access_token,
            }
        )
        _set_refresh_cookie(response, refresh_token)
        return response


class RefreshTokenView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RefreshThrottle]

    @extend_schema(
        tags=['Autenticación'],
        summary='Renovar token',
        description='Renueva el access token usando el refresh token (del body o de la cookie '
        'refresh_token). Rota el refresh token (el anterior queda inutilizado).',
        request=inline_serializer(
            'RefreshRequest',
            {'refresh_token': serializers.CharField(required=False)},
        ),
        responses={
            200: inline_serializer(
                'RefreshResponse',
                {'access_token': serializers.CharField()},
            ),
            400: inline_serializer('RefreshError400', {'error': serializers.CharField()}),
            401: inline_serializer('RefreshError401', {'error': serializers.CharField()}),
            500: inline_serializer('RefreshError500', {'error': serializers.CharField()}),
        },
    )
    def post(self, request):
        refresh_token = request.data.get('refresh_token') or request.COOKIES.get('refresh_token')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            refresh = RefreshToken(refresh_token)

            jti = refresh.payload.get('jti')

            # Envolvemos la rotación en una transacción con bloqueo de fila
            # sobre el OutstandingToken del refresh usado. Así, dos peticiones
            # concurrentes con el MISMO refresh no pueden emitir dos tokens
            # nuevos: la segunda espera y ve el token ya blacklisteado.
            with transaction.atomic():
                ot = (
                    OutstandingToken.objects.select_for_update().filter(jti=jti).first()
                    if jti else None
                )
                if ot and BlacklistedToken.objects.filter(token=ot).exists():
                    logger.warning(f"Refresh token ya fue blacklistado: jti={jti}")
                    return Response(
                        {'error': 'Sesión expirada. Inicie sesión nuevamente'},
                        status=status.HTTP_401_UNAUTHORIZED
                    )

                usuario = Usuario.objects.get(id=refresh.payload.get('user_id'), is_active=True)

                new_refresh = RefreshToken.for_user(usuario)
                # Conservamos los claims personalizados que sí lleva el token
                # original (username/rol) al rotarlo; RefreshToken.for_user
                # por defecto no los copia.
                new_refresh['username'] = usuario.username
                new_refresh['rol'] = usuario.rol
                access_token = str(new_refresh.access_token)
                new_refresh_token = str(new_refresh)

                refresh.blacklist()

            response = Response({
                'access_token': access_token,
            })
            _set_refresh_cookie(response, new_refresh_token)
            return response
        except (InvalidToken, TokenError, Usuario.DoesNotExist) as e:
            logger.warning(f"Refresh token inválido: {str(e)}")
            return Response(
                {'error': 'Sesión expirada. Inicie sesión nuevamente'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            logger.error(f"Error inesperado en refresh: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error interno del servidor'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class LogoutView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Autenticación'],
        summary='Cerrar sesión',
        description='Invalida el refresh token (blacklist) y limpia la cookie de sesión.',
        request=inline_serializer(
            'LogoutRequest',
            {'refresh_token': serializers.CharField(required=False)},
        ),
        responses={200: inline_serializer('LogoutResponse', {'mensaje': serializers.CharField()})},
    )
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token') or request.COOKIES.get('refresh_token')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()

            logger.info(
                f"Logout: {request.user.username}",
                extra={'user_id': request.user.id}
            )
            audit_logger.info(f"LOGOUT user_id={request.user.id} username={request.user.username}")
            response = Response({'mensaje': 'Sesión cerrada correctamente'})
            _clear_refresh_cookie(response)
            return response
        except Exception as e:
            logger.error(f"Error en logout: {str(e)}")
            response = Response({'mensaje': 'Sesión cerrada'}, status=status.HTTP_200_OK)
            _clear_refresh_cookie(response)
            return response


class VerifySessionView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Autenticación'],
        summary='Verificar sesión',
        description='Verifica que el token de acceso sea válido y devuelve el perfil del usuario autenticado.',
        responses={200: inline_serializer(
            'VerifySessionResponse',
            {
                'authenticated': serializers.BooleanField(),
                'usuario': UsuarioSerializer(),
            },
        )},
    )
    def get(self, request):
        serializer = UsuarioSerializer(request.user)
        return Response({'authenticated': True, 'usuario': serializer.data})
