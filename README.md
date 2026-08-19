git clone https://github.com/JC0510004/FREE_Ricky.git

cd FREE_RICKY

code .

docker-compose up --build

docker exec -it free_ricky_backend python manage.py migrate

http://localhost:5173
docker compose up -d

3. Technologies Used
Backend
Technology	Version	Purpose
Python	3.12	Runtime
Django	6.0.2	Web framework
Django REST Framework	3.16.1	REST API framework
djangorestframework-simplejwt	5.5.1	JWT authentication
mysqlclient	2.2.8	MySQL database driver
django-cors-headers	4.7.0	CORS management
django-ratelimit	4.1.0	Rate limiting
python-decouple	3.8	Environment variable management
bleach	6.4.0	HTML/sanitization
argon2-cffi	25.1.0	Password hashing (Argon2)
gunicorn	25.1.0	Production WSGI server
django-ipware	7.0.0	Client IP detection
redis	5.3.0	Redis cache driver
Frontend
Technology	Version	Purpose
React	19.2.6	UI library
React DOM	19.2.6	DOM renderer
React Router DOM	7.18.0	Client-side routing
Axios	1.18.0	HTTP client
Vite	8.0.12	Build tool & dev server
ESLint	10.3.0	Linting
Infrastructure
Technology	Purpose
Docker (multi-stage)	Containerization for backend and frontend
Docker Compose	Multi-service orchestration (4 services)
MySQL 8.0	Primary database
Redis 7 Alpine	Caching (rate limiting, brute force protection)
Nginx Alpine	Frontend static file serving + reverse proxy
GitHub Actions	CI/CD (backend tests, lint, frontend build, Docker build)
Ngrok	HTTPS tunnel for development
CI/CD Pipeline (.github/workflows/ci.yml)
- Backend Tests: Python 3.12, SQLite for CI, runs python manage.py test api
- Backend Lint: flake8 with max-line-length=120
- Frontend Build: Node 20, npm ci && npm run build
- Docker Build: Builds both backend and frontend Docker images (depends on tests + build)
4. Backend Functionality
Database Models (api/models.py)
Model	Table	Description
Usuario	usuarios	Custom user model (extends AbstractBaseUser). Fields: rol (admin/jugador), username, email, fecha_registro, is_active, is_verified, failed_attempts, lockout_count, locked_until. Has brute-force lockout with escalating durations (15, 60, 360, 1440 minutes).
Nivel	niveles	Game levels. Fields: nombre, dificultad (facil/medio/dificil), tiempo_limite, fecha_creacion.
Partida	partidas	Game sessions/matches. Fields: usuario (FK), nivel (FK), muertes, tiempo, puntuacion, fecha. Has 3 database indexes for performance.
ConfirmacionReset	confirmaciones_reset	Password reset tokens. Fields: token_hash (PK), codigo_hash, usuario (FK), created_at, confirmado. Tokens expire after 15 minutes.
API Routes (api/urls.py -- all under /api/)
Method	URL	View	Auth
POST	/api/register/	RegisterView	Public
POST	/api/login/	LoginView	Public
POST	/api/token/refresh/	RefreshTokenView	Public
POST	/api/logout/	LogoutView	JWT
GET	/api/verify/	VerifySessionView	JWT
GET	/api/usuarios/	UsuarioListView	Admin
GET/PUT/DELETE	/api/usuarios/<pk>/	UsuarioDetailView	JWT
POST	/api/password-reset/	PasswordReset	Public
POST	/api/password-reset/confirm/	PasswordResetConfirm	Public
GET	/api/password-reset/confirmar/	ConfirmarIdentidad	Public
GET	/api/password-reset/verificar/	VerificarConfirmacion	Public
POST	/api/password-reset/verificar-codigo/	VerificarCodigo	Public
GET/POST	/api/niveles/	NivelListView	GET: Public, POST: Admin
PUT/DELETE	/api/niveles/<pk>/	NivelDetailView	Admin
GET/POST	/api/partidas/	PartidaListView	JWT
GET	/api/partidas/<pk>/	PartidaDetailView	JWT
GET	/api/ranking/	RankingView	Public
GET	/api/estadisticas/	UserStatsView	JWT
POST	/api/cambiar-password/	ChangePasswordView	JWT
GET	/api/admin/partidas/	AdminPartidasView	Admin
GET	/api/admin/stats/	AdminStatsView	Admin
Security Features
- Password hashing: Argon2 (primary), with PBKDF2 fallback
- JWT Authentication: Access tokens (15 min) + refresh tokens (1 day), with rotation and blacklisting
- Rate limiting: Per-endpoint throttling (login: 5/min, register: 3/min, password reset: 3/hr)
- Brute force protection: IP-level blocking (10 attempts / 15 min window, 30 min block)
- Account lockout: Escalating lockout durations (15 -> 60 -> 360 -> 1440 minutes)
- Timing attack protection: Dummy check_password for failed user lookups (CWE-208)
- Input sanitization: bleach HTML cleaning, control character stripping
- Password strength validation: Minimum 8 chars, uppercase, lowercase, number, special character
- Security headers: CSP, X-Frame-Options: DENY, X-Content-Type-Options, HSTS (in production)
- CORS: Whitelist-based origin control
- CSRF protection: HttpOnly cookies for refresh tokens
- Audit logging: Separate log files for security events and audit trail
- Custom exception handler: Prevents internal error details from leaking
Middleware Stack
1. SecurityHeadersMiddleware -- Adds CSP, X-Frame-Options, Permissions-Policy, Cache-Control headers
2. AuditLogMiddleware -- Logs all /api/ requests with method, path, status, duration, IP, user-agent
3. BruteForceIPMiddleware -- IP-level brute force detection using Redis/local cache
5. Frontend Functionality
Pages / Routes
Route	Component	Auth	Description
/	App (landing)	Public	Marketing landing page with parallax hero, story, news, team, community CTA
/login	Login	Public	Login form (username or email + password), show/hide toggle
/register	Register	Public	Registration form with live password strength meter and requirement checklist
/forgot-password	ForgotPassword	Public	Multi-step password reset: email entry -> sent confirmation -> email click -> identity confirmed -> set new password
/home	Home (protected)	Player	Player dashboard: welcome greeting, stats summary, levels grid with "JUGAR" buttons, global ranking table, recent games, profile card
/admin	Admin (admin-only)	Admin	Admin panel with 4 tabs: Resumen (system stats), Usuarios (CRUD), Niveles (CRUD), Partidas (view all)
/settings	Settings	Player	Account settings: edit username/email, change password, view account info (role, join date, verification, last login)
Key Components
- LoadingScreen: Animated splash screen with pulsing logo and bouncing dots (3.5s duration)
- Navbar: Fixed top nav with scroll effect, links to sections (Historia, Actualizaciones, Tripulacion, Comunidad) and auth buttons
- Hero: Full-screen parallax scene with 5 layers (background, sun, clouds, boat, sea) that respond to mouse movement via requestAnimationFrame
- Manifesto: Game story/lore section with character gallery (pixel art sprites with floating animations)
- News: Two news cards (game updates) with hover effects
- Team: Carousel of 6 team members with pixel art, names, roles, and descriptions; keyboard navigation
- Community: Call-to-action section with register link
- ProtectedRoute: Route guard that redirects unauthenticated users and non-admins from admin routes
Authentication Architecture
- Token management: Access tokens stored in-memory (not localStorage), refresh tokens in httponly cookies
- Auto-refresh: Axios interceptor queue system -- if a request gets 401, it queues pending requests, refreshes the token, then retries
- Session verification: On app load, verifies the stored user is still valid via /api/verify/
- AuthContext: React Context providing user, isAuthenticated, isLoading, login, register, logout, updateUser, checkSession
Styling
- Single monolithic index.css (2800+ lines)
- CSS custom properties for theming (primary: #ffb68c peach, secondary: #0f436f navy)
- Glassmorphism effects (backdrop-filter blur)
- Fully responsive with mobile breakpoints
- Pixel-art aesthetic with image-rendering: pixelated
- Custom animations: parallax, floating, bobbing, fade-up-on-scroll, loading dots, ping effects
- Fonts: Space Grotesk (headings), Work Sans (body), JetBrains Mono (monospace/labels)
- Material Symbols Outlined for icons
6. Configuration Files
File	Purpose
/docker-compose.yml	4 services: redis, mysql, backend, frontend with health checks, security hardening (no-new-privileges, read-only, tmpfs)
/.env	Django secrets, DB credentials, email SMTP config, JWT lifetimes, CORS origins, ngrok URL
/backend/requirements.txt	15 Python packages
/frontend/package.json	4 runtime + 7 dev dependencies
/frontend/vite.config.js	Vite dev server with /api proxy to Django backend
/frontend/eslint.config.js	ESLint with React hooks + React Refresh plugins
/frontend/nginx.conf	Production Nginx: SPA fallback, API proxy to backend:8000, security headers, gzip, static cache
/backend/Dockerfile	Multi-stage: Python 3.12-slim builder -> runtime with non-root user
/frontend/Dockerfile	Multi-stage: Node 20-alpine builder -> Nginx Alpine runtime
/.github/workflows/ci.yml	CI/CD: backend tests + lint, frontend build, Docker build verification
/backend/entrypoint.sh	Runs migrations + starts Gunicorn (2 workers, 2 threads, 120s timeout)
/.gitignore	Ignores: __pycache__, .env, venv/, node_modules/, dist/, logs/
/frontend/.gitignore	Ignores: node_modules/, dist/, logs, editor files
/backend/.dockerignore	Excludes: pycache, .env, venv, logs, tests, IDE files
/frontend/.dockerignore	Excludes: node_modules, .git, dist, Dockerfile
7. Deployment Architecture
                    ┌─────────────────────┐
                    │     Internet         │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │   Nginx (port 80)    │  Frontend container
                    │   / -> static files  │  (serves React build)
                    │   /api/ -> proxy     │
                    └─────────┬───────────┘
                              │
                    ┌─────────▼───────────┐
                    │  Django/Gunicorn     │  Backend container
                    │  (port 8000)         │  (port 8000)
                    └───┬─────────────┬───┘
                        │             │
              ┌─────────▼──┐   ┌─────▼──────┐
              │  MySQL 8.0  │   │  Redis 7   │
              │  (port 3306)│   │  (port 6379)│
              └─────────────┘   └────────────┘
All containers are on a shared app_network bridge. All ports are bound to 127.0.0.1 only. Health checks are configured for all 4 services. The backend is read-only with tmpfs for /tmp. Docker volumes persist MySQL data and backend logs.
8. Test Coverage
The test suite (backend/api/tests.py) contains 4 test classes with 17 test cases:
- RegistroTests (8 tests): Registration success, weak password, invalid email, XSS in username, password mismatch, duplicate registration, empty fields, password not exposed in response
- LoginTests (5 tests): Login success, login with email, wrong password, non-existent user, enumeration protection (same error message for both)
- ProteccionEndpointTests (5 tests): Auth required for user list/detail/logout, public ranking, admin-only user list
- PasswordHashingTests (2 tests): Argon2 verification, password check correctness
- BruteForceTests (3 tests): Failed attempts increment, account lockout, reset on successful login
9. Notable Design Decisions
1. No ORM relationships exposed in serializers -- Foreign keys are returned as IDs with _read_only source fields for display names
2. Refresh tokens in httponly cookies -- More secure than localStorage; access tokens stored in-memory only
3. Custom user model (AUTH_USER_MODEL = 'api.Usuario') -- Uses AbstractBaseUser with a custom manager
4. SQLite fallback in CI -- The settings detect DATABASE_URL=sqlite://... and switch to SQLite, enabling tests without MySQL
5. Escalating lockout -- First lockout: 15 min, second: 1 hour, third: 6 hours, fourth+: 24 hours
6. Email normalization -- Strips + aliases from email local part
7. Token hash storage -- Password reset tokens are UUID-based; only SHA-256 hashes are stored in the database