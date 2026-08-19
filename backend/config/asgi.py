"""
ASGI config for config project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
"""

# Importa el módulo 'os' para acceder a variables de entorno del sistema.
import os

# Importa la función get_asgi_application de Django.
# ASGI (Asynchronous Server Gateway Interface) es la sucesora de WSGI,
# permitiendo manejo asíncrono de peticiones, WebSockets y conexiones persistentes.
from django.core.asgi import get_asgi_application

# Establece la variable de entorno DJANGO_SETTINGS_MODULE por defecto.
# Le indica a Django qué archivo de configuración usar al iniciar ASGI.
# setdefault permite override desde el entorno (testing, CI, producción).
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Crea y expone la aplicación ASGI como variable 'application'.
# Se usa con servidores asíncronos como Daphne o Uvicorn.
# Ejemplo: daphne -b 0.0.0.0 -p 8000 config.asgi:application
application = get_asgi_application()
