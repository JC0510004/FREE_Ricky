#!/bin/sh
# set -e: Termina el script inmediatamente si cualquier comando falla.
# Esto evita que la app arranque con errores (ej: migraciones fallidas).
set -e

# ─── DIRECTORIO DE LOGS ───────────────────────────────────────────────
# Aquí NO se toca el propietario, y es deliberado.
#
# Este script ya corre como appuser (USER appuser en el Dockerfile), y chown
# exige privilegios de root. Intentar arreglar el volumen aquí daba:
#
#   chown: changing ownership of '/app/logs': Operation not permitted
#
# y con `set -e` el contenedor salía con código 1, entraba en crash loop con
# `restart: unless-stopped` y nunca llegaba a arrancar la aplicación.
#
# El problema de fondo NO es este script: es que /app/logs no existía en la
# imagen (`.dockerignore` excluye `logs/`), así que el volumen nombrado
# `backend_logs` lo creaba Docker como root:root. La solución es de lado
# imagen: /app/logs se crea en el Dockerfile ANTES del `chown -R`, y Docker
# inicializa el volumen vacío conservando el propietario de ese directorio.
# Ver la nota larga del Dockerfile.
#
# El mkdir -p de aquí es un no-op en el caso normal (el directorio ya existe en
# la imagen) y solo cubre ejecutar la imagen sin el volumen montado.
mkdir -p /app/logs

# ─── MIGRACIONES ───────────────────────────────────────────────────────
# A propósito separado del arranque y sin `sh -c "a && b"`:
# con `set -e`, si la migración falla el script aborta aquí y Gunicorn no
# llega a escucharse. Encadenarlas con `&&` dentro de un `sh -c` obligaba a
# tirar de un subshell, y el subshell es justo lo que hacía que Gunicorn no
# fuera PID 1 (ver ARRANCQUE DE LA APLICACIÓN).
python manage.py migrate --noinput

# ─── ARRANQUE DE LA APLICACIÓN ──────────────────────────────────────────
# exec reemplaza el proceso del script por Gunicorn, de modo que Gunicorn
# pasa a ser PID 1 y recibe SIGTERM directamente en `docker stop`, con su
# cierre limpio (drena peticiones en vuelo en vez de morir de golpe).
#
# Antes de esto había un `exec runuser -u appuser -- sh -c "migrate && gunicorn"`,
# que estaba roto por partida doble:
#   1. runuser es una herramienta root-only: `runuser: may not be used by
#      non-root users`. El proceso ya era appuser, así que solo bajaba
#      privilegios... otra vez, y fallando.
#   2. runuser y `sh -c` crean un proceso hijo, así que Gunicorn no era PID 1
#      y el `exec` de la línea no cumplía lo que decía el comentario.
# Con USER appuser en el Dockerfile ya no hace falta runuser para nada.
exec gunicorn -w 2 --threads 2 --bind 0.0.0.0:8000 --timeout 120 --no-control-socket config.wsgi:application

# python manage.py migrate --noinput:
#   Ejecuta las migraciones pendientes de Django automáticamente.
#   --noinput: No muestra prompts interactivos (necesario en containers).
#
# gunicorn -w 2 --threads 2 --bind 0.0.0.0:8000 --timeout 120 --no-control-socket config.wsgi:application:
#   -w 2: 2 workers (procesos) para manejar peticiones en paralelo.
#   --threads 2: 2 threads por worker para concurrencia adicional.
#   --bind 0.0.0.0:8000: Escucha en todas las interfaces de red, puerto 8000.
#     El puerto NO se publica en el host (docker-compose.yml usa `expose`, no
#     `ports`): todo entra por nginx, que es donde estan los limit_req por IP.
#   --timeout 120: Timeout de 120 segundos para peticiones largas.
#   --no-control-socket: Gunicorn 25.1.0 crea por defecto un socket de control
#     (gunicorn.ctl) en el directorio de trabajo. Con read_only:true el FS es de
#     solo lectura y Gunicorn loguea "Control server error: [Errno 30] Read-only
#     file system". Como no usamos gunicornc para gestión en runtime, se desactiva.
#   config.wsgi:application: Punto de entrada WSGI (donde está la app Django).
