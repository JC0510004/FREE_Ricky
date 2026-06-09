from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    RefreshTokenView,
    LogoutView,
    VerifySessionView,
    PublicRankingView,
    UsuarioListView,
    UsuarioDetailView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', LoginView.as_view(), name='login'),
    path('token/refresh/', RefreshTokenView.as_view(), name='token_refresh'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('verify/', VerifySessionView.as_view(), name='verify_session'),
    path('ranking/', PublicRankingView.as_view(), name='public_ranking'),
    path('usuarios/', UsuarioListView.as_view(), name='usuario_list'),
    path('usuarios/<int:pk>/', UsuarioDetailView.as_view(), name='usuario_detail'),
]
