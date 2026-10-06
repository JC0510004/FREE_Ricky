# Importa AppConfig, la clase base para configurar apps en Django.
# AppConfig permite definir metadatos de la app y ejecutar código al iniciar.
import logging
import sys

from django.apps import AppConfig
from django.conf import settings


# ─── CONFIGURACIÓN DE LA APP API ───────────────────────────────────────
# ApiConfig: Configuración de la aplicación principal 'api'.
# Contiene todos los modelos, vistas, serializers y lógica de negocio del proyecto.
class ApiConfig(AppConfig):
    # 'name' debe coincidir con el directorio de la app (api/).
    # Django usa este nombre para resolver imports y referencias en settings.
    name = 'api'

    def ready(self):
        # Aviso de arranque: sin EMAIL_HOST_USER/EMAIL_HOST_PASSWORD, settings
        # cambia a backend de consola y los correos NO salen: se imprimen en el
        # terminal del servidor. La API sigue respondiendo 200 y el frontend
        # sigue diciendo "Correo enviado", así que el fallo es silencioso y el
        # síntoma es el de unos flujos que "no funcionan" (verificación y
        # restablecimiento de contraseña). Ver config/settings.py, bloque EMAIL.
        #
        # Se salta en tests: ahí Django usa el backend de locmem a propósito y
        # este aviso solo ensuciaría la salida.
        if 'test' in sys.argv:
            return
        if settings.EMAIL_BACKEND.endswith('console.EmailBackend'):
            logging.getLogger('seguridad').warning(
                "EMAIL SIN CONFIGURAR: EMAIL_HOST_USER/EMAIL_HOST_PASSWORD están vacíos, "
                "así que los correos NO se envían y acaban en la terminal (backend de "
                "consola). Configura una App Password de Gmail en .env y comprueba con "
                "`python manage.py sendtestemail tu@correo.com`."
            )
