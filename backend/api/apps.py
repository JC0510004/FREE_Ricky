# Importa AppConfig, la clase base para configurar apps en Django.
# AppConfig permite definir metadatos de la app y ejecutar código al iniciar.
from django.apps import AppConfig


# ─── CONFIGURACIÓN DE LA APP API ───────────────────────────────────────
# ApiConfig: Configuración de la aplicación principal 'api'.
# Contiene todos los modelos, vistas, serializers y lógica de negocio del proyecto.
class ApiConfig(AppConfig):
    # 'name' debe coincidir con el directorio de la app (api/).
    # Django usa este nombre para resolver imports y referencias en settings.
    name = 'api'
