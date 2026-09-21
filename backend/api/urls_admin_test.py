"""URLconf de prueba: monta únicamente el AdminSite endurecido.

Se usa exclusivamente en tests (la suite sobreescribe ROOT_URLCONF con
override_settings()) para ejercitar el rate limiting y el lockout de
/admin/login/ sin exponer el panel en los entornos normales.

No es un módulo de tests del runner (no coincide con el patrón test*.py),
así que no se descubre; solo se importa vía ROOT_URLCONF desde los tests.
"""
from django.urls import path

from config.admin_site import secure_admin_site

urlpatterns = [
    path('admin/', secure_admin_site.urls),
]
