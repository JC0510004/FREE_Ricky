# Salt Born

**Salt Born** (repositorio interno *FREE RICKY*) es una plataforma web de juego: un
portal que embebe un juego **Unity WebGL** y añade alrededor todo lo que un juego
suelto no trae — cuentas de usuario, verificación por email, recuperación de
contraseña, niveles, registro de partidas, ranking y panel de administración.

La seguridad es el eje del proyecto: autenticación JWT, hashing Argon2, límites de
peticiones, bloqueo escalable por fuerza bruta y cabeceras/CSP en nginx.

---

## Tabla de contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Stack tecnológico](#stack-tecnológico)
- [Requisitos previos](#requisitos-previos)
- [Instalación y arranque](#instalación-y-arranque)
  - [Con Docker (recomendado)](#con-docker-recomendado)
  - [Desarrollo local sin Docker](#desarrollo-local-sin-docker)
- [Variables de entorno](#variables-de-entorno)
- [Uso](#uso)
- [API](#api)
- [Tests y calidad](#tests-y-calidad)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Seguridad](#seguridad)
- [Despliegue](#despliegue)
- [Documentación adicional](#documentación-adicional)
- [Licencia](#licencia)

---

## Características

- **Juego Unity WebGL embebido** en un `<iframe>` con puente `postMessage` para
  pasar el nombre del jugador y detectar la salida al panel.
- **Registro con verificación de email** por token de un solo uso (hash SHA-256 en
  base de datos, expiración de 60 min).
- **Autenticación JWT** (access 15 min / refresh 1 día) con refresh en cookie
  `HttpOnly`.
- **Recuperación de contraseña** en dos factores: enlace por email + código de 6
  dígitos, con límite de intentos.
- **Bloqueo por fuerza bruta escalable** (15 min → 1 h → 6 h → 24 h) e
  incremental, atómico bajo bloqueo de fila.
- **Niveles, partidas y ranking** (top-20) y **estadísticas por usuario**.
- **Panel de administración** con estadísticas y listado de partidas.
- **Rate limiting** por IP (DRF + `limit_req` de nginx) con contadores compartidos
  en Redis (no por worker).
- **Despliegue endurecido**: contenedores sin privilegios, filesystem de solo
  lectura, red aislada y secretos fuera de `argv`/entorno.

---

## Arquitectura

```
              ┌──────────────────────────────────────────────┐
   Cliente ──▶│  nginx (frontend)  :80  · proxy /api         │
              │  · sirve build de React                       │
              │  · limit_req, CSP, headers, deny /admin       │
              └───────────────┬──────────────────────────────┘
                              │  (red interna Docker, 172.16.42.0/24)
                              ▼
              ┌──────────────────────────────┐     ┌───────────────┐
              │  backend (Django + Gunicorn) │────▶│  MySQL 8.4    │
              │  API REST /api              │     └───────────────┘
              │  · JWT, Argon2, throttles    │────▶ ┌───────────────┐
              │  · lockout fuerza bruta      │     │  Redis 7      │
              └──────────────────────────────┘     │  throttles    │
                                                   └───────────────┘
              ┌──────────────────────────────┐
              │  Juego Unity WebGL (externo)  │
              └──────────────────────────────┘
```

El backend **no expone** su puerto al host: todo pasa por nginx, que es donde
viven el rate limit, el `deny all` de `/admin/` y las cabeceras de seguridad.

---

## Stack tecnológico

| Capa          | Tecnología                                                     |
|---------------|----------------------------------------------------------------|
| Backend       | Python 3.12, Django 6.1, Django REST Framework 3.18           |
| Autenticación | djangorestframework-simplejwt, Argon2, PyJWT                   |
| Base de datos | MySQL 8.4                                                      |
| Caché         | Redis 7 (throttling y bloqueo entre workers)                  |
| Docs API      | drf-spectacular (OpenAPI 3 / Swagger / Redoc)                 |
| Servidor      | Gunicorn (`-w 2 --threads 2`)                                 |
| Frontend      | React 19, Vite 8, React Router 7, Axios, react-unity-webgl    |
| Servidor web  | nginx (sirve el build + proxy de `/api`)                      |
| Orquestación  | Docker / Docker Compose                                       |
| CI/CD         | GitHub Actions (tests, lint, build, Docker, security scan)    |

---

## Requisitos previos

- **Docker** y el **plugin Docker Compose** (modo recomendado), o bien:
- **Python 3.12+**, **Node.js 22+** (o 24 / 26), **MySQL 8.4+** y **Redis 7** en
  local.

---

## Instalación y arranque

### Con Docker (recomendado)

1. **Copia la plantilla de entorno** y rellena los valores:

   ```bash
   cp .env.example .env
   ```

   Genera las claves y contraseñas:

   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(50))"   # SECRET_KEY
   python -c "import secrets; print(secrets.token_urlsafe(64))"   # JWT_SECRET_KEY
   python -c "import secrets; [print(k+'=secrets.token_urlsafe(24)') for k in ('DB_PASSWORD','MYSQL_ROOT_PASSWORD','REDIS_PASSWORD')]"
   ```

2. **Crea el fichero ACL de Redis** (no está en `.env`; Redis no arranca sin él):

   ```bash
   mkdir -p secrets
   printf 'user default on >%s ~* &* +@all\n' "$REDIS_PASSWORD" > secrets/redis.acl
   ```

3. **Levanta el stack**:

   ```bash
   docker compose up --build
   ```

   La app queda en **http://127.0.0.1:5173** (nginx sirve el build y hace proxy de
   `/api`). MySQL en `127.0.0.1:3307` y Redis en `127.0.0.1:6379`, ambos solo en
   loopback.

4. **Crea el superusuario** y los niveles iniciales (la tabla `niveles` nace vacía):

   ```bash
   docker compose exec backend python manage.py createsuperuser
   ```

### Desarrollo local sin Docker

Ejecuta solo la infraestructura en Docker y el código en tu máquina:

```bash
# 1. Infraestructura
docker compose up -d mysql redis

# 2. Backend (Django dev server en :8000)
cd backend
python -m venv venv
# Windows:  .\venv\Scripts\activate
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

```bash
# 3. Frontend (Vite dev server en :5173, hace proxy de /api a :8000)
cd frontend
npm ci
npm run dev
```

`.env.example` ya apunta a `DB_HOST=localhost` y `DB_PORT=3307` para este modo.

> **Correos:** mientras `EMAIL_HOST_PASSWORD` esté vacío, Django usa el backend de
> consola: los correos no se envían, acaban en los logs. Configura una *App
> Password* de Gmail para el envío real (ver `.env.example`).

---

## Variables de entorno

Todas viven en `.env` (plantilla en `.env.example`). Las más relevantes:

| Variable            | Descripción                                                        | Obligatoria |
|---------------------|--------------------------------------------------------------------|:-----------:|
| `SECRET_KEY`        | Firma de sesiones y datos cifrados de Django                       | Sí |
| `JWT_SECRET_KEY`    | Firma de los tokens JWT                                            | Sí |
| `DB_PASSWORD`       | Contraseña del usuario de MySQL                                    | Sí |
| `MYSQL_ROOT_PASSWORD` | Contraseña de root de MySQL                                      | Sí |
| `REDIS_PASSWORD`    | Contraseña de Redis (va al fichero `secrets/redis.acl`)            | Sí |
| `DEBUG`             | `True` en desarrollo, `False` en producción                        | No |
| `ALLOWED_HOSTS`     | Hosts permitidos (previene Host Header Injection)                  | No |
| `CORS_ALLOWED_ORIGINS` | Orígenes del frontend autorizados                               | No |
| `FRONTEND_URL` / `API_BASE_URL` | URLs base para enlaces internos                       | No |
| `CACHE_URL`         | URL de Redis para throttling global                                | No |
| `TRUSTED_PROXIES`   | Redes de confianza para resolver la IP real del cliente            | No |
| `SECURE_SSL_REDIRECT` | Fuerza HTTPS                                                     | No |
| `RUN_MIGRATIONS`    | Migraciones al arrancar (`false` en prod multi-réplica)            | No |
| `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` / `DEFAULT_FROM_EMAIL` | SMTP | No |

> El proyecto **falla a propósito** (`fail-closed`) si faltan las claves o
> contraseñas obligatorias, en vez de arrancar con valores por defecto inseguros.

---

## Uso

1. Abre **http://127.0.0.1:5173**.
2. **Regístrate**; recibirás un correo de verificación (o verás el enlace en los
   logs si no configuraste SMTP).
3. **Verifica** tu email e **inicia sesión**.
4. Accede a **Jugar** para abrir el juego Unity WebGL (Salt Born).
5. Consulta tu **ranking** y **estadísticas**.

---

## API

Base: `/api`. Documentación OpenAPI en `/api/schema/` con drf-spectacular.

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/register/` | Registro de usuario |
| POST | `/api/login/` | Login (devuelve tokens JWT) |
| POST | `/api/token/refresh/` | Refresca el access token |
| POST | `/api/logout/` | Cierra sesión |
| GET  | `/api/verify/` | Verifica la sesión actual |
| POST | `/api/verificar-email/` | Verifica el email con token |
| POST | `/api/verificar-email/reenviar/` | Reenvía el email de verificación |
| GET  | `/api/ranking/` | Top-20 de puntuaciones |
| GET  | `/api/usuarios/` | Lista de usuarios (admin) |
| GET/PATCH/DELETE | `/api/usuarios/<pk>/` | Detalle de usuario (admin) |
| POST | `/api/password-reset/` | Solicita recuperación de contraseña |
| POST | `/api/password-reset/confirm/` | Confirma el reset |
| POST | `/api/password-reset/confirmar/` | Confirma identidad |
| POST | `/api/password-reset/verificar/` | Verifica la confirmación |
| POST | `/api/password-reset/verificar-codigo/` | Verifica el código de 6 dígitos |
| GET  | `/api/niveles/` | Lista de niveles |
| GET  | `/api/niveles/<pk>/` | Detalle de nivel |
| GET/POST | `/api/partidas/` | Lista / registra partidas |
| GET  | `/api/partidas/<pk>/` | Detalle de partida |
| GET  | `/api/estadisticas/` | Estadísticas del usuario |
| POST | `/api/cambiar-password/` | Cambio de contraseña |
| GET  | `/api/admin/partidas/` | Partidas (admin) |
| GET  | `/api/admin/stats/` | Estadísticas globales (admin) |

---

## Tests y calidad

**Backend** (requiere MySQL 8.4):

```bash
cd backend
python manage.py test api --verbosity=2 --traceback --parallel
python manage.py makemigrations --check --dry-run   # detecta migraciones sin generar
flake8 api/ --max-line-length=120 --extend-ignore=E501,W503
```

**Frontend:**

```bash
cd frontend
npm run lint       # ESLint
npm test           # Vitest
npm run test:guard # verifica que ningún test quedó fuera de la suite
npm run build      # build de producción
```

El pipeline de **CI** (`.github/workflows/ci.yml`) ejecuta en cada push/PR a
`main` y `develop`: tests de backend contra MySQL, lint de backend y frontend,
tests de frontend, build de frontend, build de imágenes Docker y un **security
scan** (`pip-audit` + `bandit`) sin `continue-on-error`.

---

## Estructura del proyecto

```
FREE_RICKY/
├── backend/                 # API Django
│   ├── api/                 # App principal (modelos, vistas, serializers,
│   │                        #   middlewares, throttles, tests)
│   ├── config/              # settings, urls, wsgi/asgi, logging
│   ├── Dockerfile           # build multi-stage, usuario sin privilegios
│   ├── entrypoint.sh        # migraciones + Gunicorn
│   └── requirements.txt
├── frontend/                # SPA React + Vite (servida por nginx)
│   ├── src/                 # pages, components, contexts, services, hooks
│   ├── nginx.conf           # SPA, proxy /api, headers, limit_req
│   └── Dockerfile
├── secrets/                 # redis.acl (NO versionado)
├── pentest_reports/         # informes de pentest
├── .github/workflows/ci.yml # pipeline de CI/CD
├── docker-compose.yml       # orquestación (única fuente de verdad)
├── AUDITORIA.md             # registro de la auditoría de seguridad
├── DEPLOY_PRODUCCION.md     # checklist de lanzamiento a producción
├── DIAGRAMAS_UML.html       # diagramas del sistema
└── .env.example             # plantilla de variables de entorno
```

---

## Seguridad

Medidas destacadas (detalle en `AUDITORIA.md`):

- Hashing de contraseñas con **Argon2** y comprobación *dummy* cuando el usuario no
  existe, para igualar tiempos de respuesta (CWE-208).
- **Lockout de fuerza bruta escalable** con incremento y decisión de bloqueo
  atómicos (`select_for_update`), evitando saltos de escalón por concurrencia.
- **Throttling global** en Redis (no por worker) y `limit_req` por IP en nginx.
- `TRUSTED_PROXIES` estrecho: solo el proxy resuelve la IP real (`X-Real-IP`);
  nginx la sobrescribe en cada petición.
- El backend **no publica** su puerto: todo pasa por nginx.
- Tokens de email/reset almacenados **hasheados** (SHA-256) con expiración.
- Contenedores con `no-new-privileges`, `read_only` + `tmpfs`, red aislada con
  subnet fija y secretos fuera de `argv`/entorno (ACL de Redis).

---

## Despliegue

Consulta **`DEPLOY_PRODUCCION.md`**: checklist de dominio/DNS, VM, `.env` de
producción, HTTPS, seed de base de datos, verificación end-to-end, monitoreo y
rollback.

---

## Documentación adicional

- `DEPLOY_PRODUCCION.md` — checklist de lanzamiento.
- `AUDITORIA.md` — hallazgos de seguridad resueltos.
- `DIAGRAMAS_UML.html` — diagramas del sistema.
- `pentest_reports/` — informes de pruebas de penetración.
- Comentarios en el código: el proyecto documenta el *porqué* de las decisiones.

---

## Licencia

Por definir. Añade un archivo `LICENSE` con los términos de distribución antes de
publicar el proyecto.
