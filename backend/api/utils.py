import re
import logging
import bleach
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger('seguridad')


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        safe_data = {}

        if isinstance(response.data, dict):
            for key, value in response.data.items():
                if isinstance(value, list):
                    safe_data[key] = [str(v) for v in value]
                else:
                    safe_data[key] = str(value)
        else:
            safe_data['detail'] = 'Error en la solicitud'

        response.data = safe_data

    else:
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return Response(
            {'error': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return response


def sanitize_input(value):
    if not isinstance(value, str):
        return value
    value = bleach.clean(value, tags=[], strip=True)
    value = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F]', '', value)
    return value.strip()


def validate_email(email):
    pattern = r'^[a-zA-Z0-9._%+-]+@(gmail|hotmail)\.com$'
    if not re.match(pattern, email):
        return False
    if len(email) > 254:
        return False
    return True


def validate_username(username):
    if len(username) < 3 or len(username) > 50:
        return False
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return False
    return True


def normalize_email(email):
    local_part, domain = email.lower().strip().split('@', 1)
    if '+' in local_part:
        local_part = local_part.split('+')[0]
    return f"{local_part}@{domain}"


def check_password_strength(password):
    errors = []
    if len(password) < 8:
        errors.append('Debe tener al menos 8 caracteres')
    if len(password) > 128:
        errors.append('Debe tener máximo 128 caracteres')
    if not re.search(r'[A-Z]', password):
        errors.append('Debe contener al menos una mayúscula')
    if not re.search(r'[a-z]', password):
        errors.append('Debe contener al menos una minúscula')
    if not re.search(r'[0-9]', password):
        errors.append('Debe contener al menos un número')
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-]', password):
        errors.append('Debe contener al menos un carácter especial')
    return errors
