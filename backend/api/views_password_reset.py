import hashlib
import logging
from uuid import uuid4

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.core.mail import send_mail

from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle

from .models import Usuario, ConfirmacionReset
from .serializers import PasswordResetSerializer, PasswordResetConfirmSerializer
from .throttles import PasswordResetThrottle

logger = logging.getLogger('seguridad')
audit_logger = logging.getLogger('auditoria')


def _generate_reset_token():
    token = uuid4().hex
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return token, token_hash


SUCCESS_HTML = """<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="refresh" content="3;url=__REDIRECT_URL__">
<title>Identidad Confirmada</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f4f6f9;}
.card{background:white;border-radius:16px;padding:48px 40px;text-align:center;max-width:400px;width:90%;box-shadow:0 4px 24px rgba(0,0,0,0.06);}
.icon{width:56px;height:56px;background:#16a34a;border-radius:50%;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;}
.icon svg{width:28px;height:28px;stroke:white;stroke-width:2.5;fill:none;}
h1{font-size:22px;font-weight:600;color:#1a1a2e;margin:0 0 8px;}
p{font-size:14px;color:#6b7280;line-height:1.5;margin:0;}
a{color:#9FE0C3;text-decoration:none;font-weight:500;}
</style>
</head>
<body>
<div class="card">
<div class="icon"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></div>
<h1>Identidad Confirmada</h1>
<p>Ser&aacute;s redirigido autom&aacute;ticamente...</p>
<p style="margin-top:16px"><a href="__REDIRECT_URL__">Haz clic aqu&iacute; si no redirige</a></p>
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


class PasswordReset(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

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

            token, token_hash = _generate_reset_token()

            ConfirmacionReset.objects.filter(usuario=usuario).delete()

            ConfirmacionReset.objects.filter(
                created_at__lt=timezone.now() - timezone.timedelta(minutes=ConfirmacionReset.TOKEN_EXPIRY_MINUTES)
            ).delete()

            ConfirmacionReset.objects.create(usuario=usuario, token_hash=token_hash)

            si_url = f"{settings.FRONTEND_URL}/forgot-password?token={token}"
            no_url = f"{settings.FRONTEND_URL}/login"

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
            audit_logger.info(f"RESET_PASSWORD_SOLICITADO user_id={usuario.id} username={usuario.username}")

        except Usuario.DoesNotExist:
            logger.info(f"Intento de recuperación para email no registrado: {email}")

        return Response(response_data)


class PasswordResetConfirm(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'errores': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        token = serializer.validated_data['token']
        password = serializer.validated_data['password']

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        try:
            reset_record = ConfirmacionReset.objects.select_related('usuario').get(
                token_hash=token_hash
            )

            if reset_record.is_expired:
                return Response(
                    {'error': 'Token expirado. Solicita uno nuevo'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            usuario = reset_record.usuario

            if not usuario.is_active:
                return Response(
                    {'error': 'Token inválido o expirado'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            usuario.set_password(password)
            usuario.failed_attempts = 0
            usuario.locked_until = None
            usuario.save(update_fields=['password', 'failed_attempts', 'locked_until'])

            reset_record.delete()

            logger.info(
                f"Contraseña restablecida para: {usuario.username}",
                extra={'user_id': usuario.id}
            )
            audit_logger.info(f"RESET_PASSWORD_COMPLETADO user_id={usuario.id} username={usuario.username}")

            return Response({'mensaje': 'Contraseña restablecida correctamente'})
        except ConfirmacionReset.DoesNotExist:
            return Response(
                {'error': 'Token inválido o expirado'},
                status=status.HTTP_400_BAD_REQUEST
            )


class ConfirmarIdentidad(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [AnonRateThrottle]

    def post(self, request):
        token = request.data.get('token', '')

        if not token:
            return HttpResponse(ERROR_HTML, content_type='text/html', status=400)

        try:
            token_hash = hashlib.sha256(token.encode()).hexdigest()
            reset_record = ConfirmacionReset.objects.select_related('usuario').get(
                token_hash=token_hash
            )

            if reset_record.is_expired:
                raise ValueError('Token expirado')

            usuario = reset_record.usuario

            if not usuario.is_active:
                raise ValueError('Usuario inactivo')

            logger.info(f"[ConfirmarIdentidad] CONFIRMADO user={usuario.id}")
            audit_logger.info(f"IDENTIDAD_CONFIRMADA user_id={usuario.id}")

            reset_record.confirmado = True
            reset_record.save(update_fields=['confirmado'])

            redirect_url = f"{settings.FRONTEND_URL}/forgot-password?token={token}&confirmed=1"
            return HttpResponse(
                SUCCESS_HTML.replace('__REDIRECT_URL__', redirect_url),
                content_type='text/html'
            )

        except (ConfirmacionReset.DoesNotExist, ValueError) as e:
            logger.error(f"[ConfirmarIdentidad] ERROR: {e}")
            return HttpResponse(ERROR_HTML, content_type='text/html', status=400)


class VerificarConfirmacion(APIView):
    permission_classes = [AllowAny]
    throttle_classes = []

    def get(self, request):
        token = request.query_params.get('token', '')
        if not token:
            logger.info('[VerificarConfirmacion] No token provided')
            return Response({'confirmado': False})

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        try:
            reset_record = ConfirmacionReset.objects.get(token_hash=token_hash)
            expired = reset_record.is_expired
            logger.info(f'[VerificarConfirmacion] user={reset_record.usuario_id} confirmado={reset_record.confirmado} expired={expired}')
            if expired:
                return Response({'confirmado': False})
            return Response({'confirmado': reset_record.confirmado})
        except ConfirmacionReset.DoesNotExist:
            logger.info(f'[VerificarConfirmacion] Record not found for hash prefix={token_hash[:16]}')
            return Response({'confirmado': False})


class VerificarCodigo(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

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
                token, token_hash = _generate_reset_token()

                updated = ConfirmacionReset.objects.filter(
                    usuario=usuario,
                    codigo_hash=hashlib.sha256(codigo.encode()).hexdigest()
                ).update(
                    token_hash=token_hash,
                    codigo_hash=None,
                )

                if updated == 0:
                    return Response(
                        {'valido': False, 'error': 'Código inválido'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                resp = {'valido': True}
                return Response(resp)
            except Usuario.DoesNotExist:
                pass

        return Response(
            {'valido': False, 'error': 'Código inválido o expirado'},
            status=status.HTTP_400_BAD_REQUEST
        )
