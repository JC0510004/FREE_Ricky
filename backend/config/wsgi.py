"""
WSGI config for config project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
"""

# Importa el módulo 'os' para acceder a variables de entorno del sistema.
import os

# Importa la función get_wsgi_application de Django.
# Esta función retorna el objeto WSGI que el servidor (Gunicorn, uWSGI, etc.)
# usará para recibir peticiones HTTP y devolver respuestas.
from django.core.wsgi import get_wsgi_application

# Establece la variable de entorno DJANGO_SETTINGS_MODULE por defecto.
# Esto le indica a Django qué archivo de configuración usar (config/settings.py).
# setdefault NO sobreescribe si la variable ya existe en el entorno,
# lo que permite configurar un archivo de settings diferente en testing o CI.
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Crea y expone la aplicación WSGI como variable 'application'.
# Es el punto de entrada que Gunicorn ejecuta: gunicorn config.wsgi:application
application = get_wsgi_application()
