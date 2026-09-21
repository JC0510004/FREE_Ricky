import hashlib
import logging

from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers, status
from rest_framework.views import APIView

from drf_spectacular.utils import extend_schema, inline_serializer

from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import VerificacionEmail
from .throttles import VerificacionThrottle
from .views_auth import _enviar_verificacion_email

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
                {'mensaje': serializers.CharField(), 'is_verified': serializers.BooleanField()},
            ),
            400: inline_serializer(
                'VerificarEmailError',
                {'error': serializers.CharField()},
            ),
        },
    )
    def post(self, request):
        token = request.data.get('token', '')
        if not token:
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
            registro.delete()
            return Response(
                {'error': 'Token inválido o expirado'},
                status=status.HTTP_400_BAD_REQUEST
            )

        usuario = registro.usuario
        usuario.is_verified = True
        usuario.is_active = True
        usuario.save(update_fields=['is_verified', 'is_active'])
        registro.delete()

        logger.info(
            f"Email verificado: {usuario.username}",
            extra={'user_id': usuario.id}
        )
        audit_logger.info(f"EMAIL_VERIFICADO user_id={usuario.id} username={usuario.username}")

        return Response({'mensaje': 'Correo verificado', 'is_verified': True})


class ReenviarVerificacionView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=['Autenticación'],
        summary='Reenviar correo de verificación',
        description='Genera y envía un nuevo token de verificación al correo del '
        'usuario autenticado (invalida el token anterior).',
        request=None,
        responses={
            200: inline_serializer(
                'ReenviarVerificacionOK',
                {'mensaje': serializers.CharField()},
            ),
        },
    )
    def post(self, request):
        usuario = request.user
        if usuario.is_verified:
            return Response({'mensaje': 'Tu correo ya está verificado'})

        _enviar_verificacion_email(usuario)
        logger.info(
            f"Reenvío de verificación de email: {usuario.username}",
            extra={'user_id': usuario.id}
        )
        return Response({'mensaje': 'Correo de verificación enviado'})
