from django.urls import path

from .views_auth import (
    RegisterView,
    LoginView,
    RefreshTokenView,
    LogoutView,
    VerifySessionView,
)
from .views_users import (
    UsuarioListView,
    UsuarioDetailView,
    ChangePasswordView,
)
from .views_password_reset import (
    PasswordReset,
    PasswordResetConfirm,
    ConfirmarIdentidad,
    VerificarConfirmacion,
    VerificarCodigo,
)
from .views_game import (
    NivelListView,
    NivelDetailView,
    PartidaListView,
    PartidaDetailView,
    RankingView,
    UserStatsView,
)
from .views_admin import (
    AdminPartidasView,
    AdminStatsView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', RefreshTokenView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('verify/', VerifySessionView.as_view(), name='verify_session'),
    path('ranking/', RankingView.as_view(), name='ranking'),
    path('usuarios/', UsuarioListView.as_view(), name='usuario_list'),
    path('usuarios/<int:pk>/', UsuarioDetailView.as_view(), name='usuario_detail'),
    path('password-reset/', PasswordReset.as_view(), name='password_reset'),
    path('password-reset/confirm/', PasswordResetConfirm.as_view(), name='password_reset_confirm'),
    path('password-reset/confirmar/', ConfirmarIdentidad.as_view(), name='password_reset_confirmar'),
    path('password-reset/verificar/', VerificarConfirmacion.as_view(), name='password_reset_verificar'),
    path('password-reset/verificar-codigo/', VerificarCodigo.as_view(), name='password_reset_verificar_codigo'),
    path('niveles/', NivelListView.as_view(), name='nivel_list'),
    path('partidas/', PartidaListView.as_view(), name='partida_list'),
    path('partidas/<int:pk>/', PartidaDetailView.as_view(), name='partida_detail'),
    path('estadisticas/', UserStatsView.as_view(), name='user_stats'),
    path('cambiar-password/', ChangePasswordView.as_view(), name='change_password'),
    path('niveles/<int:pk>/', NivelDetailView.as_view(), name='nivel_detail'),
    path('admin/partidas/', AdminPartidasView.as_view(), name='admin_partidas'),
    path('admin/stats/', AdminStatsView.as_view(), name='admin_stats'),
]
