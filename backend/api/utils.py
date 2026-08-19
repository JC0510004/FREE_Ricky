# ─── IMPORTACIONES ───────────────────────────────────────────────────────────
# Expresiones regulares para validación y limpieza de cadenas de texto
import re

# Módulo de logging para registrar eventos de seguridad en bitácora
import logging

# bleach: librería de sanitización HTML que elimina etiquetas y scripts
# Se usa para prevenir ataques XSS (Cross-Site Scripting) en entradas de usuario
import bleach

# Manejador de excepciones por defecto de Django REST Framework;
# se extiende para personalizar las respuestas de error
from rest_framework.views import exception_handler

# Respuesta HTTP estándar de DRF para construir respuestas personalizadas
from rest_framework.response import Response

# Códigos de estado HTTP para respuestas de éxito, error y autorización
from rest_framework import status

# ─── LOGGING ─────────────────────────────────────────────────────────────────
# Logger dedicado al canal de seguridad; permite centralizar eventos
# críticos (intentos de acceso, errores no manejados, etc.) en un
# namespace específico de la bitácora para facilitar el monitoreo
logger = logging.getLogger('seguridad')


# ═══════════════════════════════════════════════════════════════════════════════
# MANEJADOR PERSONALIZADO DE EXCEPCIONES
# ═══════════════════════════════════════════════════════════════════════════════
# Intercepta todas las excepciones que levantan las vistas de DRF y las
# convierte en respuestas JSON seguras y consistentes.
# Objetivos:
#   1. Evitar filtrar información sensible del servidor (stack traces, etc.)
#   2. Normalizar todos los errores al mismo formato de diccionario
#   3. Registrar errores no manejados para investigación forense
def custom_exception_handler(exc, context):
    # Delega al manejador estándar de DRF; retorna None si la excepción
    # no es una excepción de API (no está manejada por los serializers/views)
    response = exception_handler(exc, context)

    if response is not None:
        # ─── CASO 1: Excepción manejada por DRF ──────────────────────────
        # Convierte los datos de error a un formato seguro de solo strings.
        # Esto evita que objetos complejos o listas anidadas se filtren
        # en la respuesta JSON, manteniendo el contrato simple.
        safe_data = {}

        if isinstance(response.data, dict):
            # Si la respuesta es un diccionario (error de validación, etc.),
            # convierte cada valor a string para uniformidad
            for key, value in response.data.items():
                if isinstance(value, list):
                    # DRF devuelve errores de validación como listas;
                    # las concatena en un solo string para simplificar
                    safe_data[key] = [str(v) for v in value]
                else:
                    safe_data[key] = str(value)
        else:
            # Para respuestas no diccionario (string simple, lista, etc.),
            # usa un mensaje genérico para no exponer detalles internos
            safe_data['detail'] = 'Error en la solicitud'

        response.data = safe_data

    else:
        # ─── CASO 2: Excepción NO manejada por DRF ───────────────────────
        # Errores de programación, excepciones de base de datos, timeouts, etc.
        # Se registran en bitácora con traceback completo para diagnóstico,
        # pero se retorna un error genérico al cliente para no revelar
        # información interna del sistema que podría ser explotada
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        return Response(
            {'error': 'Error interno del servidor'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return response


# ═══════════════════════════════════════════════════════════════════════════════
# SANITIZACIÓN DE ENTRADAS
# ═══════════════════════════════════════════════════════════════════════════════
# Limpia cualquier entrada de texto para prevenir ataques de inyección
# (XSS, HTML injection, SQL injection básico, etc.).
# Se aplica a TODOS los campos de texto antes de su validación o persistencia.
def sanitize_input(value):
    # Solo procesa strings; otros tipos (int, bool, None) se devuelven tal cual
    if not isinstance(value, str):
        return value

    # bleach.clean elimina todas las etiquetas HTML (<script>, <img>, etc.)
    # tags=[]: no permite ninguna etiqueta HTML
    # strip=True: elimina las etiquetas en lugar de escaparlas (sin &lt; &gt;)
    value = bleach.clean(value, tags=[], strip=True)

    # Elimina caracteres de control invisibles (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F)
    # que podrían usarse para ofuscar payload de ataques o causar
    # problemas de rendering en clientes y bases de datos
    # Se permite 0x09 (tab) y 0x0A (newline) para formato legible
    value = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F]', '', value)

    # Elimina espacios al inicio y final que podrían evadir validaciones
    return value.strip()


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDACIÓN DE CORREO ELECTRÓNICO
# ═══════════════════════════════════════════════════════════════════════════════
# Verifica que un email tenga un formato válido según el estándar RFC 5322
# simplificado. No verifica que el dominio exista (eso requiere DNS/SMTP).
def validate_email(email):
    # Patrón regex que valida la estructura general de un email:
    # - Parte local: alfanuméricos, puntos, guiones bajos, porcentajes, etc.
    # - Separador @ obligatorio
    # - Dominio: alfanuméricos, puntos, guiones
    # - Extensión: al menos 2 caracteres alfabéticos (.com, .org, .mx, etc.)
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        return False
    # Límite de 254 caracteres según RFC 5321 (256 minus el delimitador)
    # Previene direcciones absurdamente largas que podrían causar DoS
    if len(email) > 254:
        return False
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# VALIDACIÓN DE NOMBRE DE USUARIO
# ═══════════════════════════════════════════════════════════════════════════════
# Verifica que el nombre de usuario cumpla con las reglas de formato:
# longitud válida y caracteres alfanuméricos o guión bajo únicamente.
def validate_username(username):
    # Longitud mínima de 3 caracteres: evita usuarios demasiado genéricos
    # Longitud máxima de 50: limita el espacio en base de datos y UI
    if len(username) < 3 or len(username) > 50:
        return False
    # Solo permite letras (a-z, A-Z), números (0-9) y guión bajo (_).
    # Bloquea caracteres especiales, espacios y emojis que podrían
    # causar problemas de encoding o inyección
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return False
    return True


# ═══════════════════════════════════════════════════════════════════════════════
# NORMALIZACIÓN DE CORREO ELECTRÓNICO
# ═══════════════════════════════════════════════════════════════════════════════
# Normaliza el email para garantizar unicidad real entre registros.
# Los proveedores de email ignoran ciertas diferencias; por ejemplo:
#   - Gmail treata "User@gmail.com" y "user@gmail.com" como el mismo
#   - "user+tag@gmail.com" y "user@gmail.com" llegan a la misma bandeja
# Sin normalización, un usuario podría crear múltiples cuentas con el
# mismo correo real, comprometiendo la recuperación de contraseña.
def normalize_email(email):
    # Convierte a minúsculas y elimina espacios, luego separa en
    # parte local y dominio usando el primer @ como delimitador
    local_part, domain = email.lower().strip().split('@', 1)

    # Elimina el tag de aliasing (parte después del +).
    # Ejemplo: "usuario+trabajo@gmail.com" → "usuario@gmail.com"
    # Esto previene la creación de múltiples cuentas con alias del mismo correo
    if '+' in local_part:
        local_part = local_part.split('+')[0]

    return f"{local_part}@{domain}"


# ═══════════════════════════════════════════════════════════════════════════════
# VERIFICACIÓN DE FORTALEZA DE CONTRASEÑA
# ═══════════════════════════════════════════════════════════════════════════════
# Evalúa la contraseña contra un conjunto de reglas de seguridad.
# Retorna una lista de errores (vacía si la contraseña es válida).
# Se implementa como lista para mostrar TODOS los problemas de una vez,
# mejorando la experiencia del usuario vs. detenerse en el primero.
def check_password_strength(password):
    # Lista acumuladora de mensajes de error de validación
    errors = []

    # Longitud mínima de 8 caracteres: recomendación estándar de NIST SP 800-63B
    if len(password) < 8:
        errors.append('Debe tener al menos 8 caracteres')

    # Longitud máxima de 128 caracteres: previene ataques de denegación
    # de servicio con cadenas extremadamente largas que agotan memoria/CPU
    # durante el hashing (bcrypt tiene un límite de 72 bytes, argon2 más)
    if len(password) > 128:
        errors.append('Debe tener máximo 128 caracteres')

    # Al menos una mayúscula: aumenta la entropía del espacio de búsqueda
    # y cumple con requisitos de políticas de contraseñas corporativas
    if not re.search(r'[A-Z]', password):
        errors.append('Debe contener al menos una mayúscula')

    # Al menos una minúscula: combinación con mayúsculas amplía el alfabeto
    if not re.search(r'[a-z]', password):
        errors.append('Debe contener al menos una minúscula')

    # Al menos un número: incorpora dígitos al conjunto de caracteres
    if not re.search(r'[0-9]', password):
        errors.append('Debe contener al menos un número')

    # Al menos un carácter especial: dramáticamente aumenta la resistencia
    # a ataques de fuerza bruta al ampliar el alfabeto usable.
    # El conjunto incluye los caracteres más comunes en teclados estándar.
    if not re.search(r'[!@#$%^&*(),.?":{}|<>_\-]', password):
        errors.append('Debe contener al menos un carácter especial')

    return errors
