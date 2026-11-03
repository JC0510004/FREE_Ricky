# MANUAL DE INSTALACIÓN - SALT BORN (FREE RICKY)

**Versión:** 1.0  
**Fecha:** Octubre 2026  
**Autor:** Equipo de Desarrollo FREE RICKY  
**Repositorio:** https://github.com/JC0510004/FREE_Ricky

---

## 1. Objetivo

El presente documento tiene como finalidad detallar el proceso de instalación, configuración y puesta en marcha del proyecto **Salt Born** (FREE RICKY) en un entorno local o de desarrollo.

Salt Born es una plataforma web que integra un juego **Unity WebGL** con un portal web completo que incluye sistema de usuarios, autenticación JWT, verificación por correo electrónico, recuperación de contraseñas, registro de partidas, ranking, estadísticas y panel de administración.

---

## 2. Requisitos del Sistema

### 2.1. Requisitos Hardware Mínimos

| Componente | Requisito Mínimo | Recomendado |
|-------------|-------------------|-------------|
| Procesador | Intel Core i3 / AMD Ryzen 3 o equivalente | Intel Core i5 / AMD Ryzen 5 o superior |
| Memoria RAM | 8 GB | 16 GB |
| Almacenamiento | 10 GB libres | 20 GB libres (SSD recomendado) |
| Conexión a Internet | Necesaria para descargar imágenes Docker, dependencias y envío de correos | Estable |

### 2.2. Software Necesario

| Software | Versión Requerida | Notas |
|----------|-------------------|-------|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Última versión estable | Incluye Docker Engine y Docker Compose Plugin. Obligatorio para el modo recomendado. |
| [Git](https://git-scm.com/downloads) | Última versión | Para clonar el repositorio. |
| [Node.js](https://nodejs.org/) | 22.x o superior | Solo necesario para desarrollo local sin Docker. |
| [Python](https://www.python.org/) | 3.12.x | Solo necesario para desarrollo local sin Docker. |
| Servidor HTTP para Build WebGL | Cualquiera (Live Server, http-server, nginx) | Necesario para servir los archivos del juego Unity en el puerto 8080. |

---

## 3. Estructura del Proyecto

```text
FREE_RICKY/
├── backend/                 # API REST con Django 6.1 + DRF
├── frontend/                # Aplicación SPA con React 19 + Vite 8
├── secrets/                 # Fichero redis.acl (NO versionado)
├── .env                     # Variables de entorno (NO versionado)
├── .env.example             # Plantilla de variables de entorno
├── docker-compose.yml       # Orquestación de contenedores
├── README.md                # Documentación general
├── AUDITORIA.md             # Auditoría de seguridad
└── DEPLOY_PRODUCCION.md     # Guía de despliegue a producción
```

---

## 4. Instalación Paso a Paso

### 4.1. Clonar el Repositorio

Abrir una terminal (PowerShell, CMD o Terminal) y clonar el proyecto:

```bash
git clone https://github.com/JC0510004/FREE_Ricky.git
cd FREE_Ricky
```

### 4.2. Configurar Variables de Entorno

#### Paso 1: Copiar plantilla

```bash
cp .env.example .env
```

#### Paso 2: Generar claves seguras

Desde la raíz del proyecto, generar las claves necesarias:

```bash
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(50))"
python -c "import secrets; print('JWT_SECRET_KEY=' + secrets.token_urlsafe(64))"
python -c "import secrets; print('DB_PASSWORD=' + secrets.token_urlsafe(24))"
python -c "import secrets; print('MYSQL_ROOT_PASSWORD=' + secrets.token_urlsafe(24))"
python -c "import secrets; print('REDIS_PASSWORD=' + secrets.token_urlsafe(24))"
```

Copiar los valores generados al fichero `.env` en sus correspondientes variables.

#### Paso 3: Configurar correo electrónico (SMTP Gmail)

Para que lleguen los correos de verificación y recuperación de contraseña:

1. Acceder a [myaccount.google.com/security](https://myaccount.google.com/security)
2. Activar la **Verificación en 2 pasos**
3. Ir a [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
4. Generar una contraseña de aplicación con nombre `SaltBorn`
5. Copiar la contraseña de 16 caracteres al campo `EMAIL_HOST_PASSWORD` del `.env`

**Nota:** Mientras `EMAIL_HOST_PASSWORD` esté vacío, Django usará el backend de consola y los correos se mostrarán únicamente en los logs del backend.

### 4.3. Configurar Redis ACL

Redis requiere un fichero con las credenciales de acceso por seguridad.

Crear la carpeta `secrets/` y generar el fichero `redis.acl`:

**En Windows (PowerShell):**

```powershell
mkdir secrets -Force
$pass = $env:REDIS_PASSWORD
if (-not $pass) { $pass = "TU_REDIS_PASSWORD_AQUI" }
"user default on >$pass ~* &* +@all" | Out-File -Encoding ASCII -FilePath "secrets/redis.acl" -NoNewline
```

**En Linux/MacOS:**

```bash
mkdir -p secrets
printf 'user default on >%s ~* &* +@all\n' "$REDIS_PASSWORD" > secrets/redis.acl
```

### 4.4. Levantar la Stack con Docker

Con Docker Desktop arrancado, ejecutar desde la raíz del proyecto:

```bash
docker compose up -d --build
```

Este comando realizará lo siguiente:

1. Construirá las imágenes de `backend` y `frontend`
2. Levantará los contenedores `mysql`, `redis`, `backend` y `frontend`
3. Aplicará las migraciones automáticamente
4. Iniciará Gunicorn para el backend y Nginx para el frontend

El proceso puede tardar entre 5 y 10 minutos la primera vez.

### 4.5. Verificar el Estado de los Contenedores

```bash
docker compose ps
```

El resultado esperado debe mostrar todos los servicios con estado `(healthy)`.

### 4.6. Servir el Build de Unity WebGL

El juego Unity WebGL debe servirse desde un servidor HTTP independiente en el puerto **8080**.

**Usando http-server (Node.js):**

```bash
npm install -g http-server
http-server ./ruta-al-build-webgl -p 8080 --cors
```

**Usando Python:**

```bash
cd ruta-al-build-webgl
python -m http.server 8080
```

**Nota:** El frontend busca el juego en `GAME_ORIGIN` (por defecto `http://192.168.18.50:8080`). Si tu IP local es distinta, define `GAME_ORIGIN` en el `.env` de la raíz y reconstruye el frontend (`docker compose build frontend`); se inyecta a la vez en el bundle y en la CSP. Para desarrollo con `npm run dev`, usa `VITE_GAME_ORIGIN` en `frontend/.env.local` (ver `frontend/.env.example`).

---

## 5. Acceso a la Aplicación

| Servicio | URL | Acceso |
|----------|-----|--------|
| **Frontend (Local)** | [http://127.0.0.1:5173](http://127.0.0.1:5173) | Desde el mismo equipo |
| **Frontend (Red Local)** | [http://IP_LOCAL:5173](http://IP_LOCAL:5173) | Desde otros equipos de la misma red |
| **Juego Unity WebGL** | [http://IP_LOCAL:8080](http://IP_LOCAL:8080) | Servidor independiente en puerto 8080 |
| **MySQL** | `127.0.0.1:3307` | Solo localhost |
| **Redis** | `127.0.0.1:6379` | Solo localhost |

---

## 6. Primer Uso

### 6.1. Crear Superusuario

```bash
docker compose exec backend python manage.py createsuperuser
```

### 6.2. Añadir Niveles

1. Acceder al panel de administración
2. Ir a **Niveles** > **Añadir nivel**
3. Configurar con el nombre exacto de la escena de Unity
4. Guardar

### 6.3. Probar el Flujo Completo

1. Registrarse con un correo real
2. Verificar el correo electrónico
3. Iniciar sesión
4. Seleccionar un nivel y jugar
5. Comprobar las estadísticas/ranking tras finalizar

---

## 7. Comandos Útiles

| Comando | Descripción |
|---------|-------------|
| `docker compose up -d` | Levantar contenedores |
| `docker compose down` | Detener contenedores |
| `docker compose logs -f backend` | Ver logs del backend |
| `docker compose logs -f frontend` | Ver logs del frontend |
| `docker compose restart` | Reiniciar todos los servicios |
| `docker compose ps` | Estado de contenedores |

---

## 8. Solución de Problemas Comunes

| Problema | Causa | Solución |
|----------|-------|----------|
| El frontend no carga desde otra IP | `FRONTEND_BIND` en `.env` | Asegurar `FRONTEND_BIND=0.0.0.0` y recrear frontend |
| Error CSRF al hacer POST | Faltan orígenes confiables | Verificar `CSRF_TRUSTED_ORIGINS` en `.env` |
| No llegan correos | Falta App Password de Gmail | Configurar `EMAIL_HOST_PASSWORD` correctamente |
| Juego no carga en iframe | Unity no corriendo en puerto 8080 | Levantar servidor HTTP para el build WebGL |
| Partidas guardadas con 0/0 al salir | Unity no envía stats | Aplicar los cambios del puente Unity-JS documentados |

---

## 9. Notas de Seguridad

- Las claves y contraseñas **nunca** deben subirse al repositorio
- El archivo `.env` y `secrets/redis.acl` están excluidos en `.gitignore`
- MySQL y Redis solo escuchan en `127.0.0.1`
- El backend solo es accesible a través de Nginx
- Se utilizan cookies HttpOnly, Argon2 para contraseñas y bloqueo por fuerza bruta
- Las contraseñas de Redis no aparecen en la línea de comandos

---

**Documento generado para la correcta instalación y configuración del proyecto Salt Born (FREE RICKY).**
