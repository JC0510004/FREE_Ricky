import logging

from django.conf import settings
from django.db import transaction

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers, status
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from drf_spectacular.utils import extend_schema, inline_serializer

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken

from .models import Usuario, VerificacionEmail
from .serializers import UsuarioSerializer
from .permissions import IsAdminRole
from .email_utils import enviar_email
from .utils import check_password_strength
from .throttles import ChangePasswordThrottle

logger = logging.getLogger('seguridad')
audit_logger = logging.getLogger('auditoria')


class UsuarioListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, IsAdminRole]
    pagination_class = PageNumberPagination
    page_size = 50

    @extend_schema(
        tags=['Usuarios'],
        summary='Listar usuarios',
        description='Devuelve la lista paginada de usuarios activos. Solo administradores.',
        responses={200: UsuarioSerializer(many=True)},
    )
    def get(self, request):
        usuarios = Usuario.objects.filter(is_active=True)
        paginator = self.pagination_class()
        paginator.page_size = self.page_size
        page_obj = paginator.paginate_queryset(usuarios, request)
        serializer = UsuarioSerializer(page_obj, many=True)
        return paginator.get_paginated_response(serializer.data)


class UsuarioDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Usuario.objects.get(pk=pk)
        except Usuario.DoesNotExist:
            return None

    @extend_schema(
        tags=['Usuarios'],
        summary='Detalle de usuario',
        description='Devuelve el perfil de un usuario. Un usuario solo ve su propio perfil; '
        'los administradores pueden ver cualquier perfil.',
        responses={
            200: UsuarioSerializer,
            403: inline_serializer(
                'UsuarioForbidden',
                {'error': serializers.CharField()},
            ),
            404: inline_serializer(
                'UsuarioNotFound',
                {'error': serializers.CharField()},
            ),
        },
    )
    def get(self, request, pk):
        usuario = self.get_object(pk)
        if not usuario:
            return Response(
                {'error': 'No encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        if request.user.id != usuario.id and request.user.rol != 'admin':
            return Response(
                {'error': 'No autorizado'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = UsuarioSerializer(usuario)
        return Response(serializer.data)

    @extend_schema(
        tags=['Usuarios'],
        summary='Actualizar perfil',
        description='Actualiza parcialmente el perfil de un usuario (username/email). '
        'Un usuario solo edita su propio perfil; los administradores pueden editar cualquier perfil.',
        request=UsuarioSerializer,
        responses={
            200: inline_serializer(
                'UsuarioUpdateOK',
                {
                    'mensaje': serializers.CharField(),
                    'usuario': UsuarioSerializer(),
                },
            ),
            400: inline_serializer(
                'UsuarioUpdateError400',
                {'error': serializers.CharField(required=False)},
            ),
            403: inline_serializer(
                'UsuarioUpdateForbidden',
                {'error': serializers.CharField()},
            ),
            404: inline_serializer(
                'UsuarioUpdateNotFound',
                {'error': serializers.CharField()},
            ),
        },
    )
    def put(self, request, pk):
        usuario = self.get_object(pk)
        if not usuario:
            return Response(
                {'error': 'No encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        if request.user.id != usuario.id and request.user.rol != 'admin':
            return Response(
                {'error': 'No autorizado'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = UsuarioSerializer(usuario, data=request.data, partial=True, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            logger.info(
                f"Usuario actualizado: {usuario.id}",
                extra={'user_id': request.user.id}
            )
            audit_logger.info(f"PERFIL ACTUALIZADO user_id={usuario.id} por admin={request.user.id}")
            return Response({'mensaje': 'Actualizado', 'usuario': serializer.data})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        tags=['Usuarios'],
        summary='Desactivar usuario',
        description='Desactiva (soft delete) un usuario. Solo administradores.',
        responses={
            200: inline_serializer(
                'UsuarioDeleted',
                {'mensaje': serializers.CharField()},
            ),
            400: inline_serializer(
                'UsuarioDeleteSelf',
                {'error': serializers.CharField()},
            ),
            403: inline_serializer(
                'UsuarioDeleteForbidden',
                {'error': serializers.CharField()},
            ),
            404: inline_serializer(
                'UsuarioDeleteNotFound',
                {'error': serializers.CharField()},
            ),
        },
    )
    def delete(self, request, pk):
        if request.user.rol != 'admin':
            return Response(
                {'error': 'No autorizado'},
                status=status.HTTP_403_FORBIDDEN
            )
        usuario = self.get_object(pk)
        if not usuario:
            return Response(
                {'error': 'No encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        if usuario.id == request.user.id:
            return Response(
                {'error': 'No puedes eliminar tu propia cuenta'},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Desactivar, marcar el cierre como decisión de admin, revocar las
        # sesiones y revocar las verificaciones de email pendientes van en la
        # MISMA transacción. Antes el delete() de VerificacionEmail quedaba
        # fuera, y entre el commit y ese delete la cuenta estaba cerrada pero
        # todavía verificable: bastaba un token vivo para devolverle el acceso
        # a quien el admin acababa de expulsar.
        #
        # select_for_update serializa contra un login o un cambio de contraseña
        # concurrente sobre la misma fila, que si no podrían sobrescribir
        # is_active con un valor viejo y dejar la cuenta medio cerrada.
        with transaction.atomic():
            usuario_bloqueado = Usuario.objects.select_for_update().get(pk=usuario.pk)
            usuario_bloqueado.is_active = False
            usuario_bloqueado.desactivado_por_admin = True
            usuario_bloqueado.save(update_fields=['is_active', 'desactivado_por_admin'])
            for ot in OutstandingToken.objects.filter(user=usuario_bloqueado):
                BlacklistedToken.objects.get_or_create(token=ot)
            # VerificarEmailView reactiva la cuenta (is_active=True) cuando el
            # token es valido, de modo que sin esto un admin que desactiva una
            # cuenta no lo impide de verdad: basta con que quedara una
            # verificacion en curso, o con pedirla de nuevo si la API de
            # reenvio lo permite, para revertir la desactivacion. Aqui el
            # admin es quien corta el circuito.
            #
            # Y la reactivacion por REGISTRO ya no puede deshacer el cierre: el
            # serializer rechaza expresamente las cuentas marcadas como
            # desactivado_por_admin, en lugar de depender de que el campo exista.
            revocados = VerificacionEmail.objects.filter(usuario=usuario_bloqueado).delete()[0]
        logger.info(
            f"Usuario desactivado: {usuario.id} ({revocados} tokens de verificación revocados)",
            extra={'user_id': request.user.id}
        )
        audit_logger.info(f"USUARIO DESACTIVADO user_id={usuario.id} por admin={request.user.id}")
        return Response(
            {'mensaje': 'Usuario desactivado'},
            status=status.HTTP_200_OK
        )


class ChangePasswordView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [ChangePasswordThrottle]

    @extend_schema(
        tags=['Usuarios'],
        summary='Cambiar contraseña',
        description='Cambia la contraseña del usuario autenticado.',
        request=inline_serializer(
            'ChangePasswordRequest',
            {
                'old_password': serializers.CharField(write_only=True),
                'new_password': serializers.CharField(write_only=True, min_length=8),
                'confirm_password': serializers.CharField(write_only=True, min_length=8),
            },
        ),
        responses={
            200: inline_serializer(
                'ChangePasswordOK',
                {'mensaje': serializers.CharField()},
            ),
            400: inline_serializer(
                'ChangePasswordError400',
                {'error': serializers.CharField(required=False)},
            ),
        },
    )
    def post(self, request):
        usuario = request.user
        # Recorta igual que LoginSerializer/RegisterSerializer (que usan el
        # trim_whitespace de DRF) ANTES de validar la fortaleza y de guardar.
        # Sin esto, una contraseña con un espacio al final ("MiPass1! ") pasa
        # la comprobación de fortaleza y se guarda CON el espacio; el login sí
        # recorta, así que el usuario teclea la contraseña correcta y el
        # sistema le dice que es incorrecta. Para siempre, porque la contraseña
        # que hay en la base de datos no es la que él cree haber puesto.
        # Era un bloqueo permanente sin salida: ni login ni reset lo arreglan
        # sin que el usuario se dé cuenta del espacio.
        old_password = str(request.data.get('old_password', '')).strip()
        new_password = str(request.data.get('new_password', '')).strip()
        confirm_password = str(request.data.get('confirm_password', '')).strip()

        if usuario.is_locked():
            return Response(
                {'error': 'Cuenta temporalmente bloqueada. Intente más tarde'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        if not usuario.check_password(old_password):
            return Response(
                {'error': 'La contraseña actual no es correcta'},
                status=status.HTTP_400_BAD_REQUEST
            )

        password_errors = check_password_strength(new_password)
        if password_errors:
            return Response(
                {'errores': {'new_password': password_errors}},
                status=status.HTTP_400_BAD_REQUEST
            )

        if new_password != confirm_password:
            return Response(
                {'error': 'Las contraseñas no coinciden'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Cambio de contraseña y revocación de las sesiones ajenas van en la
        # MISMA transacción, y esta es la parte que hay que hacer atómica:
        # antes el save() iba suelto y el bucle de blacklist después. Si algo
        # fallaba a mitad del bucle, la contraseña ya estaba cambiada pero los
        # refresh tokens de los demás dispositivos seguían vivos. El usuario
        # recibe un 500, cree que le ha cerrado las sesiones al resto y en
        # realidad no: quien tuviera un refresh token robado conservaba el
        # acceso. Ahora es todo o nada.
        #
        # El envío del email de aviso va FUERA a propósito, y no por descuido:
        # es una notificación, no parte de la garantía de seguridad, y meterlo
        # aquí dejaría una transacción abierta durante todo el SMTP (que es
        # lento y puede colgarse). Si el email falla, la contraseña sigue
        # cambiada, que es la dirección segura del fallo.
        with transaction.atomic():
            # Se relee con FOR UPDATE en lugar de usar el request.user: sin el
            # bloqueo de fila, un login fallido concurrente podía escribir
            # failed_attempts y/o locked_until DESPUÉS de que esta vista
            # los pusiera a cero, y el cambio de contraseña perdía esa
            # escritura. El bloqueo es el mismo que ya usa
            # Usuario.increment_failed_attempts, así que las dos rutas se
            # serializan de verdad.
            usuario = Usuario.objects.select_for_update().get(pk=request.user.pk)
            usuario.set_password(new_password)
            usuario.failed_attempts = 0
            usuario.locked_until = None
            usuario.save(update_fields=['password', 'failed_attempts', 'locked_until'])

            # Invalida las sesiones de TODOS los dispositivos excepto la actual
            # (cuyo refresh token viene en la cookie), para no desloguear al
            # usuario que acaba de cambiar su contraseña desde este navegador.
            current_jti = None
            raw = request.COOKIES.get('refresh_token')
            if raw:
                try:
                    current_jti = RefreshToken(raw).payload.get('jti')
                except Exception:
                    current_jti = None
            for ot in OutstandingToken.objects.filter(user=usuario).exclude(jti=current_jti):
                BlacklistedToken.objects.get_or_create(token=ot)

        # Alerta por email: si no fue el propietario quien cambió la
        # contraseña, puede reclamar y bloquear el acceso de inmediato.
        enviar_email(
            subject='Tu contraseña fue cambiada - FREE RICKY',
            message=(
                f'Hola {usuario.username}, la contraseña de tu cuenta FREE RICKY '
                'acaba de ser cambiada.\n\n'
                'Si no fuiste tú, contacta con soporte inmediatamente.'
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[usuario.email],
        )

        logger.info(f"Contraseña cambiada: {usuario.username}", extra={
            'user_id': usuario.id,
            'username': usuario.username,
        })
        audit_logger.info(f"CONTRASEÑA_CAMBIADA user_id={usuario.id} username={usuario.username}")

        return Response({'mensaje': 'Contraseña actualizada correctamente'})
