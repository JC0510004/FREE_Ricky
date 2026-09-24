# Checklist de lanzamiento a producción (FREE RICKY / Saltborn)

> Preparaciones para dejar el entorno de desarrollo (ngrok/localhost/consola de email) y
> publicar la aplicación en un despliegue real (GCP VM + nginx + SMTP + Redis/MySQL con Docker Compose).

Estado: pendiente. Marca cada item con `[x]` cuando esté hecho.

## 0. Antes de tocar el servidor (en el código)

- [x] **Loguear fallos de email**: implementado `backend/api/email_utils.py` (`enviar_email`
  con `fail_silently=False` dentro de `try/except` + `logger.error` en loggers `seguridad`
  y `auditoria`) y migrados los 4 envíos (verificación, reset x2, cambio de contraseña).
- [ ] Confirmar que `SECURE_SSL_REDIRECT` se pasa por env (`docker-compose.yml`) y probar que
  `SECURE_PROXY_SSL_HEADER` detecta `X-Forwarded-Proto` de nginx.

## 1. Dominio y DNS

- [ ] Comprar/definir dominio (p. ej. `saltborn.com`).
- [ ] Registro **A → IP externa de la VM** (o GCP Cloud DNS).
- [ ] Decidir dónde termina HTTPS: **GCP Load Balancer gestionado** o **nginx + certbot**.
  (Determina `NUM_PROXIES`: si hay LB delante son 2 proxies; hoy está en 1, ver `backend/config/settings.py:231`.)

## 2. Servidor GCP

- [ ] Crear VM (diagrama: `e2-standard-2`, 2 vCPU/8GB) con tags de red.
- [ ] Abrir **solo** 80/443 en firewall (tightest: permitir desde el rango del LB o IPs de admins; SSH por IAP/admin-only).
- [ ] Instalar Docker Engine + Docker Compose plugin.

## 3. `.env` de producción (nuevo, no copiar el dev)

- [ ] Generar `SECRET_KEY` y `JWT_SECRET_KEY` reales:
  `python -c "import secrets; print(secrets.token_urlsafe(50))"`.
- [ ] `DB_PASSWORD` y `MYSQL_ROOT_PASSWORD` fuertes y **diferentes** (el `.env.example` usa `root`).
- [ ] `REDIS_PASSWORD` fuerte.
- [ ] `DEBUG=False`.
- [ ] `ALLOWED_HOSTS=tu-dominio`, `CORS_ALLOWED_ORIGINS=https://tu-dominio`.
- [ ] `FRONTEND_URL=https://tu-dominio`, `API_BASE_URL=https://tu-dominio/api`.
- [ ] `CACHE_URL=redis://:PASSWORD@redis:6379/0` (sin esto el rate-limit es por worker, no global).
- [ ] **SMTP real**: `EMAIL_HOST_USER` + `EMAIL_HOST_PASSWORD` (p. ej. App Password de Gmail con 2FA) + `DEFAULT_FROM_EMAIL`.
- [ ] `TRUSTED_PROXIES` = IPs/rangos reales del proxy/LB; probar la detección de IP con un endpoint de prueba.
- [ ] `SECURE_SSL_REDIRECT=True`.

## 4. HTTPS

- [ ] Opción A (nginx): certbot/Let's Encrypt, descomentar el bloque `nginx.conf:63`, `listen 443 ssl`.
- [ ] Opción B (LB GCP): cert gestionado en el LB, redirección no forzada en nginx; validar `X-Forwarded-Proto`.

## 5. Base de datos

- [ ] Primer arranque con volumen limpio (nada de datos dev): `docker compose down` + borrar volumen.
- [ ] Migraciones automáticas (las hace `backend/entrypoint.sh`).
- [ ] **Seed**: crear superusuario admin (`docker compose exec backend ... createsuperuser`) y los **niveles iniciales** del juego (la tabla `niveles` nace vacía).
- [ ] Backup: `mysqldump` programado + snapshot GCP diario del volumen `mysql_data`.

## 6. Despliegue

- [ ] `git clone` + `.env` en la VM.
- [ ] Compose de producción: usar el mapeo expuesto (`docker-compose.override.yml` deja los puertos en `0.0.0.0` — correcto si el firewall de GCP filtra) o editar `docker-compose.yml` con los valores reales.
- [ ] `docker compose up -d --build`.
- [ ] `docker compose ps` → todos `healthy`.
- [ ] `curl` local a `/api/ranking/` y a la home.

## 7. Verificación end-to-end (post-deploy)

- [ ] Registro → llega el email → verificar token → login.
- [ ] Login con contraseña mala x5 → lockout escalable.
- [ ] Reset de contraseña completo con email real (enlace + código) → sesiones invalidadas.
- [ ] Partida → ranking → estadísticas → panel admin.
- [ ] Forzar HTTPS (redirige) y revisar headers de seguridad (`curl -I`).

## 8. Monitoreo

- [ ] Revisar `backend/logs/seguridad.log` y `backend/logs/auditoria.log` (volumen `backend_logs`).
- [ ] `docker compose logs` + uso CPU/RAM (límites definidos en compose).
- [ ] Alerta manual si un contenedor queda `unhealthy`.

## 9. Rollback

- [ ] Documentar: `docker compose down`, restaurar volumen `mysql_data` respaldado, revertir a la imagen/anterior con `git checkout <commit>` + `--build`.

---

### Referencias útiles

- `backend/api/views_password_reset.py` — flujo de recuperación (emails en líneas 250 y 369).
- `backend/api/views_auth.py` — registro/login/refresh/verificación (email en línea 59).
- `backend/config/settings.py` — toda la configuración por entorno (email, proxies, seguridad).
- `frontend/nginx.conf` — headers, CSP, rate limit, bloqueo `/admin/`, TLS (comentado en línea 63).
- `backend/api/cache_backend.py` — caché resiliente (Redis con fallback a LocMem).
- `backend/api/middleware.py` — lockout por IP y detección de IP real.
- `docker-compose.override.yml` — puertos de desarrollo (commiteado).