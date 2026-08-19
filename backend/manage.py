#!/usr/bin/env python
"""Django's command-line utility for administrative tasks."""
# Importa os para acceder a variables de entorno del sistema operativo.
import os
# Importa sys para acceder a los argumentos de línea de comandos (sys.argv).
import sys


# ─── FUNCIÓN PRINCIPAL ─────────────────────────────────────────────────
# main(): Punto de entrada de la utilidad de línea de comandos de Django.
# Ejecuta comandos como: python manage.py runserver, migrate, createsuperuser, etc.
def main():
    """Run administrative tasks."""
    # Establece qué archivo de configuración de Django usar por defecto.
    # Esto permite ejecutar manage.py desde cualquier directorio del sistema.
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    try:
        # Importa execute_from_command_line DESPUÉS de configurar el módulo de settings.
        # Si Django no está instalado, esta importación fallará y entrará al except.
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        # Mensaje de error claro cuando Django no está disponible.
        # Sugiere las causas más comunes: no instalado o sin activar virtualenv.
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    # Ejecuta el comando de Django pasado como argumento (sys.argv[1]).
    # Por ejemplo: python manage.py runserver → ejecuta 'runserver'.
    execute_from_command_line(sys.argv)


# Solo ejecuta main() si el archivo se ejecuta directamente (python manage.py).
# Si se importa como módulo, NO se ejecuta (evita ejecución accidental).
if __name__ == '__main__':
    main()
