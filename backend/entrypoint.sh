#!/bin/sh
# set -e: Termina el script inmediatamente si cualquier comando falla.
# Esto evita que la app arranque con errores (ej: migraciones fallidas).
set -e

# ─── PERMISOS DEL DIRECTORIO DE LOGS ───────────────────────────────────
# Crea el directorio de logs si no existe (necesario para el logging de Django).
# El volumen Docker puede ser montado por root, así que reasignamos ownership.
mkdir -p /app/logs
chown appuser:appuser /app/logs

# ─── ARRANCO DE LA APLICACIÓN ──────────────────────────────────────────
# exec reemplaza el proceso shell con el proceso que se ejecuta.
# Esto asegura que Gunicorn reciba las señales del sistema correctamente.
# runuser -u appuser: Ejecuta el siguiente comando como el usuario 'appuser' (no root).
#   Ejecutar como usuario no-root es una práctica de seguridad crítica.
# Dentro del shell de appuser se ejecutan DOS comandos en secuencia:
exec runuser -u appuser -- sh -c "python manage.py migrate --noinput && gunicorn -w 2 --threads 2 --bind 0.0.0.0:8000 --timeout 120 --no-control-socket config.wsgi:application"

# python manage.py migrate --noinput:
#   Ejecuta las migraciones pendientes de Django automáticamente.
#   --noinput: No muestra prompts interactivos (necesario en containers).
#
# gunicorn -w 2 --threads 2 --bind 0.0.0.0:8000 --timeout 120 --no-control-socket config.wsgi:application:
#   -w 2: 2 workers (procesos) para manejar peticiones en paralelo.
#   --threads 2: 2 threads por worker para concurrencia adicional.
#   --bind 0.0.0.0:8000: Escucha en todas las interfaces de red, puerto 8000.
#   --timeout 120: Timeout de 120 segundos para peticiones largas.
#   --no-control-socket: Gunicorn 25.1.0 crea por defecto un socket de control
#     (gunicorn.ctl) en el directorio de trabajo. Con read_only:true el FS es de
#     solo lectura y Gunicorn loguea "Control server error: [Errno 30] Read-only
#     file system". Como no usamos gunicornc para gestión en runtime, se desactiva.
#   config.wsgi:application: Punto de entrada WSGI (donde está la app Django).
