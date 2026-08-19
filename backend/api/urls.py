# Importa path de Django para definir patrones de URL.
from django.urls import path

# ─── IMPORTACIÓN DE VISTAS ─────────────────────────────────────────────
# Importa todas las vistas (class-based views) desde el módulo views de la app api.
# Cada vista maneja un endpoint específico de la API.
from .views import (
    # ── Autenticación ──
    RegisterView,        # Registro de nuevos usuarios
    LoginView,           # Inicio de sesión y obtención de tokens JWT
    RefreshTokenView,    # Renovación de tokens de acceso
    LogoutView,          # Cierre de sesión y blacklist del token
    VerifySessionView,   # Verificación de si la sesión sigue activa

    # ── Usuarios ──
    UsuarioListView,     # Listado de todos los usuarios
    UsuarioDetailView,   # Detalle/edición de un usuario específico

    # ── Recuperación de contraseña ──
    PasswordReset,            # Solicita reset de contraseña (envía email)
    PasswordResetConfirm,     # Confirma el reset con token nuevo
    ConfirmarIdentidad,       # Confirma identidad del usuario (paso previo)
    VerificarConfirmacion,    # Verificación de confirmación de identidad
    VerificarCodigo,          # Verificación de código de seguridad

    # ── Contenido del juego ──
    NivelListView,       # Listado de niveles disponibles
    PartidaListView,     # Listado de partidas (general)
    PartidaDetailView,   # Detalle de una partida específica

    # ── Estadísticas y ranking ──
    RankingView,         # Tabla de rankings globales
    UserStatsView,       # Estadísticas del usuario actual

    # ── Gestión de cuenta ──
    ChangePasswordView,  # Cambio de contraseña (siendo usuario autenticado)
    NivelDetailView,     # Detalle de un nivel específico

    # ── Panel de administración ──
    AdminPartidasView,   # Gestión de partidas (solo admins)
    AdminStatsView,      # Estadísticas generales del sistema (solo admins)
)

# ─── PATRONES DE URL DE LA API ─────────────────────────────────────────
# urlpatterns: Define todos los endpoints de la API REST.
# Todas las rutas están bajo el prefijo /api/ (definido en config/urls.py).
urlpatterns = [
    # ── Autenticación ──
    # POST: Registra un nuevo usuario con email y contraseña.
    path('register/', RegisterView.as_view(), name='register'),

    # POST: Inicia sesión con credenciales y devuelve tokens JWT.
    path('login/', LoginView.as_view(), name='login'),

    # POST: Renueva el token de acceso usando el refresh token.
    path('token/refresh/', RefreshTokenView.as_view(), name='token_refresh'),

    # POST: Cierra sesión e invalida el token actual (blacklist).
    path('logout/', LogoutView.as_view(), name='logout'),

    # GET: Verifica si el token de la sesión sigue siendo válido.
    path('verify/', VerifySessionView.as_view(), name='verify_session'),

    # ── Ranking ──
    # GET: Retorna el ranking global de jugadores ordenados por puntuación.
    path('ranking/', RankingView.as_view(), name='ranking'),

    # ── Usuarios ──
    # GET: Lista todos los usuarios registrados (requiere permisos de admin).
    path('usuarios/', UsuarioListView.as_view(), name='usuario_list'),

    # GET/PUT/PATCH/DELETE: Operaciones CRUD sobre un usuario específico por ID.
    path('usuarios/<int:pk>/', UsuarioDetailView.as_view(), name='usuario_detail'),

    # ── Recuperación de contraseña ──
    # POST: Solicita restablecimiento de contraseña (envía email con código).
    path('password-reset/', PasswordReset.as_view(), name='password_reset'),

    # POST: Confirma el restablecimiento con el token recibido por email.
    path('password-reset/confirm/', PasswordResetConfirm.as_view(), name='password_reset_confirm'),

    # POST: Primer paso de recuperación - confirma la identidad del usuario.
    path('password-reset/confirmar/', ConfirmarIdentidad.as_view(), name='password_reset_confirmar'),

    # POST: Verifica la confirmación de identidad antes de permitir el cambio.
    path('password-reset/verificar/', VerificarConfirmacion.as_view(), name='password_reset_verificar'),

    # POST: Verifica el código de 6 dígitos enviado por email.
    path('password-reset/verificar-codigo/', VerificarCodigo.as_view(), name='password_reset_verificar_codigo'),

    # ── Contenido del juego ──
    # GET: Retorna la lista de todos los niveles del juego.
    path('niveles/', NivelListView.as_view(), name='nivel_list'),

    # GET: Retorna las partidas del usuario actual o todas (según permisos).
    path('partidas/', PartidaListView.as_view(), name='partida_list'),

    # GET/PUT/PATCH/DELETE: Operaciones sobre una partida específica por ID.
    path('partidas/<int:pk>/', PartidaDetailView.as_view(), name='partida_detail'),

    # ── Estadísticas ──
    # GET: Retorna estadísticas del usuario autenticado (partidas, niveles, etc).
    path('estadisticas/', UserStatsView.as_view(), name='user_stats'),

    # ── Gestión de cuenta ──
    # PUT/PATCH: Cambia la contraseña del usuario autenticado (requiere contraseña actual).
    path('cambiar-password/', ChangePasswordView.as_view(), name='change_password'),

    # GET: Retorna el detalle de un nivel específico por ID.
    path('niveles/<int:pk>/', NivelDetailView.as_view(), name='nivel_detail'),

    # ── Panel de administración ──
    # GET/POST/PUT/DELETE: CRUD de partidas desde el panel de administración.
    path('admin/partidas/', AdminPartidasView.as_view(), name='admin_partidas'),

    # GET: Estadísticas globales del sistema para administradores.
    path('admin/stats/', AdminStatsView.as_view(), name='admin_stats'),
]
