import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger('seguridad')
audit_logger = logging.getLogger('auditoria')


def enviar_email(subject, message, recipient_list, html_message=None, from_email=None, **kwargs):
    """Envía un email y registra cualquier fallo de SMTP.

    Sustituye a los `send_mail(..., fail_silently=True)` originales: en
    producción un correo perdido (verificación, restablecimiento o alerta de
    contraseña) es un problema de seguridad y no puede pasar desapercibido.
    El fallo se loguea con nivel ERROR en los loggers 'seguridad' y 'auditoria'
    (JSON en producción) y se deja que la operación continúe, manteniendo el
    comportamiento observable de la API.
    """
    from_email = from_email or settings.DEFAULT_FROM_EMAIL

    # Mismo criterio que el aviso de arranque de apps.py: con backend de
    # consola el envío "funciona" (imprime en la terminal y devuelve sin
    # error), así que quien prueba el flujo ve respuestas 200 y en su bandeja
    # no aparece nada. Aquí queda registrado en el log en el momento exacto
    # en que debería haber salido un correo. Los tests usan locmem, así que
    # este aviso no se dispara en la suite.
    if settings.EMAIL_BACKEND.endswith('console.EmailBackend'):
        logger.warning(
            f"EMAIL NO ENVIADO (backend de consola, sin credenciales SMTP): {subject} "
            f"-> {list(recipient_list)}"
        )

    try:
        send_mail(
            subject=subject,
            message=message,
            html_message=html_message,
            from_email=from_email,
            recipient_list=recipient_list,
            fail_silently=False,
            **kwargs,
        )
    except Exception as exc:
        logger.error(
            f"Error enviando email a {recipient_list}: {exc}",
            extra={'destinatarios': list(recipient_list)},
        )
        audit_logger.error(
            f"EMAIL_FALLO destinatarios={recipient_list} error={exc}"
        )
