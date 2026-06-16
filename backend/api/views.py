import logging
import hashlib
from datetime import timedelta
from django.utils import timezone
from django.db.models import Q, Avg, Count, Sum, Max, Min
from django.http import HttpResponse, HttpResponseRedirect

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken, AccessToken
from rest_framework_simplejwt.authentication import JWTAuthentication

from django.conf import settings

from .models import Usuario, ConfirmacionReset, Nivel, Partida
from .serializers import (
    RegisterSerializer, LoginSerializer, UsuarioSerializer,
    PasswordResetSerializer, PasswordResetConfirmSerializer,
    NivelSerializer, PartidaSerializer, PartidaCreateSerializer,
    UserStatsSerializer,
)

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


# ─── RECUPERACIÓN DE CONTRASEÑA ────────────────────────────────────────

from django.core.mail import send_mail
from django.conf import settings


class PasswordReset(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'errores': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        email = serializer.validated_data['email']
        response_data = {
            'mensaje': 'Si el correo existe, recibirás un mensaje de confirmación',
        }

        try:
            usuario = Usuario.objects.get(email__iexact=email, is_active=True)

            import secrets
            token = AccessToken()
            token.set_exp(lifetime=timedelta(minutes=15))
            token['user_id'] = usuario.id
            token['type'] = 'password_reset'

            reset_url = f"https://enrage-runt-starfish.ngrok-free.dev/api/password-reset/confirmar/?token={token}"

            si_url = f"https://enrage-runt-starfish.ngrok-free.dev/api/password-reset/confirmar/?token={token}"
            no_url = f"http://localhost:5173/login"

            html_message = f"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;min-height:100vh;">
                <tr>
                  <td align="center" style="padding:40px 16px;">
                    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
                      <tr>
                        <td style="padding:48px 40px 40px;">
                          <div style="width:56px;height:56px;background:linear-gradient(135deg,#9FE0C3,#9FBCE0);border-radius:50%;margin:0 auto 24px;display:flex;align-items:center;justify-content:center;">
                            <span style="font-size:24px;color:#ffffff;">?</span>
                          </div>
                          <h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#1a1a2e;text-align:center;">¿Eres tú?</h1>
                          <p style="margin:0 0 28px;font-size:14px;color:#6b7280;text-align:center;line-height:1.5;">
                            Se solicitó un restablecimiento de contraseña para la cuenta<br/>
                            <strong style="color:#1a1a2e;">{email}</strong>
                          </p>
                          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                            <tr>
                              <td align="center">
                                <a href="{si_url}" style="display:inline-block;background:linear-gradient(135deg,#9FE0C3,#9FBCE0);color:#ffffff;text-decoration:none;padding:14px 48px;border-radius:8px;font-size:15px;font-weight:500;letter-spacing:0.3px;">Sí, soy yo</a>
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="padding-top:12px;">
                                <a href="{no_url}" style="display:inline-block;color:#6b7280;text-decoration:none;padding:10px 24px;font-size:13px;">No, cancelar</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:0 40px 32px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="border-top:1px solid #e5e7eb;padding-top:20px;">
                                <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">
                                  Este enlace expira en 15 minutos. Si no solicitaste este cambio, puedes ignorar este correo.
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
            </html>
            """

            send_mail(
                subject='¿Eres tú? - FREE RICKY',
                message=f'¿Eres tú? Se solicitó un restablecimiento de contraseña para {email}.\n\nSí, soy yo: {si_url}\nNo, cancelar: {no_url}\n\nEste enlace expira en 15 minutos.',
                html_message=html_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=True,
            )

            logger.info(
                f"Token de recuperación generado para: {usuario.username}",
                extra={'user_id': usuario.id}
            )

            response_data['reset_url'] = reset_url

        except Usuario.DoesNotExist:
            logger.info(f"Intento de recuperación para email no registrado: {email}")

        return Response(response_data)


class PasswordResetConfirm(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'errores': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        token = serializer.validated_data['token']
        password = serializer.validated_data['password']

        try:
            access_token = AccessToken(token)
            if access_token.payload.get('type') != 'password_reset':
                raise Exception('Invalid token type')

            user_id = access_token.payload.get('user_id')
            usuario = Usuario.objects.get(id=user_id, is_active=True)

            usuario.set_password(password)
            usuario.failed_attempts = 0
            usuario.locked_until = None
            usuario.save(update_fields=['password', 'failed_attempts', 'locked_until'])

            logger.info(
                f"Contraseña restablecida para: {usuario.username}",
                extra={'user_id': usuario.id}
            )

            return Response({'mensaje': 'Contraseña restablecida correctamente'})
        except Exception:
            return Response(
                {'error': 'Token inválido o expirado'},
                status=status.HTTP_400_BAD_REQUEST
            )


SUCCESS_HTML = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Identidad Confirmada</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f4f6f9;}
.card{background:white;border-radius:16px;padding:48px 40px;text-align:center;max-width:400px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,0.06);}
.icon{width:56px;height:56px;background:#16a34a;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;}
.icon svg{width:28px;height:28px;stroke:white;stroke-width:2.5;fill:none;}
h1{font-size:22px;font-weight:600;color:#1a1a2e;margin:0 0 8px;}
p{font-size:14px;color:#6b7280;line-height:1.5;margin:0;}
</style>
</head>
<body>
<div class="card">
<div class="icon"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
<h1>Identidad Confirmada</h1>
<p>Puedes cerrar esta ventana y continuar en la aplicaci&oacute;n.</p>
</div>
</body>
</html>"""

ERROR_HTML = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Enlace Inválido</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f4f6f9;}
.card{background:white;border-radius:16px;padding:48px 40px;text-align:center;max-width:400px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,0.06);}
.icon{width:56px;height:56px;background:#dc2626;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;}
.icon svg{width:28px;height:28px;stroke:white;stroke-width:2.5;fill:none;}
h1{font-size:22px;font-weight:600;color:#1a1a2e;margin:0 0 8px;}
p{font-size:14px;color:#6b7280;line-height:1.5;margin:0;}
</style>
</head>
<body>
<div class="card">
<div class="icon"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></div>
<h1>Enlace Inválido</h1>
<p>Este enlace ha expirado o no es válido. Solicita un nuevo restablecimiento de contraseña.</p>
</div>
</body>
</html>"""


class VerificarCodigo(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        codigo = request.data.get('codigo', '').strip()

        if not email or not codigo:
            return Response(
                {'error': 'Email y código requeridos'},
                status=status.HTTP_400_BAD_REQUEST
            )

        confirmado = ConfirmacionReset.verificar_codigo(email, codigo)
        if confirmado:
            try:
                usuario = Usuario.objects.get(email__iexact=email, is_active=True)
                token = AccessToken()
                token.set_exp(lifetime=timedelta(minutes=15))
                token['user_id'] = usuario.id
                token['type'] = 'password_reset'

                token_hash = hashlib.sha256(str(token).encode()).hexdigest()
                ConfirmacionReset.objects.filter(
                    usuario=usuario,
                    codigo_hash=hashlib.sha256(codigo.encode()).hexdigest()
                ).update(token_hash=token_hash)

                return Response({
                    'valido': True,
                    'token': str(token),
                })
            except Usuario.DoesNotExist:
                pass

        return Response(
            {'valido': False, 'error': 'Código inválido o expirado'},
            status=status.HTTP_400_BAD_REQUEST
        )


class ConfirmarIdentidad(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get('token', '')
        logger.info(f"[ConfirmarIdentidad] token recibido, length={len(token)}, starts={token[:30] if token else 'EMPTY'}...")

        if not token:
            return HttpResponseRedirect('/forgot-password')

        try:
            access_token = AccessToken(token)
            if access_token.payload.get('type') != 'password_reset':
                return HttpResponse(ERROR_HTML, content_type='text/html', status=400)

            user_id = access_token.payload.get('user_id')
            usuario = Usuario.objects.get(id=user_id, is_active=True)

            ConfirmacionReset.confirmar(token, usuario)
            logger.info(f"[ConfirmarIdentidad] CONFIRMADO user={usuario.id}")

            return HttpResponse(SUCCESS_HTML, content_type='text/html')

        except Exception as e:
            logger.error(f"[ConfirmarIdentidad] ERROR: {e}")
            return HttpResponse(ERROR_HTML, content_type='text/html', status=400)


class VerificarConfirmacion(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get('token', '')
        if not token:
            return Response({'confirmado': False})

        confirmado = ConfirmacionReset.esta_confirmado(token)
        return Response({'confirmado': confirmado})


# ─── NIVELES ────────────────────────────────────────────────────────────

class NivelListView(APIView):
    authentication_classes = [JWTAuthentication]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        niveles = Nivel.objects.all().order_by('dificultad', 'nombre')
        serializer = NivelSerializer(niveles, many=True)
        return Response(serializer.data)

    def post(self, request):
        if request.user.rol != 'admin':
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        serializer = NivelSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# ─── PARTIDAS ───────────────────────────────────────────────────────────

class PartidaListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        partidas = Partida.objects.filter(usuario=request.user).order_by('-fecha')[:20]
        serializer = PartidaSerializer(partidas, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = PartidaCreateSerializer(data=request.data)
        if serializer.is_valid():
            partida = serializer.save(usuario=request.user)
            data = PartidaSerializer(partida).data
            return Response(data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PartidaDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        try:
            return Partida.objects.get(pk=pk)
        except Partida.DoesNotExist:
            return None

    def get(self, request, pk):
        partida = self.get_object(pk)
        if not partida:
            return Response({'error': 'No encontrada'}, status=status.HTTP_404_NOT_FOUND)
        if partida.usuario_id != request.user.id and request.user.rol != 'admin':
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        serializer = PartidaSerializer(partida)
        return Response(serializer.data)


# ─── RANKING POR PUNTUACIÓN ─────────────────────────────────────────────

class RankingView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        ranking = (
            Partida.objects.values('usuario', 'usuario__username')
            .annotate(
                mejor_puntuacion=Max('puntuacion'),
                total_partidas=Count('id'),
                promedio_puntuacion=Avg('puntuacion'),
            )
            .filter(mejor_puntuacion__isnull=False)
            .order_by('-mejor_puntuacion')[:20]
        )
        data = [
            {
                'posicion': i + 1,
                'usuario_id': r['usuario'],
                'username': r['usuario__username'],
                'mejor_puntuacion': r['mejor_puntuacion'],
                'total_partidas': r['total_partidas'],
                'promedio_puntuacion': round(r['promedio_puntuacion'], 1) if r['promedio_puntuacion'] else None,
            }
            for i, r in enumerate(ranking)
        ]
        return Response(data)


# ─── ESTADÍSTICAS DEL USUARIO ───────────────────────────────────────────

class UserStatsView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        partidas = Partida.objects.filter(usuario=request.user)
        total = partidas.count()

        if total == 0:
            return Response(UserStatsSerializer({
                'total_partidas': 0,
                'mejor_puntuacion': 0,
                'peor_puntuacion': 0,
                'promedio_puntuacion': 0,
                'total_muertes': 0,
                'promedio_muertes': 0,
                'tiempo_total': 0,
                'nivel_favorito': None,
                'partidas_por_dificultad': {'facil': 0, 'medio': 0, 'dificil': 0},
            }).data)

        stats = partidas.aggregate(
            mejor_puntuacion=Max('puntuacion'),
            peor_puntuacion=Min('puntuacion'),
            promedio_puntuacion=Avg('puntuacion'),
            total_muertes=Sum('muertes'),
            promedio_muertes=Avg('muertes'),
            tiempo_total=Sum('tiempo'),
        )

        nivel_favorito = (
            partidas.values('nivel__nombre')
            .annotate(total=Count('id'))
            .order_by('-total')
            .first()
        )

        por_dificultad = (
            partidas.values('nivel__dificultad')
            .annotate(total=Count('id'))
        )
        dificultad_map = {'facil': 0, 'medio': 0, 'dificil': 0}
        for d in por_dificultad:
            dificultad_map[d['nivel__dificultad']] = d['total']

        serializer = UserStatsSerializer({
            'total_partidas': total,
            'mejor_puntuacion': stats['mejor_puntuacion'] or 0,
            'peor_puntuacion': stats['peor_puntuacion'] or 0,
            'promedio_puntuacion': round(stats['promedio_puntuacion'] or 0, 1),
            'total_muertes': stats['total_muertes'] or 0,
            'promedio_muertes': round(stats['promedio_muertes'] or 0, 1),
            'tiempo_total': stats['tiempo_total'] or 0,
            'nivel_favorito': nivel_favorito['nivel__nombre'] if nivel_favorito else None,
            'partidas_por_dificultad': dificultad_map,
        })
        return Response(serializer.data)
