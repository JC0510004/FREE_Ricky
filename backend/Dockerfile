# ─── STAGE 1: BUILD ─────────────────────────────────────────────────────
# Etapa de compilación: instala dependencias y las compila.
# Se usa una imagen base de Python 3.12 en versión slim (ligera).
# El alias 'builder' permite referenciar esta etapa en la Etapa 2.
FROM python:3.12-slim AS builder

# Establece el directorio de trabajo como /app dentro del contenedor.
WORKDIR /app

# Instala las dependencias del sistema necesarias para compilar paquetes Python.
# build-essential: gcc y herramientas de compilación C.
# libpq-dev: archivos de desarrollo de PostgreSQL (para psycopg2).
# pkg-config: herramienta para localizar bibliotecas compartidas.
# default-libmysqlclient-dev: archivos de desarrollo de MySQL (para mysqlclient).
# Se limpia la caché de apt para reducir el tamaño de la imagen.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev pkg-config default-libmysqlclient-dev && \
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
# libpq: cliente PostgreSQL para connections.
# libmariadb3: cliente MariaDB/MySQL para conexiones.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev libmariadb3 && \
    rm -rf /var/lib/apt/lists/*

# Crea un usuario del sistema 'appuser' sin privilegios root.
# groupadd -r: Crea un grupo del sistema (-r = rango 0-999).
# useradd: Crea el usuario con grupo appuser, home /app y sin shell de login.
# Ejecutar como usuario no-root es una práctica de seguridad fundamental.
RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

WORKDIR /app

# Copia las dependencias Python instaladas en la etapa builder.
# Solo copia los paquetes compilados, no las herramientas de compilación.
COPY --from=builder /install /usr/local

# Copia todo el código fuente de la aplicación al contenedor.
COPY . .

# Cambia la propiedad de todos los archivos al usuario appuser.
# Esto permite que la app pueda leer/escribir archivos sin ser root.
RUN chown -R appuser:appuser /app

# Marca el script de entrada como ejecutable.
RUN chmod +x /app/entrypoint.sh

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
