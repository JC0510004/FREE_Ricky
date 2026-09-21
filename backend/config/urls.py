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
from django.conf import settings
# Importa path para definir rutas URL e include para delegar rutas a otras apps.
from django.urls import path, include
# AdminSite endurecido (rate limiting + lockout en el login).
from config.admin_site import secure_admin_site
# Vistas de drf-spectacular para servir el esquema OpenAPI y las UIs de Swagger/Redoc.
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

# ─── PATRONES DE URL PRINCIPALES ───────────────────────────────────────
# urlpatterns: Lista de rutas URL que Django procesa de arriba a abajo.
urlpatterns = [
    # Todas las rutas de la API se delegan a la app 'api' (api/urls.py).
    # Esto mantiene la separación de concerns y el código organizado.
    path('api/', include('api.urls')),
]

# ─── SOLO DESARROLLO (DEBUG) ────────────────────────────────────────────
# El panel de administración de Django y la documentación OpenAPI/schema se
# sirven EXCLUSIVAMENTE en desarrollo. En producción no existen rutas para
# ellos: el admin de Django no está preparado para el modelo de usuario
# personalizado (no usa is_staff) y exponer /schema/ filtra la superficie
# completa de la API (endpoints, parámetros, modelo de datos).
if settings.DEBUG:
    urlpatterns += [
        # Panel de administración de Django (solo accesible por superusuarios).
        # Usa el AdminSite endurecido: login con rate limiting + lockout por IP.
        path('admin/', secure_admin_site.urls),
        # Esquema OpenAPI 3.0 de la API (formato JSON/YAML descargable).
        path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
        # Documentación interactiva: Swagger UI.
        path('api/schema/swagger-ui/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
        # Documentación alternativa: Redoc.
        path('api/schema/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
    ]
