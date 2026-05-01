from django.urls import path
from .views import RegisterView, LoginView, UsuarioListView, UsuarioDetailView

urlpatterns = [
    path('register/', RegisterView.as_view()),           # POST registrar
    path('login/', LoginView.as_view()),                 # POST login
    path('usuarios/', UsuarioListView.as_view()),        # GET listar
    path('usuarios/<int:pk>/', UsuarioDetailView.as_view()),  # PUT / DELETE
]