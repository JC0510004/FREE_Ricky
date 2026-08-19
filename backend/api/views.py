# ═══════════════════════════════════════════════════════════════════════════
# ARCHIVO: views.py - VISTAS DE LA API (ENDPOINTS REST)
# ═══════════════════════════════════════════════════════════════════════════
# Este archivo contiene todas las vistas (endpoints) de la API de FREE RICKY.
# Cada clase hereda de APIView de Django REST Framework y representa un
# endpoint HTTP que el frontend consume para autenticación, gestión de
# usuarios, niveles, partidas, rankings y recuperación de contraseña.
# ═══════════════════════════════════════════════════════════════════════════

# ─── IMPORTACIONES ESTÁNDAR DE PYTHON ─────────────────────────────────────

# logging: sistema de registro de eventos del propio Python. Se usa para
# escribir mensajes de depuración, advertencias, errores e información
# general en archivos de log o en la consola.
import logging

# hashlib: librería estándar para generar hashes criptográficos (SHA-256, etc).
# Se usa aquí para hashear tokens de recuperación de contraseña antes de
# guardarlos en la base de datos, nunca se almacenan tokens en texto plano.
import hashlib

# uuid4: genera identificadores únicos universales (UUID) aleatorios.
# Se usa para generar tokens de recuperación de contraseña que sean
# prácticamente imposibles de adivinar.
from uuid import uuid4

# ─── IMPORTACIONES DE DJANGO ──────────────────────────────────────────────

# django.utils.timezone: utilidad para manejar zonas horarias. Se usa para
# comparar fechas de expiración de tokens y bloqueos de cuenta con la hora
# actual del servidor.
from django.utils import timezone

# django.conf.settings: acceso a las configuraciones del proyecto definidas
# en settings.py (DEBUG, URLs del frontend, correo electrónico por defecto, etc).
from django.conf import settings

# django.core.mail.send_mail: función para enviar correos electrónicos.
# Se usa en el flujo de recuperación de contraseña para enviar el email
# de confirmación al usuario.
from django.core.mail import send_mail

# django.db.models: herramientas de consulta de Django ORM.
# Q permite construir consultas complejas con operadores OR (|) y AND (&).
# Avg, Count, Sum, Max, Min son agregaciones para consultas estadísticas
# sobre la base de datos (promedio, suma, máxima puntuación, etc).
from django.db.models import Q, Avg, Count, Sum, Max, Min

# django.http: tipos de respuesta HTTP de Django.
# HttpResponse se usa para devolver HTML puro (páginas de confirmación).
# HttpResponseRedirect se reserva para redirecciones HTTP 302.
from django.http import HttpResponse, HttpResponseRedirect

# ─── IMPORTACIONES DE DJANGO REST FRAMEWORK (DRF) ────────────────────────

# APIView: clase base de DRF para crear vistas basadas en clases. Cada método
# HTTP (get, post, put, delete) se define como un método separado dentro de
# la clase. Es el punto de entrada principal de cada endpoint.
from rest_framework.views import APIView

# Response: clase de DRF que devuelve respuestas JSON con el Content-Type
# correcto y status HTTP apropiado. Reemplaza el HttpResponse de Django
# para respuestas de API.
from rest_framework.response import Response

# status: constantes HTTP que representan códigos de estado como 200 OK,
# 201 Created, 400 Bad Request, 401 Unauthorized, 403 Forbidden, etc.
# Usar estas constantes hace el código más legible y menos propenso a errores.
from rest_framework import status

# PermitAny: permite el acceso sin autenticación (público).
# IsAuthenticated: requiere que el usuario tenga un token JWT válido.
# Se usan en permission_classes de cada vista para controlar quién puede
# acceder a cada endpoint.
from rest_framework.permissions import AllowAny, IsAuthenticated

# AnonRateThrottle: limita la velocidad de peticiones de usuarios anónimos.
# UserRateThrottle: limita la velocidad de peticiones de usuarios autenticados.
# Son una protección contra ataques de fuerza bruta y abuso de la API.
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

# PageNumberPagination: sistema de paginación que divide los resultados en
# páginas usando un parámetro ?page=N en la URL. Evita devolver miles de
# registros de golpe.
from rest_framework.pagination import PageNumberPagination

# ─── IMPORTACIONES DE DJANGO REST FRAMEWORK SIMPLE JWT ────────────────────

# RefreshToken: clase para crear y manejar tokens JWT de refresco. El token
# de refresco tiene una vida larga (normalmente días) y se usa para obtener
# nuevos tokens de acceso sin que el usuario tenga que iniciar sesión otra vez.
from rest_framework_simplejwt.tokens import RefreshToken

# InvalidToken, TokenError: excepciones que lanza Simple JWT cuando un token
# es inválido, está expirado o está mal formado. Se capturan en los flujos
# de refresh y logout para manejar errores gracefully.
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

# JWTAuthentication: clase de autenticación que valida los tokens JWT en el
# header Authorization de cada petición. Se asigna a cada vista protegida.
from rest_framework_simplejwt.authentication import JWTAuthentication

# ─── IMPORTACIONES LOCALES DEL PROYECTO ──────────────────────────────────

# Modelos del proyecto:
# - Usuario: modelo personalizado de usuario con campos como rol, intentos
#   fallidos, bloqueo temporal, verificación de email, etc.
# - ConfirmacionReset: almacena tokens de recuperación de contraseña hasheados
#   junto con su fecha de creación y estado de confirmación.
# - Nivel: representa un nivel del juego con su nombre, dificultad y datos.
# - Partida: almacena cada partida jugada por un usuario con puntuación,
#   muertes, tiempo, nivel jugado, etc.
from .models import Usuario, ConfirmacionReset, Nivel, Partida

# check_password_strength: función utilitaria que valida que una contraseña
# cumpla con los requisitos de seguridad (longitud mínima, mayúsculas, números,
# caracteres especiales, etc). Retorna una lista de errores si no cumple.
from .utils import check_password_strength

# Serializadores de DRF:
# Cada serializer convierte un modelo en JSON y viceversa. También valida
# los datos de entrada antes de guardarlos en la base de datos.
# - RegisterSerializer: valida datos de registro (username, email, password).
# - LoginSerializer: valida credenciales de inicio de sesión.
# - UsuarioSerializer: serializa datos de usuario para respuestas.
# - PasswordResetSerializer: valida el email para solicitud de reset.
# - PasswordResetConfirmSerializer: valida token y nueva contraseña.
# - NivelSerializer: serializa niveles del juego.
# - PartidaSerializer: serializa datos de una partida existente.
# - PartidaCreateSerializer: valida datos para crear una nueva partida.
# - UserStatsSerializer: serializa estadísticas del usuario.
from .serializers import (
    RegisterSerializer, LoginSerializer, UsuarioSerializer,
    PasswordResetSerializer, PasswordResetConfirmSerializer,
    NivelSerializer, PartidaSerializer, PartidaCreateSerializer,
    UserStatsSerializer,
)

# ─── LOGGERS PERSONALIZADOS ──────────────────────────────────────────────

# Logger de seguridad: registra eventos relacionados con la seguridad del
# sistema como intentos de login fallidos, registros, tokens inválidos, etc.
# Se configura en settings.py para escribir a un archivo específico de logs
# de seguridad, facilitando la auditoría y detección de intrusiones.
logger = logging.getLogger('seguridad')

# Logger de auditoría: registra acciones administrativas y trazabilidad de
# cambios importantes (registro de usuario, cambio de contraseña, login, etc).
# Es más estricto que el logger de seguridad y se usa para cumplimiento
# normativo y revisión de actividad sospechosa.
audit_logger = logging.getLogger('auditoria')

# ─── FUNCIONES AUXILIARES PARA COOKIES ───────────────────────────────────

def _set_refresh_cookie(response, response_obj):
    """Establece el refresh token como una cookie HTTP segura en la respuesta.

    Las cookies httponly no son accesibles desde JavaScript, lo que protege
    contra ataques XSS. El prefijo _ indica que es una función privada
    auxiliar, no un endpoint público.
    """
    response.set_cookie(
        'refresh_token',          # Nombre de la cookie
        response_obj,             # Valor del token de refresco JWT
        httponly=True,             # JavaScript NO puede acceder a esta cookie (protección XSS)
        samesite='Lax',           # Envía la cookie solo en navegación normal, no en CSRF cross-site
        max_age=86400,            # Duración en segundos: 24 horas (86400 = 24 * 60 * 60)
        path='/api/',             # Solo se envía en requests que empiecen con /api/
        secure=not settings.DEBUG,# En producción (HTTPS) solo se envía por conexiones cifradas
    )

def _clear_refresh_cookie(response_obj):
    """Elimina la cookie del refresh token, cerrando la sesión del lado del cliente.

    Se llama en el logout para que el frontend ya no tenga el token de refresco.
    """
    response_obj.delete_cookie('refresh_token', path='/api/')

# ─── THROTTLES PERSONALIZADOS ────────────────────────────────────────────
# Los throttles limitan la cantidad de peticiones que un usuario puede hacer
# en un período de tiempo determinado. Protegen contra ataques de fuerza bruta
# y abuso de la API. Cada throttle define un 'scope' que se configura en
# settings.py con los valores de RATE limiter por minuto/hora.

class LoginThrottle(AnonRateThrottle):
    """Throttle para el endpoint de login. Limita intentos de inicio de sesión
    de usuarios anónimos (no autenticados). El scope 'login' se configura en
    settings.py con los límites apropiados (ej: 5 intentos/minuto)."""
    scope = 'login'

class RegisterThrottle(AnonRateThrottle):
    """Throttle para el endpoint de registro. Limita cuántas cuentas nuevas
    se pueden crear desde una misma IP en un período de tiempo. Previene
    la creación masiva de cuentas falsas (spam/bots)."""
    scope = 'register'

class PasswordResetThrottle(AnonRateThrottle):
    """Throttle para el endpoint de recuperación de contraseña. Limita cuántas
    solicitudes de reset se pueden hacer para evitar abuso y enumeración
    de usuarios (averiguar qué emails están registrados)."""
    scope = 'password_reset'

class ChangePasswordThrottle(UserRateThrottle):
    """Throttle para cambio de contraseña de usuarios autenticados. Usa
    UserRateThrottle en vez de AnonRateThrottle porque requiere estar
    logueado. Previene abuso del endpoint de cambio de contraseña."""
    scope = 'change_password'

# ─── FUNCIONES AUXILIARES DE SEGURIDAD ────────────────────────────────────

def _generate_reset_token():
    """Genera un token UUID y su hash SHA-256. El UUID viaja por email; el hash se guarda en DB.

    Flujo de seguridad:
    1. Se genera un UUID aleatorio (token) que se enviará al usuario por email.
    2. Se calcula el hash SHA-256 del token.
    3. Solo el HASH se almacena en la base de datos, NUNCA el token en texto plano.
    4. Cuando el usuario hace clic en el enlace, se hashea el token de la URL
       y se compara con el hash en la DB. Así nunca exponemos el token original.
    """
    # uuid4().hex genera un string hexadecimal de 32 caracteres completamente aleatorio
    token = uuid4().hex
    # SHA-256 produce un hash de 64 caracteres hexadecimal, irreversible
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    return token, token_hash

# ═══════════════════════════════════════════════════════════════════════════
# REGISTRO SEGURO DE USUARIOS
# ═══════════════════════════════════════════════════════════════════════════

class RegisterView(APIView):
    """Endpoint POST /api/register/ - Permite a nuevos usuarios crear una cuenta.

    Flujo:
    1. Valida los datos de entrada con RegisterSerializer.
    2. Crea el usuario en la base de datos.
    3. Genera tokens JWT (access + refresh).
    4. Devuelve los tokens y los datos del usuario.
    """

    # AllowAny: cualquiera puede registrarse sin estar autenticado
    permission_classes = [AllowAny]
    # RegisterThrottle: limita la tasa de registros por IP
    throttle_classes = [RegisterThrottle]

    def post(self, request):
        """Maneja la petición POST de registro de usuario.

        Recibe JSON con: username, email, password (y otros campos que
        defina RegisterSerializer). Devuelve tokens JWT y datos del usuario.
        """
        # RegisterSerializer valida los datos (username único, email válido, password fuerte, etc)
        serializer = RegisterSerializer(data=request.data)
        if not serializer.is_valid():
            # Si la validación falla, registramos el intento fallido con la IP
            # para detectar patrones de abuso
            logger.warning(
                f"Registro fallido - validación: {serializer.errors}",
                extra={'ip': request.META.get('REMOTE_ADDR')}
            )
            return Response(
                {'errores': serializer.errors},  # Devolvemos los errores específicos al frontend
                status=status.HTTP_400_BAD_REQUEST
            )

        # serializer.save() crea el usuario en la DB usando el método create()
        # del serializer, que hashea la contraseña automáticamente
        usuario = serializer.save()

        # Registro de auditoría: quien, qué, cuándo. Se guarda en log separado.
        audit_logger.info(
            f"REGISTRO nuevo usuario id={usuario.id} username={usuario.username} email={usuario.email}",
        )

        # Generamos un par de tokens JWT para el usuario recién registrado:
        # - refresh token: vida larga (se guarda en cookie HttpOnly)
        # - access token: vida corta (se usa en cada petición API)
        refresh = RefreshToken.for_user(usuario)
        refresh_token = str(refresh)
        access_token = str(refresh.access_token)

        # Log de éxito con datos del usuario para monitoreo
        logger.info(
            f"Registro exitoso: {usuario.username}",
            extra={'user_id': usuario.id, 'username': usuario.username}
        )

        # Construimos la respuesta JSON con los datos del usuario y el access token.
        # El refresh token se envía como cookie HttpOnly, no en el body JSON,
        # por seguridad (no es accesible desde JavaScript).
        response = Response(
            {
                'mensaje': 'Registro exitoso',
                'usuario': {
                    'id': usuario.id,
                    'username': usuario.username,
                    'email': usuario.email,
                    'rol': usuario.rol,  # Rol por defecto definido en el modelo
                },
                'access_token': access_token,  # El frontend lo guarda en memoria
            },
            status=status.HTTP_201_CREATED,  # 201 Created: recurso creado exitosamente
        )
        # Insertamos el refresh token como cookie segura
        _set_refresh_cookie(response, refresh_token)
        return response

# ═══════════════════════════════════════════════════════════════════════════
# LOGIN SEGURO
# ═══════════════════════════════════════════════════════════════════════════

class LoginView(APIView):
    """Endpoint POST /api/login/ - Autentica usuarios existentes y devuelve tokens JWT.

    Incluye protección contra fuerza bruta:
    - Intentos fallidos incrementan un contador en el usuario.
    - Después de 5 intentos fallidos, la cuenta se bloquea temporalmente.
    - Se usa dummy_check_password() para prevenir timing attacks (CWE-208).
    """

    # AllowAny: no requiere estar autenticado (justamente por eso se llama login)
    permission_classes = [AllowAny]
    # LoginThrottle: limita intentos de login por IP (anti fuerza bruta)
    throttle_classes = [LoginThrottle]

    def post(self, request):
        """Maneja la petición POST de login.

        Recibe JSON con: username (o email) y password.
        Devuelve tokens JWT y datos del usuario si las credenciales son correctas.
        """
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'error': 'Credenciales inválidas'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Extraemos las credenciales validadas por el serializer
        username = serializer.validated_data['username']
        password = serializer.validated_data['password']

        # Buscamos el usuario por username O email (case-insensitive).
        # El OR permite que el usuario inicie sesión con cualquiera de los dos.
        try:
            usuario = Usuario.objects.get(
                Q(username__iexact=username) | Q(email__iexact=username)
            )
        except Usuario.DoesNotExist:
            # SEGURIDAD: Se ejecuta un check_password dummy (con hash inventado)
            # para que el tiempo de respuesta sea igual al de un usuario que SÍ existe.
            # Sin esto, un atacante podría medir el tiempo de respuesta y saber si el
            # usuario existe o no (ataque de timing, CWE-208).
            Usuario.dummy_check_password()
            logger.warning(
                f"Login fallido - usuario no encontrado: {username}",
                extra={'ip': request.META.get('REMOTE_ADDR')}
            )
            return Response(
                {'error': 'Credenciales incorrectas'},  # Mensaje genérico, no revela si el usuario existe
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Verificamos si la cuenta está desactivada (soft delete por admin)
        if not usuario.is_active:
            logger.warning(
                f"Login bloqueado - cuenta inactiva: {usuario.username}",
                extra={'user_id': usuario.id}
            )
            return Response(
                {'error': 'Cuenta desactivada'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Verificamos si la cuenta está bloqueada temporalmente por demasiados
        # intentos fallidos (bloqueo implementado en el modelo Usuario)
        if usuario.is_locked():
            # Calculamos cuántos minutos faltan para que se desbloquee
            remaining = max(0, int((usuario.locked_until - timezone.now()).total_seconds() / 60))
            logger.warning(
                f"Login bloqueado - cuenta temporalmente bloqueada: {usuario.username}",
                extra={'user_id': usuario.id}
            )
            return Response(
                {'error': f'Cuenta bloqueada. Intente de nuevo en {remaining} minutos'},
                status=status.HTTP_429_TOO_MANY_REQUESTS  # 429 Too Many Requests
            )

        # Verificamos si la contraseña ingresada coincide con la almacenada.
        # check_password() compara con el hash bcrypt/argon2 guardado en la DB.
        if not usuario.check_password(password):
            # Contraseña incorrecta: incrementamos el contador de intentos fallidos.
            # Si llega a 5, el modelo automáticamente bloquea la cuenta temporalmente.
            usuario.increment_failed_attempts()
            logger.warning(
                f"Login fallido - contraseña incorrecta: {usuario.username} "
                f"(intento {usuario.failed_attempts}/5)",
                extra={'user_id': usuario.id}
            )
            return Response(
                {'error': 'Credenciales incorrectas'},  # Mensaje genérico por seguridad
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Login exitoso: reseteamos el contador de intentos fallidos
        usuario.reset_failed_attempts()

        # Generamos tokens JWT para la sesión del usuario
        refresh = RefreshToken.for_user(usuario)
        # Inyectamos datos personalizados en el payload del refresh token
        refresh['username'] = usuario.username
        refresh['rol'] = usuario.rol
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)

        # Logs de éxito (ambos: seguridad y auditoría)
        logger.info(
            f"Login exitoso: {usuario.username}",
            extra={
                'user_id': usuario.id,
                'username': usuario.username,
            }
        )
        audit_logger.info(f"LOGIN exitoso user_id={usuario.id} username={usuario.username}")

        # Construimos la respuesta con datos del usuario (sin campos sensibles)
        response = Response(
            {
                'mensaje': 'Sesión iniciada',
                'usuario': {
                    'id': usuario.id,
                    'username': usuario.username,
                    'email': usuario.email,
                    'rol': usuario.rol,
                    # isoformat() convierte datetime a string ISO 8601 para JSON
                    # El 'if' maneja el caso de que el campo sea None
                    'fecha_registro': usuario.fecha_registro.isoformat() if usuario.fecha_registro else None,
                    'is_verified': usuario.is_verified,
                    'last_login': usuario.last_login.isoformat() if usuario.last_login else None,
                },
                'access_token': access_token,
            }
        )
        _set_refresh_cookie(response, refresh_token)
        return response

# ═══════════════════════════════════════════════════════════════════════════
# RENOVACIÓN DE TOKEN (REFRESH)
# ═══════════════════════════════════════════════════════════════════════════

class RefreshTokenView(APIView):
    """Endpoint POST /api/token/refresh/ - Renueva el access token usando el refresh token.

    Flujo:
    1. El frontend envía el refresh token (por body o cookie).
    2. Se valida que el refresh token sea válido.
    3. Se genera un nuevo par de tokens (rotación de refresh token).
    4. El refresh token anterior se añade a la blacklist (revocado).
    5. Se devuelve el nuevo access token y se setea el nuevo refresh cookie.

    La rotación de refresh tokens es una práctica de seguridad que previene
    el abuso de tokens robados: cada vez que se usa un refresh token, se invalida
    el anterior y se genera uno nuevo.
    """

    # AllowAny: accesible sin autenticación (usa el refresh token como verificación)
    permission_classes = [AllowAny]
    throttle_classes = []  # Sin throttle para refresh: el frontend lo llama automáticamente

    def post(self, request):
        """Maneja la renovación de tokens.

        Acepta el refresh token en el body JSON o en la cookie httpOnly.
        """
        # El refresh token puede venir en el body JSON o en la cookie HttpOnly.
        # Esto da flexibilidad: las cookies se usan en web, el body en APIs.
        refresh_token = request.data.get('refresh_token') or request.COOKIES.get('refresh_token')
        if not refresh_token:
            return Response(
                {'error': 'Refresh token requerido'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Decodificamos el refresh token JWT para obtener el user_id del payload
            refresh = RefreshToken(refresh_token)
            usuario_id = refresh.payload.get('user_id')
            # Verificamos que el usuario exista y esté activo
            usuario = Usuario.objects.get(id=usuario_id, is_active=True)

            # Rotación de tokens: generamos un nuevo par completo
            new_refresh = RefreshToken.for_user(usuario)
            access_token = str(new_refresh.access_token)
            new_refresh_token = str(new_refresh)

            # Invalidamos (blacklist) el refresh token anterior para que no
            # pueda ser reutilizado. Esto es clave para la seguridad.
            refresh.blacklist()

            response = Response({
                'access_token': access_token,  # Solo devolvemos el access token en el body
            })
            # El nuevo refresh token se envía como cookie HttpOnly
            _set_refresh_cookie(response, new_refresh_token)
            return response
        except (InvalidToken, TokenError, Usuario.DoesNotExist) as e:
            # Token inválido, expirado o usuario no encontrado: sesión expirada
            logger.warning(f"Refresh token inválido: {str(e)}")
            return Response(
                {'error': 'Sesión expirada. Inicie sesión nuevamente'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        except Exception as e:
            # Error inesperado del servidor (no relacionado con autenticación)
            logger.error(f"Error inesperado en refresh: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Error interno del servidor'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

# ═══════════════════════════════════════════════════════════════════════════
# LOGOUT (REVOCAR SESIÓN)
# ═══════════════════════════════════════════════════════════════════════════

class LogoutView(APIView):
    """Endpoint POST /api/logout/ - Cierra la sesión del usuario.

    Flujo:
    1. Valida que el usuario esté autenticado (necesita access token válido).
    2. Revoca el refresh token añadiéndolo a la blacklist.
    3. Elimina la cookie del refresh token del navegador.
    4. Registra el evento en logs de seguridad y auditoría.
    """

    # JWTAuthentication: requiere un access token válido en el header Authorization
    authentication_classes = [JWTAuthentication]
    # IsAuthenticated: solo usuarios logueados pueden cerrar su propia sesión
    permission_classes = [IsAuthenticated]

    def post(self, request):
        """Cierra la sesión revocando el refresh token y eliminando la cookie."""
        try:
            # Intentamos obtener el refresh token para revocarlo
            refresh_token = request.data.get('refresh_token') or request.COOKIES.get('refresh_token')
            if refresh_token:
                # Añadimos el token a la blacklist de Simple JWT para que nunca más sea válido
                token = RefreshToken(refresh_token)
                token.blacklist()

            # Logs de seguridad y auditoría del logout
            logger.info(
                f"Logout: {request.user.username}",
                extra={'user_id': request.user.id}
            )
            audit_logger.info(f"LOGOUT user_id={request.user.id} username={request.user.username}")
            response = Response({'mensaje': 'Sesión cerrada correctamente'})
            _clear_refresh_cookie(response)  # Eliminamos la cookie del navegador
            return response
        except Exception as e:
            # Si falla la revocación del token (token ya inválido/expirado), igual
            # cerramos la sesión eliminando la cookie. Es mejor cerrar la sesión
            # de forma segura que dejarla abierta.
            logger.error(f"Error en logout: {str(e)}")
            response = Response({'mensaje': 'Sesión cerrada'}, status=status.HTTP_200_OK)
            _clear_refresh_cookie(response)
            return response

# ═══════════════════════════════════════════════════════════════════════════
# VERIFICAR SESIÓN ACTIVA
# ═══════════════════════════════════════════════════════════════════════════

class VerifySessionView(APIView):
    """Endpoint GET /api/verify-session/ - Verifica si la sesión del usuario es válida.

    El frontend llama a este endpoint al cargar la aplicación para verificar
    si el token almacenado sigue siendo válido. Si responde 200, el usuario
    puede continuar navegando. Si responde 401, debe iniciar sesión de nuevo.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Devuelve los datos del usuario autenticado si el token es válido."""
        # Serializamos el usuario actual para devolver sus datos actualizados
        serializer = UsuarioSerializer(request.user)
        return Response({'authenticated': True, 'usuario': serializer.data})

# ═══════════════════════════════════════════════════════════════════════════
# GESTIÓN DE USUARIOS (CRUD)
# ═══════════════════════════════════════════════════════════════════════════

class UsuarioListView(APIView):
    """Endpoint GET /api/usuarios/ - Lista todos los usuarios activos.

    Solo accesible por usuarios con rol 'admin'. Devuelve los usuarios
    paginados (50 por página) para no sobrecargar el frontend.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination
    page_size = 50  # Máximo de usuarios por página

    def get(self, request):
        """Devuelve la lista paginada de todos los usuarios activos."""
        # Verificación manual de rol admin (alternativa a permisos personalizados)
        if request.user.rol != 'admin':
            return Response(
                {'error': 'No autorizado'},
                status=status.HTTP_403_FORBIDDEN
            )
        # Filtramos solo usuarios activos (is_active=True) para excluir desactivados
        usuarios = Usuario.objects.filter(is_active=True)
        # Configuramos la paginación manualmente
        paginator = self.pagination_class()
        paginator.page_size = self.page_size
        # paginate_queryset aplica el offset/limit de la página solicitada
        page_obj = paginator.paginate_queryset(usuarios, request)
        # Serializamos el queryset de la página actual a JSON
        serializer = UsuarioSerializer(page_obj, many=True)
        # get_paginated_response devuelve el formato estándar de paginación de DRF
        # { count, next, previous, results }
        return paginator.get_paginated_response(serializer.data)


class UsuarioDetailView(APIView):
    """Endpoint para ver, editar o desactivar un usuario específico.

    - GET /api/usuarios/<pk>/: Ver datos de un usuario (propietario o admin).
    - PUT /api/usuarios/<pk>/: Actualizar datos de un usuario (propietario o admin).
    - DELETE /api/usuarios/<pk>/: Desactivar un usuario (solo admin).

    La autorización verifica que el usuario autenticado sea el propietario
    del perfil o tenga rol de admin para acceder/modificar.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        """Busca un usuario por su primary key (pk). Devuelve None si no existe."""
        try:
            return Usuario.objects.get(pk=pk)
        except Usuario.DoesNotExist:
            return None

    def get(self, request, pk):
        """Devuelve los datos de un usuario específico."""
        usuario = self.get_object(pk)
        if not usuario:
            return Response(
                {'error': 'No encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        # Solo el propietario o un admin pueden ver los datos de un usuario
        if request.user.id != usuario.id and request.user.rol != 'admin':
            return Response(
                {'error': 'No autorizado'},
                status=status.HTTP_403_FORBIDDEN
            )
        serializer = UsuarioSerializer(usuario)
        return Response(serializer.data)

    def put(self, request, pk):
        """Actualiza los datos de un usuario (parcial o total).

        El serializer valida los campos enviados y solo actualiza los que
        estén presentes. El contexto {'request': request} permite al
        serializer saber quién hace la petición para validaciones extra.
        """
        usuario = self.get_object(pk)
        if not usuario:
            return Response(
                {'error': 'No encontrado'},
                status=status.HTTP_404_NOT_FOUND
            )
        # Autorización: solo propietario o admin
        if request.user.id != usuario.id and request.user.rol != 'admin':
            return Response(
                {'error': 'No autorizado'},
                status=status.HTTP_403_FORBIDDEN
            )
        # pass_many=False por defecto, solo serializa/actualiza un objeto
        serializer = UsuarioSerializer(usuario, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()  # Actualiza el usuario en la DB
            logger.info(
                f"Usuario actualizado: {usuario.id}",
                extra={'user_id': request.user.id}
            )
            audit_logger.info(f"PERFIL ACTUALIZADO user_id={usuario.id} por admin={request.user.id}")
            return Response({'mensaje': 'Actualizado', 'usuario': serializer.data})
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        """Desactiva un usuario (soft delete). Solo accesible por admin.

        No elimina físicamente el usuario de la DB, solo marca is_active=False.
        Esto preserva la integridad referencial con partidas y otros datos.
        """
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
        # Soft delete: desactivar en vez de borrar
        usuario.is_active = False
        # update_fields optimiza la consulta SQL: solo actualiza el campo is_active
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

# ═══════════════════════════════════════════════════════════════════════════
# RECUPERACIÓN DE CONTRASEÑA
# ═══════════════════════════════════════════════════════════════════════════
# Flujo completo de recuperación de contraseña:
# 1. El usuario ingresa su email en el frontend.
# 2. Se envía un email con un enlace que contiene un token UUID.
# 3. El usuario hace clic en "Sí, soy yo" en el email.
# 4. Se verifica la identidad (token válido, no expirado).
# 5. El frontend redirige a la página de nueva contraseña.
# 6. Se valida el código y se genera un token de cambio.
# 7. El usuario ingresa la nueva contraseña.
# 8. La contraseña se actualiza en la DB y se invalida el token.

class PasswordReset(APIView):
    """Endpoint POST /api/password-reset/ - Solicita un restablecimiento de contraseña.

    Envía un email de confirmación al usuario con un enlace que contiene
    un token UUID. Este endpoint NO revela si el email existe o no
    (previene enumeración de usuarios).
    """

    permission_classes = [AllowAny]  # Público: cualquier persona puede solicitar un reset
    throttle_classes = [PasswordResetThrottle]  # Anti-abuso

    def post(self, request):
        """Procesa la solicitud de recuperación de contraseña."""
        serializer = PasswordResetSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'errores': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        email = serializer.validated_data['email']
        # Mensaje genérico que se devuelve SIEMPRE, independientemente de si el email existe
        # Esto es una práctica de seguridad para evitar enumeración de usuarios
        response_data = {
            'mensaje': 'Si el correo existe, recibirás un mensaje de confirmación',
        }

        try:
            # Buscamos el usuario por email (case-insensitive) y que esté activo
            usuario = Usuario.objects.get(email__iexact=email, is_active=True)

            # Generamos el token de recuperación (token + hash)
            token, token_hash = _generate_reset_token()

            # Eliminamos tokens anteriores de este usuario para evitar confusión
            ConfirmacionReset.objects.filter(usuario=usuario).delete()

            # Limpieza general: eliminamos tokens expirados de TODOS los usuarios
            # (tokens de más de 15 minutos de antigüedad)
            ConfirmacionReset.objects.filter(
                created_at__lt=timezone.now() - timezone.timedelta(minutes=15)
            ).delete()

            # Guardamos el HASH del token en la DB (nunca el token en texto plano)
            ConfirmacionReset.objects.create(usuario=usuario, token_hash=token_hash)

            # Construimos las URLs para los botones del email
            si_url = f"{settings.API_BASE_URL}/api/password-reset/confirmar/?token={token}"
            no_url = f"{settings.FRONTEND_URL}/login"

            # En modo DEBUG incluimos el token en la respuesta para facilitar pruebas
            if settings.DEBUG:
                response_data['token'] = token

            # HTML del email de confirmación con diseño responsive y profesional.
            # El email contiene dos botones: "Sí, soy yo" (confirma identidad)
            # y "No, cancelar" (redirige al login sin hacer nada).
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

            # Enviamos el email con la versión HTML (y texto plano como fallback).
            # fail_silently=True: si falla el envío, no lanza excepción para no
            # revelar al atacante si el email es válido.
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
            # Si el email no existe, solo registramos un log informativo.
            # NO devolvemos un error diferente para evitar enumeración de usuarios.
            logger.info(f"Intento de recuperación para email no registrado: {email}")

        # SIEMPRE devolvemos el mismo mensaje, tanto si el email existe como si no
        return Response(response_data)


class PasswordResetConfirm(APIView):
    """Endpoint POST /api/password-reset/confirm/ - Confirma el token y cambia la contraseña.

    Este endpoint se llama después de que el usuario hizo clic en "Sí, soy yo"
    en el email y desde el frontend se envía el token + la nueva contraseña.
    """

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        """Valida el token y actualiza la contraseña del usuario."""
        serializer = PasswordResetConfirmSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {'errores': serializer.errors},
                status=status.HTTP_400_BAD_REQUEST
            )

        token = serializer.validated_data['token']
        password = serializer.validated_data['password']

        # Hasheamos el token recibido para comparar con el hash almacenado en la DB.
        # Nunca comparamos tokens en texto plano.
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        try:
            # Buscamos el registro de reset usando el hash, y traemos el usuario
            # relacionado en la misma consulta (select_related optimiza el ORM)
            reset_record = ConfirmacionReset.objects.select_related('usuario').get(
                token_hash=token_hash
            )

            # Verificamos si el token ha expirado (más de 15 minutos)
            if reset_record.is_expired:
                return Response(
                    {'error': 'Token expirado. Solicita uno nuevo'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            usuario = reset_record.usuario

            # Verificación adicional de que el usuario siga activo
            if not usuario.is_active:
                return Response(
                    {'error': 'Token inválido o expirado'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Cambiamos la contraseña: set_password() hashea internamente
            usuario.set_password(password)
            # Reseteamos el contador de intentos fallidos y el bloqueo temporal
            # porque el usuario ya demostró tener acceso al email
            usuario.failed_attempts = 0
            usuario.locked_until = None
            # Actualizamos solo los campos que cambiaron (optimización SQL)
            usuario.save(update_fields=['password', 'failed_attempts', 'locked_until'])

            # Eliminamos el token de reset para que no pueda reutilizarse
            reset_record.delete()

            logger.info(
                f"Contraseña restablecida para: {usuario.username}",
                extra={'user_id': usuario.id}
            )
            audit_logger.info(f"RESET_PASSWORD_COMPLETADO user_id={usuario.id} username={usuario.username}")

            return Response({'mensaje': 'Contraseña restablecida correctamente'})
        except ConfirmacionReset.DoesNotExist:
            # Token no encontrado en la DB: puede ser inválido o ya fue consumido
            return Response(
                {'error': 'Token inválido o expirado'},
                status=status.HTTP_400_BAD_REQUEST
            )


# ═══════════════════════════════════════════════════════════════════════════
# PLANTILLAS HTML PARA CONFIRMACIÓN DE IDENTIDAD
# ═══════════════════════════════════════════════════════════════════════════

# Plantilla HTML de éxito: se muestra cuando el usuario confirma su identidad
# haciendo clic en el enlace del email de recuperación de contraseña.
# Incluye un redirect automático al frontend después de 3 segundos usando
# <meta http-equiv="refresh">, con un fallback de enlace manual.
# El placeholder __REDIRECT_URL__ se reemplaza dinámicamente con la URL real.
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


# Plantilla HTML de error: se muestra cuando el enlace de recuperación es
# inválido, está expirado o el token no se encuentra en la base de datos.
# Informa al usuario que debe solicitar un nuevo restablecimiento.
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
    """Endpoint POST /api/password-reset/verificar-codigo/ - Verifica el código de confirmación.

    Este paso se usa en el flujo de recuperación de contraseña donde el usuario
    debe ingresar un código (probablemente enviado por email o SMS) antes de
    poder cambiar la contraseña. Si el código es válido, genera un token de
    cambio de contraseña.
    """

    permission_classes = [AllowAny]
    throttle_classes = [PasswordResetThrottle]

    def post(self, request):
        """Valida el código de confirmación y genera un token de cambio de contraseña."""
        # Normalizamos el email (minúsculas, sin espacios) para consistencia
        email = request.data.get('email', '').strip().lower()
        # El código puede tener espacios al principio/final por error del usuario
        codigo = request.data.get('codigo', '').strip()

        if not email or not codigo:
            return Response(
                {'error': 'Email y código requeridos'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verificamos si el código es válido usando un método estático del modelo
        # que compara el hash del código ingresado con el hash almacenado
        confirmado = ConfirmacionReset.verificar_codigo(email, codigo)
        if confirmado:
            try:
                usuario = Usuario.objects.get(email__iexact=email, is_active=True)
                # Generamos un nuevo token de cambio de contraseña
                token, token_hash = _generate_reset_token()

                # Actualizamos el registro: reemplazamos el código hash por el token hash.
                # Esto "consume" el código y lo reemplaza con el token de cambio.
                # Usamos .update() en vez de .save() para hacerlo en una sola query SQL.
                updated = ConfirmacionReset.objects.filter(
                    usuario=usuario,
                    codigo_hash=hashlib.sha256(codigo.encode()).hexdigest()
                ).update(
                    token_hash=token_hash,      # Reemplazamos código por token
                    codigo_hash=None,            # Limpiamos el código hash (ya fue consumido)
                )

                if updated == 0:
                    # Si no se actualizó ningún registro, el código ya fue consumido o no existe
                    return Response(
                        {'valido': False, 'error': 'Código inválido'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                resp = {'valido': True}
                # En DEBUG incluimos el token para facilitar pruebas manuales
                if settings.DEBUG:
                    resp['token'] = token
                return Response(resp)
            except Usuario.DoesNotExist:
                # Email no encontrado: pasamos al flujo de error genérico
                pass

        # Código inválido o email no encontrado: mismo mensaje para prevenir enumeración
        return Response(
            {'valido': False, 'error': 'Código inválido o expirado'},
            status=status.HTTP_400_BAD_REQUEST
        )


class ConfirmarIdentidad(APIView):
    """Endpoint GET /api/password-reset/confirmar/ - Confirma la identidad del usuario.

    Este endpoint es llamado cuando el usuario hace clic en "Sí, soy yo"
    dentro del email de recuperación de contraseña. Retorna una página HTML
    (no JSON) que confirma la identidad y redirige al frontend después de 3
    segundos para que el usuario ingrese su nueva contraseña.
    """

    permission_classes = [AllowAny]
    # Usamos AnonRateThrottle en vez de PasswordResetThrottle porque este
    # endpoint es un GET y puede ser accedido desde un enlace en el email
    throttle_classes = [AnonRateThrottle]

    def get(self, request):
        """Procesa la confirmación de identidad desde el enlace del email."""
        # Extraemos el token de los parámetros de la URL (?token=xxx)
        token = request.query_params.get('token', '')

        if not token:
            # Sin token: mostramos página de error HTML (no JSON, porque es una
            # petición GET de un navegador, no de la API)
            return HttpResponse(ERROR_HTML, content_type='text/html', status=400)

        try:
            # Hasheamos el token para buscarlo en la DB
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

            # Marcamos el token como confirmado para que el frontend sepa que
            # la identidad fue verificada correctamente
            reset_record.confirmado = True
            reset_record.save(update_fields=['confirmado'])

            # Construimos la URL de redirección al frontend con el token
            redirect_url = f"{settings.FRONTEND_URL}/forgot-password?token={token}&confirmed=1"
            # Reemplazamos el placeholder en el HTML con la URL real
            return HttpResponse(
                SUCCESS_HTML.replace('__REDIRECT_URL__', redirect_url),
                content_type='text/html'
            )

        except (ConfirmacionReset.DoesNotExist, ValueError) as e:
            # Token no encontrado, expirado o usuario inactivo
            logger.error(f"[ConfirmarIdentidad] ERROR: {e}")
            return HttpResponse(ERROR_HTML, content_type='text/html', status=400)


class VerificarConfirmacion(APIView):
    """Endpoint GET /api/password-reset/verificar-confirmacion/ - Consulta el estado de confirmación.

    El frontend llama a este endpoint para saber si el usuario ya confirmó
    su identidad haciendo clic en el enlace del email. Devuelve un booleano
    que indica si el token fue confirmado exitosamente.
    """

    permission_classes = [AllowAny]
    throttle_classes = []  # Sin throttle: es una consulta simple del frontend

    def get(self, request):
        """Devuelve el estado de confirmación del token."""
        token = request.query_params.get('token', '')
        if not token:
            logger.info('[VerificarConfirmacion] No token provided')
            return Response({'confirmado': False})

        # Buscamos el registro de reset por el hash del token
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        try:
            reset_record = ConfirmacionReset.objects.get(token_hash=token_hash)
            expired = reset_record.is_expired
            logger.info(f'[VerificarConfirmacion] user={reset_record.usuario_id} confirmado={reset_record.confirmado} expired={expired}')
            if expired:
                return Response({'confirmado': False})
            # Devolvemos el valor del campo 'confirmado' del registro
            return Response({'confirmado': reset_record.confirmado})
        except ConfirmacionReset.DoesNotExist:
            # Token no encontrado: devolvemos los primeros 16 caracteres del hash
            # en el log para facilitar la depuración (no el hash completo por seguridad)
            logger.info(f'[VerificarConfirmacion] Record not found for hash prefix={token_hash[:16]}')
            return Response({'confirmado': False})

# ═══════════════════════════════════════════════════════════════════════════
# GESTIÓN DE NIVELES DEL JUEGO
# ═══════════════════════════════════════════════════════════════════════════

class NivelListView(APIView):
    """Endpoint para listar y crear niveles del juego.

    - GET /api/niveles/ - Lista todos los niveles (público, sin autenticación).
    - POST /api/niveles/ - Crea un nuevo nivel (solo admin).

    Los permisos y autenticación se manejan dinámicamente según el método HTTP:
    - GET: AllowAny + sin autenticación (cualquiera puede ver los niveles).
    - POST: IsAuthenticated + JWTAuthentication (solo admin puede crear).
    """

    pagination_class = PageNumberPagination
    page_size = 50  # Máximo de niveles por página

    def get_permissions(self):
        """Retorna permisos dinámicos según el método HTTP.

        GET es público (AllowAny) porque cualquier persona (incluso sin cuenta)
        puede ver los niveles disponibles. POST requiere autenticación.
        """
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_authentication_classes(self):
        """Retorna clases de autenticación dinámicas según el método.

        GET no requiere autenticación (lista pública).
        POST requiere JWT para verificar que el usuario es admin.
        """
        if self.request.method == 'GET':
            return []  # Sin autenticación para GET
        return [JWTAuthentication()]

    def get(self, request):
        """Devuelve todos los niveles ordenados por dificultad y nombre, paginados."""
        # Primero ordena por dificultad (facil < medio < dificil), luego alfabéticamente
        niveles = Nivel.objects.all().order_by('dificultad', 'nombre')
        paginator = self.pagination_class()
        paginator.page_size = self.page_size
        page_obj = paginator.paginate_queryset(niveles, request)
        serializer = NivelSerializer(page_obj, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        """Crea un nuevo nivel. Solo accesible por usuarios admin."""
        if request.user.rol != 'admin':
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        serializer = NivelSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()  # Crea el nivel en la DB
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

# ═══════════════════════════════════════════════════════════════════════════
# GESTIÓN DE PARTIDAS
# ═══════════════════════════════════════════════════════════════════════════

class PartidaListView(APIView):
    """Endpoint para listar y crear partidas del usuario actual.

    - GET /api/partidas/ - Lista las partidas del usuario autenticado.
    - POST /api/partidas/ - Registra una nueva partida.

    Cada usuario solo puede ver sus propias partidas (filtrado por usuario=request.user).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination
    page_size = 20  # 20 partidas por página

    def get(self, request):
        """Devuelve las partidas del usuario actual, ordenadas por fecha descendente."""
        # select_related('nivel', 'usuario') optimiza las consultas al traer
        # los datos del nivel y usuario en la misma query SQL (JOIN).
        # filter(usuario=request.user) asegura que solo vea sus propias partidas.
        # order_by('-fecha') ordena de más reciente a más antigua (el - invierte el orden).
        partidas = Partida.objects.select_related('nivel', 'usuario').filter(usuario=request.user).order_by('-fecha')
        paginator = self.pagination_class()
        paginator.page_size = self.page_size
        page_obj = paginator.paginate_queryset(partidas, request)
        serializer = PartidaSerializer(page_obj, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        """Registra una nueva partida para el usuario autenticado.

        El serializer valida los datos (nivel, puntuación, etc).
        usuario=request.user asigna automáticamente el usuario actual como
        el propietario de la partida.
        """
        serializer = PartidaCreateSerializer(data=request.data)
        if serializer.is_valid():
            # save(usuario=request.user) pasa el usuario al método create()
            # del serializer para que lo asigne a la partida
            partida = serializer.save(usuario=request.user)
            # Re-serializamos la partida creada con el serializer completo
            # para devolver todos los campos (incluyendo id, fecha, etc.)
            data = PartidaSerializer(partida).data
            return Response(data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PartidaDetailView(APIView):
    """Endpoint GET /api/partidas/<pk>/ - Ver detalles de una partida específica.

    Solo el propietario de la partida o un admin pueden ver sus detalles.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        """Busca una partida por su primary key. Devuelve None si no existe."""
        try:
            return Partida.objects.get(pk=pk)
        except Partida.DoesNotExist:
            return None

    def get(self, request, pk):
        """Devuelve los detalles de una partida específica."""
        partida = self.get_object(pk)
        if not partida:
            return Response({'error': 'No encontrada'}, status=status.HTTP_404_NOT_FOUND)
        # Autorización: solo el dueño de la partida o un admin pueden verla
        if partida.usuario_id != request.user.id and request.user.rol != 'admin':
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        serializer = PartidaSerializer(partida)
        return Response(serializer.data)

# ═══════════════════════════════════════════════════════════════════════════
# RANKING POR PUNTUACIÓN
# ═══════════════════════════════════════════════════════════════════════════

class RankingView(APIView):
    """Endpoint GET /api/ranking/ - Muestra el top 20 de jugadores por mejor puntuación.

    Público (sin autenticación) para que cualquiera pueda ver el ranking.
    Utiliza agregaciones de Django ORM para calcular estadísticas por usuario
    en una sola query SQL eficiente.

    Muestra para cada jugador:
    - Posición en el ranking
    - Mejor puntuación individual
    - Total de partidas jugadas
    - Promedio de puntuación
    """

    permission_classes = [AllowAny]

    def get(self, request):
        """Devuelve el ranking de los 20 mejores jugadores."""
        # values() agrupa por usuario
        # annotate() calcula métricas agregadas para cada grupo:
        #   - Max('puntuacion'): mejor puntuación del jugador
        #   - Count('id'): total de partidas jugadas
        #   - Avg('puntuacion'): promedio de todas sus puntuaciones
        # filter(mejor_puntuacion__isnull=False): excluye usuarios sin partidas
        # order_by('-mejor_puntuacion'): mejor puntuación primero
        # [:20]: limita a los 20 mejores
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
        # Convertimos los resultados a una lista de diccionarios con la posición
        # enumerate(ranking) genera pares (índice, resultado) para calcular la posición
        data = [
            {
                'posicion': i + 1,  # Posición empieza en 1, no en 0
                'usuario_id': r['usuario'],
                'username': r['usuario__username'],
                'mejor_puntuacion': r['mejor_puntuacion'],
                'total_partidas': r['total_partidas'],
                # round() redondea a 1 decimal. El 'or 0' maneja el caso None
                'promedio_puntuacion': round(r['promedio_puntuacion'], 1) if r['promedio_puntuacion'] else None,
            }
            for i, r in enumerate(ranking)
        ]
        return Response(data)

# ═══════════════════════════════════════════════════════════════════════════
# ESTADÍSTICAS DEL USUARIO
# ═══════════════════════════════════════════════════════════════════════════

class UserStatsView(APIView):
    """Endpoint GET /api/user-stats/ - Estadísticas detalladas del usuario autenticado.

    Muestra métricas personales como mejor/peor puntuación, promedio,
    nivel favorito, distribución por dificultad, tiempo total jugado, etc.

    Si el usuario no tiene partidas, devuelve todos los valores en 0/null.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Calcula y devuelve las estadísticas completas del usuario."""
        # Filtramos todas las partidas del usuario actual
        partidas = Partida.objects.filter(usuario=request.user)
        total = partidas.count()

        # Si el usuario no tiene partidas, devolvemos valores por defecto
        # para evitar errores con funciones de agregación sobre conjuntos vacíos
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

        # aggregate() ejecuta funciones de agregación SQL en una sola consulta:
        # MAX, MIN, AVG, SUM sobre las columnas de partidas del usuario
        stats = partidas.aggregate(
            mejor_puntuacion=Max('puntuacion'),
            peor_puntuacion=Min('puntuacion'),
            promedio_puntuacion=Avg('puntuacion'),
            total_muertes=Sum('muertes'),
            promedio_muertes=Avg('muertes'),
            tiempo_total=Sum('tiempo'),
        )

        # Encontramos el nivel más jugado (nivel favorito) agrupando por nombre
        # y contando cuántas veces aparece cada uno, ordenando de mayor a menor
        nivel_favorito = (
            partidas.values('nivel__nombre')
            .annotate(total=Count('id'))
            .order_by('-total')
            .first()
        )

        # Contamos partidas por dificultad (facil, medio, dificil)
        por_dificultad = (
            partidas.values('nivel__dificultad')
            .annotate(total=Count('id'))
        )
        # Inicializamos el mapa con todos los valores en 0
        dificultad_map = {'facil': 0, 'medio': 0, 'dificil': 0}
        for d in por_dificultad:
            key = d['nivel__dificultad']
            if key in dificultad_map:
                dificultad_map[key] = d['total']

        # Serializamos todos los datos calculados y los devolvemos como JSON
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

# ═══════════════════════════════════════════════════════════════════════════
# CAMBIO DE CONTRASEÑA (USUARIO AUTENTICADO)
# ═══════════════════════════════════════════════════════════════════════════

class ChangePasswordView(APIView):
    """Endpoint POST /api/change-password/ - Cambia la contraseña del usuario autenticado.

    Requiere la contraseña actual para verificar la identidad, y valida que
    la nueva contraseña cumpla con los requisitos de seguridad.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    throttle_classes = [ChangePasswordThrottle]  # Limita cambios de contraseña por usuario

    def post(self, request):
        """Procesa el cambio de contraseña del usuario."""
        usuario = request.user
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')
        confirm_password = request.data.get('confirm_password', '')

        # Verificamos que la contraseña actual sea correcta antes de permitir el cambio
        # check_password() compara contra el hash en la DB
        if not usuario.check_password(old_password):
            return Response(
                {'error': 'La contraseña actual no es correcta'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validamos la fortaleza de la nueva contraseña usando la utilidad personalizada
        # que verifica longitud, mayúsculas, números, caracteres especiales, etc.
        password_errors = check_password_strength(new_password)
        if password_errors:
            return Response(
                {'errores': {'new_password': password_errors}},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Verificamos que la nueva contraseña y la confirmación coincidan
        if new_password != confirm_password:
            return Response(
                {'error': 'Las contraseñas no coinciden'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Actualizamos la contraseña: set_password() hashea internamente
        usuario.set_password(new_password)
        # Solo actualizamos el campo password (optimización SQL)
        usuario.save(update_fields=['password'])

        logger.info(f"Contraseña cambiada: {usuario.username}", extra={
            'user_id': usuario.id,
            'username': usuario.username,
        })
        audit_logger.info(f"CONTRASEÑA_CAMBIADA user_id={usuario.id} username={usuario.username}")

        return Response({'mensaje': 'Contraseña actualizada correctamente'})

# ═══════════════════════════════════════════════════════════════════════════
# ADMIN: GESTIÓN DE NIVELES (PUT/DELETE)
# ═══════════════════════════════════════════════════════════════════════════

class NivelDetailView(APIView):
    """Endpoint para editar o eliminar un nivel específico. Solo admin.

    - PUT /api/niveles/<pk>/ - Actualiza un nivel (parcial o total).
    - DELETE /api/niveles/<pk>/ - Elimina un nivel permanentemente.

    A diferencia de los usuarios (soft delete), los niveles se eliminan
    físicamente de la DB porque no tienen dependencias críticas de auditoría.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_object(self, pk):
        """Busca un nivel por su primary key."""
        try:
            return Nivel.objects.get(pk=pk)
        except Nivel.DoesNotExist:
            return None

    def put(self, request, pk):
        """Actualiza un nivel existente. Solo admin.

        partial=True permite enviar solo algunos campos (actualización parcial),
        por ejemplo, solo cambiar la dificultad sin tocar el nombre.
        """
        if request.user.rol != 'admin':
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        nivel = self.get_object(pk)
        if not nivel:
            return Response({'error': 'No encontrado'}, status=status.HTTP_404_NOT_FOUND)
        # partial=True: permite actualización parcial (solo campos enviados)
        serializer = NivelSerializer(nivel, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        """Elimina un nivel permanentemente de la DB. Solo admin."""
        if request.user.rol != 'admin':
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        nivel = self.get_object(pk)
        if not nivel:
            return Response({'error': 'No encontrado'}, status=status.HTTP_404_NOT_FOUND)
        nivel.delete()  # Eliminación física de la DB
        return Response({'mensaje': 'Nivel eliminado'})

# ═══════════════════════════════════════════════════════════════════════════
# ADMIN: VISIÓN GENERAL DE PARTIDAS
# ═══════════════════════════════════════════════════════════════════════════

class AdminPartidasView(APIView):
    """Endpoint GET /api/admin/partidas/ - Lista TODAS las partidas de TODOS los usuarios.

    Solo accesible por admin. A diferencia de PartidaListView que solo muestra
    las partidas del usuario actual, esta vista muestra todas las partidas
    del sistema para monitoreo y gestión administrativa.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination
    page_size = 50  # Más partidas por página que la vista normal del usuario

    def get(self, request):
        """Devuelve todas las partidas del sistema, paginadas y ordenadas por fecha."""
        if request.user.rol != 'admin':
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)
        # select_related trae los datos de usuario y nivel en la misma query SQL
        # para evitar el problema N+1 (una query adicional por cada partida)
        partidas = Partida.objects.select_related('usuario', 'nivel').order_by('-fecha')
        paginator = self.pagination_class()
        paginator.page_size = self.page_size
        page_obj = paginator.paginate_queryset(partidas, request)
        serializer = PartidaSerializer(page_obj, many=True)
        return paginator.get_paginated_response(serializer.data)

# ═══════════════════════════════════════════════════════════════════════════
# ADMIN: ESTADÍSTICAS DEL SISTEMA
# ═══════════════════════════════════════════════════════════════════════════

class AdminStatsView(APIView):
    """Endpoint GET /api/admin/stats/ - Estadísticas generales del sistema.

    Solo accesible por admin. Muestra métricas globales como total de
    usuarios, partidas, niveles, mejor puntuación global, y el jugador
    más activo del sistema.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Calcula y devuelve las estadísticas globales del sistema."""
        if request.user.rol != 'admin':
            return Response({'error': 'No autorizado'}, status=status.HTTP_403_FORBIDDEN)

        # Conteo total de cada modelo del sistema
        total_usuarios = Usuario.objects.count()
        total_partidas = Partida.objects.count()
        total_niveles = Nivel.objects.count()

        # Agregaciones globales sobre todas las partidas de todos los usuarios
        stats_partidas = Partida.objects.aggregate(
            mejor_puntuacion=Max('puntuacion'),
            promedio_puntuacion=Avg('puntuacion'),
            total_muertes=Sum('muertes'),
        )

        # Encontramos el jugador con más partidas jugadas
        # values() + annotate() + order_by() + first() es el patrón de
        # Django ORM para encontrar el registro con la mayor cantidad
        top_jugador = (
            Partida.objects.values('usuario__username')
            .annotate(total=Count('id'))
            .order_by('-total')
            .first()
        )

        # Devolvemos todas las métricas como un diccionario JSON
        return Response({
            'total_usuarios': total_usuarios,
            'total_partidas': total_partidas,
            'total_niveles': total_niveles,
            # 'or 0' maneja el caso donde aggregate() retorna None (DB vacía)
            'mejor_puntuacion_global': stats_partidas['mejor_puntuacion'] or 0,
            'promedio_puntuacion_global': round(stats_partidas['promedio_puntuacion'] or 0, 1),
            'total_muertes_global': stats_partidas['total_muertes'] or 0,
            'jugador_mas_activo': top_jugador['usuario__username'] if top_jugador else None,
        })
