# ─── STAGE 1: BUILD ─────────────────────────────────────────────────────
# Primera etapa del build multi-stage: compila la aplicación React.
# Usamos multi-stage build para separar las dependencias de desarrollo
# de la imagen final, reduciendo significativamente el tamaño de la imagen
# (de ~800MB a ~25MB). Las dependencias de node_modules no se incluyen
# en la imagen final porque Vite genera archivos estáticos optimizados.

# Usamos node:20-alpine como base: Alpine Linux es una distribución
# mínima (~5MB) que reduce el tamaño de la imagen. Node 20 es LTS.
FROM node:20-alpine AS builder

# Establecemos el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias primero (package.json y package-lock.json).
# Esto aprovecha la caché de Docker: si no cambiaron las dependencias,
# Docker reutiliza la capa cacheada y no ejecuta npm ci de nuevo.
COPY package*.json ./

# npm ci: instala las dependencias exactas según package-lock.json.
# Es más rápido y reproducible que npm install para CI/CD.
# Se usa --frozen-lockfile implícitamente con npm ci.
RUN npm ci

# Copiamos TODO el código fuente del frontend al contenedor
COPY . .

# Ejecutamos el build de producción. Vite genera archivos estáticos
# optimizados (minificados, con hash para cache-busting) en la carpeta dist/.
RUN npm run build

# ─── STAGE 2: SERVE ────────────────────────────────────────────────────
# Segunda etapa: sirve los archivos estáticos compilados con Nginx.
# Nginx es un servidor web de alto rendimiento ideal para servir
# archivos estáticos en producción (maneja miles de conexiones concurrentes).

FROM nginx:alpine AS runtime

# Eliminamos la configuración por defecto de Nginx para reemplazarla
# con nuestra configuración personalizada
RUN rm /etc/nginx/conf.d/default.conf

# Copiamos los archivos compilados del stage anterior (builder) al
# directorio de servir archivos estáticos de Nginx.
# Solo copiamos la carpeta dist/, no node_modules ni código fuente.
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiamos nuestra configuración personalizada de Nginx (nginx.conf)
# que maneja el enrutamiento SPA (Single Page Application) y el proxy
# de /api al backend Django.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponemos el puerto 80 (HTTP estándar) para que el contenedor
# pueda recibir tráfico web. En docker-compose o al ejecutar,
# se mapea un puerto del host a este puerto.
EXPOSE 80

# ─── HEALTHCHECK ───────────────────────────────────────────────────────
# Define un health check que Docker ejecuta periódicamente para verificar
# que el contenedor sigue funcionando correctamente.
# --interval=30s: se ejecuta cada 30 segundos
# --timeout=5s: si la verificación tarda más de 5s, se considera fallida
# --start-period=10s: da 10 segundos al contenedor para iniciar antes
#                     de empezar a verificar (evita falsos negativos)
# --retries=3: si falla 3 veces consecutivas, Docker marca el contenedor
#              como unhealthy (puede ser reiniciado por orquestadores)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/ || exit 1
