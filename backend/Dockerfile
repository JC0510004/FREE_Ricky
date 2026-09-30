# ─── STAGE 1: BUILD ─────────────────────────────────────────────────────
# Etapa de compilación: instala dependencias y las compila.
# Se usa una imagen base de Python 3.12 en versión slim (ligera).
# El alias 'builder' permite referenciar esta etapa en la Etapa 2.
FROM python:3.12-slim AS builder

# Establece el directorio de trabajo como /app dentro del contenedor.
WORKDIR /app

# Instala las dependencias del sistema necesarias para compilar paquetes Python.
# build-essential: gcc y herramientas de compilación C.
# pkg-config: herramienta para localizar bibliotecas compartidas.
# default-libmysqlclient-dev: archivos de desarrollo de MySQL (para mysqlclient).
#
# NO se instala libpq-dev (ni libpq en la etapa de runtime): el proyecto usa
# MySQL (settings.py → django.db.backends.mysql, requirements.txt → mysqlclient,
# compose → mysql:8.0) y NO hay psycopg/psycopg2 ni django.contrib.postgres en
# ningún sitio. El comentario que justificaba libpq-dev "para psycopg2" era
# un resto de una plantilla de PostgreSQL y se llevaba por delante ~50 MB de
# imagen en las dos etapas.
# Se limpia la caché de apt para reducir el tamaño de la imagen.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential pkg-config default-libmysqlclient-dev && \
    rm -rf /var/lib/apt/lists/*

# Copia el archivo de dependencias al contenedor builder.
COPY requirements.txt .

# Instala las dependencias Python en /install (prefijo separado).
# --no-cache-dir: No guarda la caché de pip para reducir el tamaño.
# --prefix=/install: Instala en un directorio temporal que se copiará después.
# Esto separa las dependencias del código fuente en la etapa de runtime.
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ─── STAGE 2: RUNTIME ──────────────────────────────────────────────────
# Etapa de ejecución: imagen final ligera SIN herramientas de compilación.
# Solo incluye las bibliotecas compartidas necesarias para ejecutar las dependencias.
FROM python:3.12-slim AS runtime

# Instala las bibliotecas compartidas de runtime (sin -dev, sin compiladores).
# libmariadb3: cliente MariaDB/MySQL que es contra el que se enlazó mysqlclient.
# Es el único driver de base de datos que necesita la imagen; libpq se eliminó
# por el mismo motivo que en la etapa de builder (el proyecto es MySQL).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmariadb3 && \
    rm -rf /var/lib/apt/lists/*

# Crea un usuario del sistema 'appuser' sin privilegios root.
# groupadd -r: Crea un grupo del sistema (-r = rango 0-999).
# useradd: Crea el usuario con grupo appuser, home /app y sin shell de login.
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

WORKDIR /app

# Copia las dependencias Python instaladas en la etapa builder.
# Solo copia los paquetes compilados, no las herramientas de compilación.
COPY --from=builder /install /usr/local

# Copia todo el código fuente de la aplicación al contenedor.
COPY . .

# Crea el directorio de logs ANTES de cambiar propietario. Esto NO es cosmético:
# es lo que hace que el volumen nombrado `backend_logs` (docker-compose.yml lo
# monta en /app/logs) nazca escribible por appuser.
#
# El razonamiento, que es contra-intuitivo:
#
#   - Si /app/logs NO existe en la imagen, Docker tiene que crear el punto de
#     montaje del volumen, y lo crea como root:root 0755. El volumen nace de
#     root, el proceso corre como appuser (USER appuser mas abajo) y no puede
#     escribir. El único arreglo posible sería un chown en tiempo de arranque,
#     que exige root... y el proceso ya no es root.
#   - Si /app/logs SI existe en la imagen, Docker inicializa el volumen vacío
#     copiando ese directorio y CONSERVANDO su propietario. O sea: el volumen
#     nace con el mismo uid/gid que tenga aquí.
#
# Por eso el chown de abajo tiene que cubrir este directorio, y por eso el
# directorio tiene que existir antes. Ver backend/entrypoint.sh.
RUN mkdir -p /app/logs

# Cambia la propiedad de todos los archivos al usuario appuser.
# Esto permite que la app pueda leer/escribir archivos sin ser root.
# El -R es lo que deja /app/logs en manos de appuser (creado justo arriba).
RUN chown -R appuser:appuser /app

# Marca el script de entrada como ejecutable.
RUN chmod +x /app/entrypoint.sh

# ─── EJECUTA COMO USUARIO SIN PRIVILEGIOS ───────────────────────────────────
# Esta línea es la que hace todo el trabajo del usuario appuser. Sin ella el
# `chown` de arriba no aporta nada y el proceso sigue corriendo como root,
# que es justo lo que se quería evitar: un atacante queloggedue un RCE en
# Django heredaría root en lugar de un usuario sin permisos.
#
# Va DESPUÉS del COPY/chown/chmod porque esas órdenes necesitan root para
# escribir ficheros, y DESPUÉS del HEALTHCHECK porque las directivas de
# metadatos no dependen del usuario.
USER appuser

# Expone el puerto 8000 (puerto del servidor Gunicorn).
EXPOSE 8000

# Healthcheck: verifica que la aplicación esté respondiendo cada 30 segundos.
# --interval=30s: Frecuencia de verificación.
# --timeout=5s: Tiempo máximo de espera por respuesta.
# --start-period=40s: Tiempo de gracia al inicio (migraciones, etc).
# --retries=3: Marca como unhealthy tras 3 fallos consecutivos.
# Usa urllib.request (stdlib) para no instalar curl ni wget.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/ranking/')" || exit 1

# Punto de entrada: ejecuta el script que corre migraciones y arranca Gunicorn.
CMD ["./entrypoint.sh"]