import logging
from django.utils import timezone
from django.db.models import Q

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.authentication import JWTAuthentication

from .models import Usuario
from .serializers import RegisterSerializer, LoginSerializer, UsuarioSerializer

logger = logging.getLogger('seguridad')


# ─── THROTTLES PERSONALIZADOS ──────────────────────────────────────────

class LoginThrottle(AnonRateThrottle):
    scope = 'login'


class RegisterThrottle(AnonRateThrottle):
    scope = 'register'


# ─── REGISTRO SEGURO ───────────────────────────────────────────────────

class RegisterView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [RegisterThrottle]

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

        refresh = RefreshToken.for_user(usuario)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        logger.info(
            f"Registro exitoso: {usuario.username}",
            extra={'user_id': usuario.id, 'username': usuario.username}
        )

        return Response(
            {
                'mensaje': 'Registro exitoso',
                'usuario': {
                    'id': usuario.id,
                    'username': usuario.username,
                    'email': usuario.email,
                    'rol': usuario.rol,
                },
                'access_token': access_token,
                'refresh_token': refresh_token,
            },
            status=status.HTTP_201_CREATED,
        )


# ─── LOGIN SEGURO ──────────────────────────────────────────────────────

class LoginView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

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
            logger.warning(
                f"Login fallido - usuario no encontrado: {username}",
                extra={'ip': request.META.get('REMOTE_ADDR')}
            )
            return Response(
                {'error': 'Credenciales incorrectas'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not usuario.is_active:
            logger.warning(
                f"Login bloqueado - cuenta inactiva: {usuario.username}",
                extra={'user_id': usuario.id}
            )
            return Response(
                {'error': 'Cuenta desactivada'},
                status=status.HTTP_403_FORBIDDEN
            )

        if usuario.is_locked():
            remaining = int((usuario.locked_until - timezone.now()).total_seconds() / 60)
            logger.warning(
                f"Login bloqueado - cuenta temporalmente bloqueada: {usuario.username}",
                extra={'user_id': usuario.id}
            )
            return Response(
                {'error': f'Cuenta bloqueada. Intente de nuevo en {remaining} minutos'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

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
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        refresh['username'] = usuario.username
        refresh['rol'] = usuario.rol

        logger.info(
            f"Login exitoso: {usuario.username}",
            extra={
                'user_id': usuario.id,
                'username': usuario.username,
            }
        )

        return Response(
            {
                'mensaje': 'Sesión iniciada',
                'usuario': {
                    'id': usuario.id,
                    'username': usuario.username,
                    'email': usuario.email,
                    'rol': usuario.rol,
                },
                'access_token': access_token,
                'refresh_token': refresh_token,
            }
        )


# ─── REFRESH TOKEN ─────────────────────────────────────────────────────

class RefreshTokenView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginThrottle]

    def post(self, request):
        refresh_token = request.data.get('refresh_token')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            refresh = RefreshToken(refresh_token)
            usuario_id = refresh.payload.get('user_id')
            usuario = Usuario.objects.get(id=usuario_id, is_active=True)

            new_refresh = RefreshToken.for_user(usuario)
            access_token = str(new_refresh.access_token)
            new_refresh_token = str(new_refresh)

            refresh.blacklist()

            return Response({
                'access_token': access_token,
                'refresh_token': new_refresh_token,
            })
        except Exception as e:
            logger.warning(f"Refresh token inválido: {str(e)}")
            return Response(
                {'error': 'Sesión expirada. Inicie sesión nuevamente'},
                status=status.HTTP_401_UNAUTHORIZED
            )


# ─── LOGOUT (REVOCAR TOKEN) ────────────────────────────────────────────

class LogoutView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh_token')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()

            logger.info(
                f"Logout: {request.user.username}",
                extra={'user_id': request.user.id}
            )
            return Response({'mensaje': 'Sesión cerrada correctamente'})
        except Exception as e:
            logger.error(f"Error en logout: {str(e)}")
            return Response(
                {'mensaje': 'Sesión cerrada'},
                status=status.HTTP_200_OK
            )


# ─── VERIFICAR SESIÓN ──────────────────────────────────────────────────

class VerifySessionView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UsuarioSerializer(request.user)
        return Response({'authenticated': True, 'usuario': serializer.data})


# ─── RANKINGS PÚBLICOS (SOLO DATOS ANONIMIZADOS) ───────────────────────

class PublicRankingView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def get(self, request):
        usuarios = Usuario.objects.filter(is_active=True).order_by('-fecha_registro')[:5]
        data = [
            {
                'id': u.id,
                'username': u.username,
                'fecha_registro': u.fecha_registro,
            }
            for u in usuarios
        ]
        return Response(data)


# ─── LISTAR USUARIOS (SOLO ADMIN) ──────────────────────────────────────

class UsuarioListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if request.user.rol != 'admin':
            return Response(
                {'error': 'No autorizado'},
                status=status.HTTP_403_FORBIDDEN
            )
        usuarios = Usuario.objects.all()
        serializer = UsuarioSerializer(usuarios, many=True)
        return Response(serializer.data)


# ─── DETALLE USUARIO (SOLO PROPIETARIO O ADMIN) ───────────────────────

class UsuarioDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Usuario.objects.get(pk=pk)
        except Usuario.DoesNotExist:
            return None

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
        allowed = ['username', 'email']
        update_data = {k: v for k, v in request.data.items() if k in allowed}
        if not update_data:
            return Response(
                {'error': 'No hay campos válidos para actualizar'},
                status=status.HTTP_400_BAD_REQUEST
            )
        serializer = UsuarioSerializer(usuario, data=update_data, partial=True)
        if serializer.is_valid():
            serializer.save()
            logger.info(
                f"Usuario actualizado: {usuario.id}",
                extra={'user_id': request.user.id}
            )
            return Response({'mensaje': 'Actualizado', 'usuario': serializer.data})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

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
        return Response(
            {'mensaje': 'Usuario desactivado'},
            status=status.HTTP_200_OK
        )
