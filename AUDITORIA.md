# Auditoría del proyecto FREE_RICKY

Fecha: 2026-09-29 · Alcance: 134 ficheros versionados (~100 de código)

## Cómo leer este documento

Cada hallazgo lleva un estado. **No los trato todos como equivalentes:**

- **[VERIFICADO]** — lo comprobé yo directamente: leí el código, o ejecuté una
  prueba que lo demuestra. Se indica la evidencia.
- **[REPORTADO]** — detectado en la revisión, con referencia a fichero:línea,
  pero **no lo he reproducido**. Antes de actuar sobre él, confirmarlo.
- **[DUDOSO]** — hay indicios pero no estoy seguro. No actúes sobre esto sin mirar.

Esta distinción importa. En la fase anterior di por cerrado un issue de 25
CVE basándome en una herramienta que no cubría lo que decía cubrir. Un informe
que no distingue lo verificado de lo supuesto repite exactamente ese error.

---

## 1. Resumen ejecutivo

| Severidad | Verificados | Reportados | Total |
|---|---|---|---|
| Crítico | 1 | 1 | 2 |
| Alto | 7 | 4 | 11 |
| Medio | 4 | 16 | 20 |
| Bajo / info | 1 | 20 | 21 |

**El hallazgo dominante: el rate limiting anónimo es evadible de forma trivial.**
No es teórico — lo ejecuté y lo medí. Es el control de seguridad que el
proyecto da por bien puesto en seis endpoints, y no protege a ninguno.

Detrás de eso, el patrón dominante es **"configuración que aparenta proteger y
no protege"**: el compose publica MySQL a internet, nginx no tiene TLS, la CSP
permite `unsafe-eval`, y el panel de admin depende de un rol en `localStorage`.

Lo que está bien es mucho y merece decirse: cero SQL crudo, cero XSS, cero
`console.log`, tokens fuera de storage persistente, argon2, secretos sin
fallback inseguro, y un `PasswordResetConfirm` transaccional que es ejemplo de
cómo debería ser el resto.

---

## 2. Críticos

### 2.1 Bypass total del rate limiting anónimo [VERIFICADO — reproducido]

`backend/api/throttles.py:4-39`, usado en `views_auth.py:83,186,324`,
`views_password_reset.py:126,266,386` y `views_email.py:23`.

Las ocho clases de `throttles.py` heredan de `AnonRateThrottle`. En DRF:

```python
# rest_framework/throttling.py:173-180
def get_cache_key(self, request, view):
    if request.user and request.user.is_authenticated:
        return None          # ← solo limita a anónimos
```

```python
# rest_framework/throttling.py:119-121
self.key = self.get_cache_key(request, view)
if self.key is None:
    return True              # ← sin clave = sin límite
```

La condición parece inocua: un usuario autenticado ya no necesita el límite de
anónimos. El problema es **cuándo** se evalúa `request.user`. En
`rest_framework/views.py:419-421`:

```python
self.perform_authentication(request)   # 419  ← autentica
self.check_permissions(request)       # 420
self.check_throttles(request)         # 421  ← y solo entonces throttlea
```

`perform_authentication()` corre **antes** del throttle. Que la vista sea
`AllowAny` no lo evita: `AllowAny` se evalúa en `check_permissions` (420), una
línea después de que el usuario ya esté resuelto. Es decir, **`AllowAny` no
impide autenticar la petición**.

Lo medí con un JWT válido en el header `Authorization` (el vector real de
ataque, no un mock):

```
--- LoginThrottle (scope=login) ---
  anónimo,        7 peticiones -> 5 permitidas
  con token válido, 7 peticiones -> 7 permitidas
  request.user.is_authenticated = True
  get_cache_key con token = None

--- RegisterThrottle (scope=register) ---
  anónimo,        7 peticiones -> 3 permitidas
  con token válido, 7 peticiones -> 7 permitidas
  request.user.is_authenticated = True
  get_cache_key con token = None
```

**Explotación:** el atacante se registra una vez, consigue un access token y
adjunta `Authorization: Bearer <token>` a todas las peticiones posteriores. Cuota
ilimitada en `/api/login/`, `/api/register/`, `/api/token/refresh/`,
`/api/password-reset/`, `/api/verificar-email/`. Consecuencias concretas:

- **Email bombing**: ilimitados correos de verificación y de reset dirigidos a
  direcciones ajenas, usando tu SMTP. Agotamiento de reputación del dominio.
- **Borrado masivo de resets legítimos**: `views_password_reset.py:161` borra el
  token pendiente de la víctima en cada petición. Un atacante puede impedir que
  un usuario recupere su cuenta, indefinidamente.

**Corrección:** las throttles de endpoints públicos no deben depender de
`is_authenticated`. Dos opciones limpias:

```python
class LoginThrottle(SimpleRateThrottle):
    scope = 'login'

    def get_cache_key(self, request, view):
        # Clave por IP siempre, autenticado o no: el objetivo es limitar
        # intentos de login, no distinguir quién hace la petición.
        return self.cache_format % {
            'scope': self.scope, 'ident': self.get_ident(request)
        }
```

o, complementario, `authentication_classes = []` en las vistas públicas — lo que
además hace que `AllowAny` signifique lo que parece.

Pendiente de decidir: si `LoginThrottle` pasa a ser por IP, ¿deben combinarse
`LoginThrottle` (por IP) y `UserRateThrottle` (por usuario) para no penalizar a
usuarios legítimos tras una NAT compartida?

### 2.2 Sin TLS: JWT y cookie de refresh en claro [VERIFICADO]

`frontend/nginx.conf:6` — `listen 80;` es el único listener. `nginx.conf:71-76`
tiene el bloque de redirección a HTTPS **comentado**. `docker-compose.yml:220`
— `SECURE_SSL_REDIRECT: ${SECURE_SSL_REDIRECT:-False}`.

En tránsito, cada request lleva el `Authorization: Bearer <jwt>` en claro y la
cookie de refresh —que es el activo más valioso, con 1 día de vida— también.
Cualquier proxy o Wi-Fi hostil captura la sesión completa.

Relacionado: `settings.py:360` ya anuncia
`Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`, pero
ese header solo se emite en respuestas de Django, y **el primer documento que ve
el navegador lo sirve nginx**, que no lo manda. El `preload` declarado es
ineficaz. Detalle en 4.2.

---

## 3. Altos

### 3.1 `docker-compose.override.yml` publica MySQL y Django en `0.0.0.0` [VERIFICADO]

Fichero completo, 10 líneas:

```yaml
services:
  backend:
    ports: !override
      - "8000:8000"      # 0.0.0.0 → Django alcanzable saltándose nginx
  frontend:
    ports: !override
      - "5173:80"
  mysql:
    ports: !override
      - "3307:3306"      # 0.0.0.0 → MySQL 8.0 desde toda la red
```

El compose base ata todo a loopback (`127.0.0.1:3307:3306`,
`127.0.0.1:8000:8000`, `127.0.0.1:5173:80`) y el override lo revierte. Docker
Compose carga `override` **automáticamente** en `docker compose up`, así que
esto es lo que se aplica, no una excepción.

Consecuencias:
- **MySQL 8.0 expuesto a toda la red.** Con la contraseña de la `.env` local.
- **Django accesible sin pasar por nginx** ⇒ se saltan el `deny all` de
  `/admin/` (`nginx.conf:61-63`), el `limit_req` (`nginx.conf:43`) y los headers
  de seguridad. Y, combinado con `settings.py:231` (`NUM_PROXIES: 1`), DRF lee el
  **último** elemento de `X-Forwarded-For`, que sin el proxy que lo sobrescriba
  es **controlado por el cliente** ⇒ todos los throttles se vuelven evadibles
  cambiando esa cabecera, uno a uno.

**Corrección:** que el override sea local y no se versione, o parametrizar el
bind: `"${BIND_ADDR:-127.0.0.1}:3307:3306"`. Lo que se commitea es lo que se
aplica en producción; el fail-safe actual es el contrario del deseado.

### 3.2 Registrar de nuevo reactiva una cuenta desactivada conservando `rol='admin'` [VERIFICADO]

`backend/api/serializers.py:112-166`. La rama de reactivación:

```python
candidata.username = username
candidata.email = email
candidata.is_active = False
candidata.is_verified = False
candidata.failed_attempts = 0
candidata.locked_until = None
candidata.lockout_count = 0
candidata.set_password(password)
candidata.save()          # ← candidata.rol nunca se toca
```

Busca candidatas con `is_active=False` sin filtrar por rol, y no toca `rol`.
`is_active=False` es **la única medida de baja que existe** —no hay borrado duro—
y es reversible por el propio sancionado: basta con registrarse otra vez y pulsar
el enlace que llega al buzón del atacante.

Un admin desactivado por moderación recupera `rol='admin'` al reactivarse. Sin
traza de que sea una cuenta privilegiada.

**Corrección:** no reactivar cuentas con `rol='admin'` por el flujo público; que
requieran restauración manual. O resetear explícitamente a `jugador` y notificar
al administrador.

### 3.3 `PasswordReset` nunca es penalizado por el middleware de fuerza bruta [VERIFICADO por lectura encadenada]

`middleware.py:24-31` registra `/api/password-reset/` en `BRUTE_FORCE_PATHS`, pero
`middleware.py:222-227` solo cuenta respuestas **4xx**. Y
`views_password_reset.py:258-261` devuelve **200 siempre**, exista o no el email
—que es anti-enumeración correcta, pero anula el contador.

Resultado: el middleware aporta **cero** a ese endpoint. Y con 2.1, tampoco el
throttle. Queda sin ninguna capa de rate limit.

### 3.4 Peticiones encoladas sin `_retry` ⇒ tormenta de refresh amplificada [VERIFICADO]

`frontend/src/api/axios.js:109-127`:

```js
if (isRefreshing) {
  return new Promise((resolve, reject) => {
    failedQueue.push({ resolve, reject })     // ← no marca _retry
  }).then((token) => { ... return API(originalRequest) })
}

originalRequest._retry = true                 // ← solo la primera
```

La bandera anti-bucle se pone **después** de la rama de la cola, así que una
petición encolada llega al reintento sin ella. `Home.jsx:39-42` dispara 4
peticiones en paralelo, de modo que el caso es real y permanente.

No es infinito (cada petición acaba con 2 reintentos como máximo), pero el
número de refreshes pasa de 1 a hasta N+1, cada uno rotando la cookie contra el
backend. **Corrección:** mover `originalRequest._retry = true` antes del `if`.

Lo que sí está bien y conviene no romper: `/token/refresh/` está en
`isAuthEndpoint` (`axios.js:105`), que es lo que impide el bucle
refresh→401→refresh. Y el `finally { isRefreshing = false }` está bien colocado.

### 3.5 `error.config` se desreferencia sin guard [VERIFICADO]

`axios.js:90` — `const originalRequest = error.config`, que puede ser
`undefined`. `axios.js:103` — `originalRequest.url.includes(...)` y
`axios.js:106` — `!originalRequest._retry` se evalúan **antes** del `if`, así que
corren para toda respuesta fallida. Cualquier camino de axios que entregue un
error sin `config` produce un `TypeError` **dentro del interceptor**, que
sustituye el error original por algo inútil. Debería ser
`originalRequest?.url ?? ''` y `!originalRequest?._retry`.

### 3.6 El formulario de perfil de Settings nunca se rellena [VERIFICADO]

`frontend/src/pages/Settings.jsx:54-55,70-75`:

```js
const [username, setUsername] = useState('')
const [email, setEmail] = useState('')
...
const [prevProfileId, setPrevProfileId] = useState(user?.id)
if (prevProfileId !== user?.id) {          // ← falso en el primer render
  setPrevProfileId(user?.id)
  setUsername(user?.username || '')
  setEmail(user?.email || '')
}
```

`prevProfileId` se inicializa con el id **actual**, así que la condición es
falsa en el primer render y el bloque nunca corre. El formulario aparece vacío
en su propia cuenta; al guardar, el backend responde "Completa el nombre de
usuario y el correo".

El comentario de las líneas 66-69 documenta la intención (ajuste en fase de
render, patrón correcto de React) pero lo aplica mal. **Corrección:** el estado
inicial debe ser `useState(user?.username ?? '')`.

### 3.7 Paginación rota en Admin: datos invisibles y conteos falsos [VERIFICADO]

`Admin.jsx:80,218,337` lee `r.data.results || r.data` y **nunca** `count`,
`next` ni `previous`. El backend pagina:

| Endpoint | `page_size` | Fuente |
|---|---|---|
| `/usuarios/` | 50 | `views_users.py:32` |
| `/niveles/` | 50 | `views_game.py:38` |
| `/admin/partidas/` | 50 | `views_game.py:38` |
| `/partidas/` | 20 | `views_game.py:151` |

Consecuencias:
- **Más de 50 usuarios son invisibles de forma permanente.** No hay paginación
  siguiente/anterior ni forma de llegar a ellos. En un panel de administración
  esto es pérdida funcional de datos.
- `Admin.jsx:144,269,350` muestran `{usuarios.length} usuarios` como total, pero
  es el tamaño de la página. Una estimación falsa presentada como dato exacto.

El mismo patrón afecta a `Home.jsx` (`/partidas/` a 20, y `partidas.slice(0,5)`
descarta 15 sin enlace a "ver más").

### 3.8 CSP con `unsafe-inline` y `unsafe-eval` [VERIFICADO]

`nginx.conf:16`:

```
script-src 'self' 'unsafe-inline' 'unsafe-eval'
```

El token **sí** está bien diseñado: vive solo en memoria
(`api/tokenStore.js:10`), nunca en `localStorage`. Pero conviene ser explícito
sobre lo que esoNO hace: **no mitiga un XSS**. Con ejecución de JS en el
origen, un atacante llama a `fetch('/api/usuarios/')` y el interceptor de
`axios.js:69-78` le añade el `Authorization` automáticamente. La respuesta le
llega. Y puede llamar a `POST /api/token/refresh/` y acuñar un access token
nuevo, exportable.

La defensa real es la CSP, y la CSP actual permite cualquier JS inyectado.

**Causa concreta y evitable:** `index.html:15-20` tiene un
`<script type="speculationrules">` inline. Un `speculationrules` **no ejecuta
JavaScript** — es un bloque de datos — así que no necesita `unsafe-inline`.
Además sus dos arrays están vacíos, o sea que no hace nada: es código muerto.
`unsafe-eval` no lo necesita nada del proyecto. Los dos se pueden eliminar hoy.

Directivas ausentes: `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`.

### 3.9 5 botones de contraseña inalcanzables por teclado [VERIFICADO por grep]

`Login.jsx:121`, `Register.jsx:227,289`, `ForgotPassword.jsx:285,303`:

```jsx
<button ... tabIndex={-1} aria-label={showPassword ? 'Ocultar' : 'Mostrar'}>
```

`tabIndex={-1}` saca el botón del orden de tabulación: no se puede enfocar con
Tab ni activar con Enter. Un usuario de teclado **no puede revelar la
contraseña**. Y el comentario de `Login.jsx:121` dice *"Excluido del tab order
para accesibilidad"*, que es lo contrario de lo que hace.

`ForgotPassword.jsx` además es el único con el `tabIndex={-1}` **y sin**
`aria-label` (los otros cuatro sí lo tienen).

---

## 4. Medios

### 4.1 Contrato de recuperación de contraseña consume 2 intentos por error [REPORTADO]

`ForgotPassword.jsx:154,165` llama a `/verificar-codigo/` y luego a `/confirm/`;
el backend incrementa `MAX_INTENTOS_CODIGO` (10) en **ambos**. El usuario tiene
5 intentos reales, no 10. La constante del backend sugiere 10. Verificar antes de
actuar: requiere leer las dos vistas.

### 4.2 HSTS y CSP de nginx [REPORTADO]

`middleware.py:129-142` emite la CSP **solo si no llega `X-Forwarded-Proto`**. Una
cabecera de seguridad condicionada a un header de request es desactivable desde
el lado del atacante si Django es accesible directamente (y lo es, por 3.1). Sin
`add_header` de HSTS en nginx, el primer documento nunca lleva HSTS. `SECURE_HSTS_PRELOAD=True`
en `settings.py:360` es irreversible en la práctica si el dominio no está listo.

### 4.3 Los assets estáticos pierden todos los headers de seguridad [REPORTADO]

`nginx.conf:36-39` declara su propio `add_header Cache-Control`, y en nginx eso
**rompe la herencia**: los `.js`, `.css`, `.svg`, `.png` se sirven sin CSP, sin
`X-Frame-Options` y sin `nosniff`. El propio repo conoce el gotcha — el comentario
de `nginx.conf:29-30` explica por qué `index.html` usa `expires -1` en vez de
`add_header` — y se aplicó la mitigación en un `location` y se olvidó en el otro.

### 4.4 Contraseñas con espacios: imposible iniciar sesión [VERIFICADO por lectura encadenada]

DRF recorta por defecto: `rest_framework/fields.py:729`
(`trim_whitespace=True`) y `:762` (`return value.strip()`). Los seis
`CharField` de contraseña de `serializers.py` (líneas 25,28,179,218,220) usan ese
default ⇒ se guardan **recortadas**. Pero
`views_users.py:225-227` lee `request.data.get('new_password', '')` **sin
serializer** ⇒ se guarda **con espacios**. Y el login compara contra el valor
guardado.

Una cuenta creada por `cambiar-password` con `" Abcdef1! "` queda
**permanentemente inaccesible**. Verificar el flujo completo antes de
corregirlo, pero la cadena de código es clara.

### 4.5 `logout` afirma cerrar sesión aunque el blacklist falle [REPORTADO]

`views_auth.py:420-439` captura `except Exception` y responde 200 con
`"Sesión cerrada"`. Si `blacklist()` falló, el refresh token sigue válido.
Debería ser un `except` acotado, log con `exc_info=True` y 500 (manteniendo el
borrado de cookie), para que el cliente sepa que la revocación no está
garantizada.

### 4.6 `verifySession` confunde caída de red con sesión expirada [REPORTADO]

`authService.js:110-119` — `catch { return null }` captura 401, 500, timeout y
DNS por igual. `AuthContext.jsx:67-68` hace `setUser(null)`. Un 500 expulsa al
usuario a la landing sin explicación, y como `usuario:v1` sigue en
`localStorage`, en la recarga reintenta. Debería distinguir 401 de "no se pudo
comprobar".

### 4.7 `removeItem` que lanza deja el estado de auth sin limpiar [REPORTADO]

`AuthContext.jsx:120-124`:

```js
const logout = useCallback(async () => {
  await authService.logout()     // si esto lanza, las 2 siguientes no corren
  setUser(null)
  setTokenReady(false)
}, [])
```

`authService.js:97` está fuera del `try/catch`. `localStorage.removeItem` lanza
`SecurityError` en Safari con "Prevenir cross-site tracking" y en algunos modos
privados. El `POST /logout/` sí se ejecutó, pero la UI sigue mostrando al usuario
autenticado sin token válido. Requiere `try/finally`.

### 4.8 `LoadingScreen` se reinicia en cada render de `App` [REPORTADO]

`App.jsx:171` pasa `onFinished={() => setShowLoading(false)}` — arrow inline,
identidad nueva en cada render. `LoadingScreen.jsx:53` depende de `[onFinished]`.
Cada cambio de contexto de auth re-ejecuta el efecto, que hace `clearTimeout` de
ambos timers y rearma los de 2500+3500 ms.

Consecuencia: la pantalla de carga dura 3,5 s **contadas desde el último cambio
de estado de auth**, no 3,5 s fijos. Y si el auth oscila, el usuario puede
quedarse atrapado. `App.jsx:41` consume `useAuth()`, así que los re-renders por
auth existen.

### 4.9 Enumeración de usuarios en login por código HTTP [REPORTADO]

`views_auth.py:235-270` — tres respuestas distinguibles: `401` "Credenciales
incorrectas", `403` "Cuenta desactivada", `429` "Cuenta bloqueada. Intente de
nuevo en {remaining} minutos". El trabajo anti-*timing* sí está bien (ejecuta
`check_password` también para usuarios inexistentes/inactivos), pero igualar la
CPU no iguala el código HTTP. Un script trivial deduce qué cuentas existen, cuáles
están desactivadas y cuántos minutos de bloqueo quedan.

Contraste: el reset de contraseña **sí** responde siempre igual, pero con
diferencia de latencia por el SMTP síncrono en la rama "existe"
(`views_password_reset.py:237-250`).

### 4.10 Redis caído ⇒ rate limiting por proceso y en silencio [REPORTADO]

`cache_backend.py:19-91` degrada a `LocMemCache` por proceso sin log. Con Redis
caído, el límite de 5/min de login pasa a ser 5/min **por worker de gunicorn**, y
no queda ni una traza. Debería loguear la primera degradación y exponer estado
de salud.

### 4.11 `TRUSTED_PROXIES` cubre rangos privados enteros [VERIFICADO por lectura]

`settings.py:38` — default `127.0.0.1,::1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16`.
`middleware.py:66-71` usa `X-Real-IP` tal cual si `REMOTE_ADDR` está en esa lista.
La lógica es mejor que ignorar `X-Forwarded-For` a ciegas y el comentario
explica el porqué, pero el default incluye toda la LAN —donde en Docker está
nginx— así que cualquier host de la red interna puede **elegir su propia IP**.

### 4.12 `AUTH_PASSWORD_VALIDATORS` nunca se invoca [REPORTADO]

`settings.py:196-201` define los cuatro validadores estándar; nadie los llama.
El registro usa `validate_password` propio y el cambio/reset usan
`check_password_strength` (`utils.py:183`). Resultado: dos políticas distintas
según la vía de alta, y `UserAttributeSimilarityValidator` y
`CommonPasswordValidator` nunca se aplican.

### 4.13 CSP condicionada a un header del cliente [REPORTADO]

`middleware.py:129-142` — la CSP se emite solo si **no** llega
`X-Forwarded-Proto`. Con Django accesible directamente (3.1), un cliente puede
enviar esa cabecera y suprimir la CSP completa.

### 4.14 22 de 31 módulos de producción sin test [VERIFICADO por enumeración]

Sin cobertura: `api/axios.js` (**el interceptor de refresh, la zona con más
ramas y la única cuyo fallo es una vulnerabilidad**), `App.jsx`,
`pages/{Admin,ForgotPassword,Home,Register,Settings,VerificarEmail}.jsx`,
`components/{Team,Hero,LoadingScreen,LoadingDots,Manifesto,News,Community,Footer}.jsx`,
`hooks/useIsMobile.js`, `contexts/useAuth.js`, `routes/lazyPages.js`, `main.jsx`.

`scripts/check-test-coverage.mjs` verifica que los tests **existan**, no que
**cubran**. No hay umbral de cobertura. La suite puede estar verde con 0 %
de cobertura funcional.

### 4.15 Accesibilidad: 15 de 21 ficheros `.jsx` sin un solo `aria-*` [VERIFICADO por enumeración]

- Sin `role="alert"` en `ErrorMessage.jsx` (su test tampoco lo comprueba).
- Iconos Material Symbols (`<span class="material-symbols-outlined">expand_more</span>`)
  leídos como texto inglés por lectores de pantalla. ~30 ocurrencias. Necesitan
  `aria-hidden="true"`.
- Imágenes decorativas de parallax en `Hero.jsx:141-181` con `alt="Background"`,
  `"Sun"`, `"Clouds"`, `"Boat"`, `"Sea"` — ruido puro. Deberían ser `alt=""` +
  `aria-hidden`.
- `ForgotPassword.jsx`: 4 `label/htmlFor` y 0 `aria-*`; los errores de campo no se
  asocian a su input.
- `eslint.config.js:11-15` no incluye `eslint-plugin-jsx-a11y`, que es justo lo
  que habría detectado 3.9.
- Saltos de jerarquía `h1 → h3` en la landing.

### 4.16 Check-then-act en lockout de login [REPORTADO]

`views_auth.py:232` — `SELECT` sin `FOR UPDATE`; `is_locked()` se evalúa sobre
datos leídos al inicio y nunca se bloquea la fila. N peticiones concurrentes leen
todas `locked_until = NULL` y **todas** verifican contraseña. El bloqueo limita
intentos secuenciales, no concurrentes. `PasswordResetConfirm` **sí** lo hace
bien con `select_for_update()` (`views_password_reset.py:339-345`) — la
inconsistencia sugiere que el patrón correcto ya existe en el repo.

### 4.17 Contador de fallos por IP no atómico [REPORTADO]

`middleware.py:102-104` — `cache.get(key,0) + 1` seguido de `cache.set`. No es
atómico: K peticiones paralelas leen el mismo `n` y escriben todas `n+1`, así que
se pierden K-1 intentos. 50 POST paralelos registran **un** fallo en lugar de 50.

---

## 5. Bajos e información

### Código muerto [VERIFICADO por grep]

| Ubicación | Estado |
|---|---|
| `api/models.py:279-288` `ConfirmacionReset.verificar_codigo()` | **Sin ningún llamador.** Y si alguien lo usa: no comprueba `confirmado`, no incrementa `failed_attempts` (eludiendo `MAX_INTENTOS_CODIGO`), compara por igualdad en BD en vez de `compare_digest`. Riesgo de reintroducir un bypass. |
| `hooks/useFetch.js:36-41` `refetch` | Nadie lo usa ni lo testea. Con `catch` **vacío** (fallo invisible) y un `AbortController` que se crea y se tira. |
| `authService.js:141-143` `getStoredToken()` | Nunca llamado. |
| `AuthContext.jsx:158-173` `checkSession` | Expuesto en el contexto, consumido **solo por tests**. |
| `utils/format.js:5-11` `DIFFICULTY_CONFIG`, `BADGE_MAP` | Cero usos, ni en producción ni en tests. |
| `utils/format.js:1-3` `formatTime` | Usado **solo por su test**. `Admin.jsx:370` reimplementa la lógica idéntica inline. |
| `index.html:15-20` `speculationrules` | Arrays vacíos, no hace nada. Es la causa raíz de `unsafe-inline` en la CSP. |
| `requirements.txt:75` `django-ipware==7.0.0` | No se importa en ningún sitio; `middleware.py:52-78` implementa su propia resolución de IP. |
| `requirements-dev.txt:18` `safety==3.8.1` | Ya no lo usa el CI. Documentado como no usado. |
| `hooks/useIsMobile.js:12-15` | `matchMedia` en cada llamada (correcto por `Object.is` sobre primitivo, pero ineficiente). |
| `Team.jsx:141` | Variable CSS global sin retirar al desmontar. |
| `ForgotPassword.jsx:56-57` `tokenRef` | Redundante: siempre refleja `urlToken`, que ya es estable. |

### CI [REPORTADO]

- `flake8` y `bandit` solo analizan `backend/api/`. **`backend/config/` y
  `manage.py` nunca se lintean** — y es donde viven `SECRET_KEY`, CORS, cookies
  y los handlers de logging.
- Sin `npm audit` ni escaneo de secretos en el frontend. Solo hay scanning Python.
- No se escanean las imágenes Docker construidas.
- `settings.py:123` desactiva Redis en tests (`'test' not in sys.argv`), así que
  **la ruta Redis nunca se ejercita**. Un corte de API en `redis-py 6.0.0` +
  Django 6.1 llegaría a producción con 118 tests verdes.
- `pip-audit` no cubre `requirements-dev.txt`.
- `cache-dependency-path` sin `cache: 'pip'` en dos jobs: la clave se ignora.
- Actions pineadas por tag mutable, no por SHA. Con `permissions: contents: read`
  el daño es limitado, pero es el control estándar.

### Docker [REPORTADO]

- **El contenedor arranca como root**: no hay instrucción `USER`. Existe
  `appuser` en `Dockerfile:45` y el entrypoint baja privilegios en runtime, pero
  `docker exec` y cualquier override de comando entran como root.
- `entrypoint.sh:18` — `migrate` en cada arranque: con réplicas, migraciones
  concurrentes.
- `libpq-dev` en la imagen de runtime, resultado de un comentario obsoleto
  (`Dockerfile:12` menciona psycopg2), y **no hay ningún driver PostgreSQL
  instalado** (más abajo).
- Secretos legibles en `docker inspect`: `--requirepass` en `command:` y
  contraseñas en los healthchecks (`compose:35,40,119`).
- `allkeys-lru` puede evictar contadores de anti-fuerza-bruta.
- Imágenes por tag mutable, sin digest.

### Cosas que están bien [VERIFICADO]

Conviene registrarlas, porque son el motivo de que el resto sea una lista
corta y no un desastre:

- **Cero SQL crudo** en todo `api/`. Ni `.raw()`, ni `.extra()`, ni f-strings en
  queries. Todo ORM parametrizado, incluidas las agregaciones de ranking.
- **Cero XSS**: ningún `dangerouslySetInnerHTML`, `innerHTML`, `eval` ni
  `new Function`. Todo contenido dinámico se interpola en JSX.
- **Cero `console.*`** en el frontend.
- **Cero secretos commiteados**, verificado con tres comprobaciones
  independientes. `SECRET_KEY` y `JWT_SECRET_KEY` son **fail-closed**: sin
  `default=`, y `raise ValueError` en producción si faltan. `DEBUG` es `False`
  por defecto. `CORS_ALLOW_ALL_ORIGINS` está hardcodeado a `False`.
- **Cero IDOR y cero escalación de privilegios por `rol`**: las 6 rutas que
  tocan usuarios/partidas/admin verifican propietario-o-admin.
  `permissions.py:4-6` valida contra el usuario de la BD, no del token.
- **Argon2** como hasher principal, sin MD5/SHA1 sin sal.
- **Comparación del código de 6 dígitos en tiempo constante** (`hmac.compare_digest`).
- **Tokens hasheados en la BD** (SHA-256 como PK): si se filtra la base, no son
  utilizables.
- **Anti-enumeración por *timing* en login** bien pensada (dummy hash).
- **`PasswordResetConfirm` correctamente transaccional** con `select_for_update()`
  — es el patrón que le falta a `LoginView` y `ChangePasswordView`.
- **Rotación de refresh transaccional** con bloqueo de fila (`views_auth.py:362-385`).
- **Ninguna duplicación real de contexto de auth**: un solo `createContext`
  (`contexts/auth-context.js:21`), un provider, un hook. La separación en 3
  ficheros es correcta. Se investigó expresamente porque el encargo lo pedía.
- `.nvmrc` ↔ `Dockerfile` ↔ `engines` ↔ CI coherentes en Node 22.
- Sin sourcemaps en producción; `dist/` correctamente ignorado.
- Healthchecks y rotación de logs en los 4 servicios de compose;
  `read_only: true` + tmpfs; `security_opt: no-new-privileges`.

### Correcciones a premisas que se dieron por buenas

- **El proyecto usa MySQL, no PostgreSQL.** `settings.py:160` es
  `django.db.backends.mysql`, `requirements.txt:46` es `mysqlclient`, y
  `compose:73` es `mysql:8.0`. No hay `psycopg` en ningún sitio. `Dockerfile:12`
  menciona `libpq-dev` "para psycopg2" — comentario obsoleto. Si el objetivo era
  migrar a Postgres, la config actual no lo soporta en absoluto: sería trabajo
  nuevo, no un bug.
- **La documentación del issue #1 era incompleta.** Cerré el issue reportando
  "0 vulnerabilidades" según safety; pip-audit encontró 14 que safety no veía.
  Ya corregido en `94ca936`.
- `ConfirmacionReset.verificar_codigo()` no es funcional, no solo "sin usar".

---

## 6. Orden sugerido

1. **2.1** — throttle bypass. Impacto amplio, fix pequeño. Y de paso 3.3, para que
   `/api/password-reset/` no quede en el limbo de no tener ninguna capa.
2. **3.1** — compose override. Lo que se commitea es lo que se aplica en
   producción.
3. **3.6 + 3.7** — Settings vacío y paginación rota. Bugs funcionales visibles
   que el usuario nota de inmediato.
4. **2.2** — TLS. Es una decisión de despliegue (certificados, dominio), no solo
   código, así que probablemente requiera tu participación.
5. **3.2** — decides si una cuenta admin desactivada puede recuperarse sola.
6. **3.4 + 3.5** — interceptor de axios, y tests de `axios.js` (4.14).
7. **3.8 + 3.9 + 4.15** — CSP, teclado, y `eslint-plugin-jsx-a11y` para que no
   vuelva a colarse.
8. **4.16 + 4.17** — atomicidad donde el patrón correcto ya existe en el repo.

Los puntos 1-3 son de los que más valor dan por unidad de esfuerzo, y 1 y 3
están en el mismo commit con tests de por medio.

---

## 7. Límites de esta auditoría

- La fase de **revisión** fue amplia pero la de **verificación** fue selectiva:
  verifiqué los hallazgos de mayor impacto y algunos otros. Lo marcado como
  [REPORTADO] no lo he reproducido.
- No se ejecutó la app en un navegador: los hallazgos de accesibilidad y UX son
  de análisis estático.
- No se probó el despliegue real en GCP ni el de Compose: los hallazgos de
  compose/nginx son de configuración, no de comportamiento observado.
- `schema.yml` (1690 líneas) y `DIAGRAMAS_UML.html` (558) no se auditaron.
- No hay medición de cobertura real: el recuento es "qué ficheros tienen test",
  no "qué código cubren las líneas".
