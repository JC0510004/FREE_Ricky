import logging

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import serializers, status
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination

from drf_spectacular.utils import extend_schema, inline_serializer

from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Usuario
from .serializers import UsuarioSerializer
from .permissions import IsAdminRole
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
        usuario.is_active = False
        usuario.save(update_fields=['is_active'])
        logger.info(
            f"Usuario desactivado: {usuario.id}",
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
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

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

        usuario.set_password(new_password)
        usuario.save(update_fields=['password'])

        logger.info(f"Contraseña cambiada: {usuario.username}", extra={
            'user_id': usuario.id,
            'username': usuario.username,
        })
        audit_logger.info(f"CONTRASEÑA_CAMBIADA user_id={usuario.id} username={usuario.username}")

        return Response({'mensaje': 'Contraseña actualizada correctamente'})
