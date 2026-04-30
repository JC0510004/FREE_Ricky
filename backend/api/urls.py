from django.urls import path
from .views import UsuarioListCreateView, UsuarioDetailView, LoginView

urlpatterns = [
    path('usuarios/', UsuarioListCreateView.as_view()),        # GET listar / POST registrar
    path('usuarios/<int:pk>/', UsuarioDetailView.as_view()),   # GET / PUT / DELETE
    path('login/', LoginView.as_view()),                        # POST login
]