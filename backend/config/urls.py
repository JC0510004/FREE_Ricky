"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
# Importa el módulo de administración de Django para acceder al panel admin.
from django.contrib import admin
# Importa path para definir rutas URL e include para delegar rutas a otras apps.
from django.urls import path, include
# Vistas de drf-spectacular para servir el esquema OpenAPI y las UIs de Swagger/Redoc.
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

# ─── PATRONES DE URL PRINCIPALES ───────────────────────────────────────
# urlpatterns: Lista de rutas URL que Django procesa de arriba a abajo.
urlpatterns = [
    # Panel de administración de Django (solo accesible por superusuarios).
    path('admin/', admin.site.urls),
    # Todas las rutas de la API se delegan a la app 'api' (api/urls.py).
    # Esto mantiene la separación de concerns y el código organizado.
    path('api/', include('api.urls')),
    # Esquema OpenAPI 3.0 de la API (formato JSON/YAML descargable).
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    # Documentación interactiva: Swagger UI.
    path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    # Documentación alternativa: Redoc.
    path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]
