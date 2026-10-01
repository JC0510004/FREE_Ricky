# Auditoría del proyecto FREE_RICKY

Fecha: 2026-09-29 · **Actualizado: 2026-10-01** · Alcance: 134 ficheros versionados (~100 de código)

## Cómo leer este documento

Cada hallazgo lleva un estado. **No los trato todos como equivalentes:**

- **[ARREGLADO]** — cerrado y **verificado contra el código que hay ahora**, no
  contra el que había al escribir esto. Se indica el commit y la evidencia.
- **[VERIFICADO]** — lo comprobé directamente: leí el código, o ejecuté una
  prueba que lo demuestra. Se indica la evidencia. Sigue abierto.
- **[REPORTADO]** — detectado en la revisión, con referencia a fichero:línea,
  pero **no lo he reproducido**. Antes de actuar sobre él, confirmarlo.
- **[DUDOSO]** — hay indicios pero no estoy seguro. No actúes sobre esto sin mirar.

Esta distinción importa. En la fase anterior di por cerrado un issue de 25
CVE basándome en una herramienta que no cubría lo que decía cubrir. Un informe
que no distingue lo verificado de lo supuesto repite exactamente ese error.

### Sobre esta actualización

Al cerrarse los hallazgos, un documento que los sigue marcando como abiertos
pasa a ser peor que inútil: invita a "arreglar" cosas que ya están arregladas.

Los 2 Críticos y los 9 Altos se han marcado **[ARREGLADO]** después de
comprobar uno a uno contra el código actual, no de fiarme de los mensajes de
commit. La sección 4 (Medios) y la 5 (Bajos) **no se han reverificado**: se
marcan solo los que he vuelto a comprobar, y el resto conserva su estado
original con una nota de que está pendiente de revisión. Una corrección masiva
sin comprobar es justo el error que este documento denuncia.

---

## 1. Resumen ejecutivo

**Estado a 2026-10-01.** De los 11 hallazgos de las secciones 2 y 3 (2 críticos
+ 9 altos), **10 están arreglados y verificados**. Queda **uno**: el 2.2 (sin
TLS), que no es un bug de código sino una decisión de despliegue.

> **Corrección de este documento:** la versión anterior de esta tabla decía
> "Alto: 7 verificados + 4 reportados = 11", pero la sección 3 solo numeraba
> **9** hallazgos, todos marcados `[VERIFICADO]`. Ni el total ni el desglose
> cuadraban. El total real de la sección 3 es 9, no 11.

| Severidad | Total | Arreglados | Abiertos |
|---|---|---|---|
| Crítico | 2 | **1** | 1 (2.2, TLS) |
| Alto | 9 | **9** | 0 |
| Medio | 21 | 10 verificados + 1 **sin commitear** + 1 **falso** | 9, **sin reverificar** |
| Bajo / info | sin numerar | 1 (código muerto) | resto sin reverificar |

La distinción que importa está en la fila de medios: **10 de los 11 medios
"arreglados" están en el repo, y el undécimo no** (4.17, el contador atómico está
escrito en el working tree pero no commiteado). Cuéntalo como abierto hasta que
se commitee.

Tres de los medios no venían en el informe original, y los tres aparecieron al
implementar el requisito de que jugar exija correo verificado, no al auditar:
4.18 (jugar no exigía correo verificado), 4.19 (500 por token con tipo
incorrecto) y 4.20 (abrir el enlace confirmaba el correo sin pulsar nada). Ese
camino es una advertencia sobre el alcance de este documento: leer el código no
es lo mismo que recorrer el flujo, y el flujo es donde estaban los fallos.

Y un hallazgo resulta ser **falso**: el 4.1. Existe, estaba en la lista, y sin
embargo el flujo real consume un intento por error, no dos. Ver 4.1, porque el
"se hace `return` antes del segundo POST" es el tipo de detalle que no se ve
leyendo los dos llamadores del contador. Por eso los 21 medios se reparten en
10 verificados + 1 sin commitear + 1 falso + 9 sin reverificar.

**El hallazgo dominante era el rate limiting anónimo evadible de forma trivial.**
No era teórico — se ejecutó y se midió. Era el control de seguridad que el
proyecto daba por bien puesto en seis endpoints, y no protegía a ninguno.
**Arreglado** (`557defd`, `d3e8e88`): las throttles de endpoints públicos ahora
limitan por IP con `PublicIPThrottle`, y se descubrió de paso que
`AnonRateThrottle` en `DEFAULT_THROTTLE_CLASSES` hacía que **cualquier** vista
sin `throttle_classes` propio quedara sin límite para quien fuera autenticado.

El segundo patrón dominante era **"configuración que aparenta proteger y no
protege"**. Comprobado uno a uno:

| Afirmación original | Estado real |
|---|---|
| El compose publica MySQL a internet | **Arreglado** (`91e8d75`): el override que lo hacía no está en el repo |
| La CSP permite `unsafe-eval` | **Arreglado** (`1d8d601`, `1579fa7`) |
| El panel de admin depende de un rol en `localStorage` | **Arreglado**: el rol se valida contra el usuario de la BD |
| nginx no tiene TLS | **Sigue abierto** (2.2), y no se arregla aquí |

Lo que está bien es mucho y merece decirse: cero SQL crudo, cero XSS, cero
`console.log`, tokens fuera de storage persistente, argon2, secretos sin
fallback inseguro, y un `PasswordResetConfirm` transaccional que es ejemplo de
cómo debería ser el resto.

---

## 2. Críticos

### 2.1 Bypass total del rate limiting anónimo [ARREGLADO — commit `557defd`]

> **Cómo se cerró.** Se reprodujo el fallo (70 peticiones con JWT legítimo a
> `/api/password-reset/verificar/`: 70×200 y 0×429, frente a 429 a partir de la
> 61ª sin token) y se corrigió. Verificado después contra la app en marcha:
> 40×429 con JWT. El resto del texto de esta sección se conserva tal cual
> estaba escrito, porque es el análisis que llevó al arreglo.

**Alcance real, mayor de lo que decía este hallazgo.** Al arreglar las dos
vistas que se habían colado (`ConfirmarIdentidad` y `VerificarConfirmacion`),
se descubrió un segundo agujero del mismo tipo: `DEFAULT_THROTTLE_CLASSES`
usaba `AnonRateThrottle`, cuya `get_cache_key()` devuelve `None` en cuanto hay
usuario. Consecuencia: **toda vista sin `throttle_classes` propio quedaba sin
límite para quien se autenticara**, sin escribir una sola línea. Se comprobó
contra `/api/ranking/`, que no declara throttle propio: 80×200 con JWT antes,
80×429 después.

**Cómo se corrigió** (`backend/api/throttles.py`, `views_password_reset.py`,
`config/settings.py`):

- `PublicIPThrottle` con clave por IP, y `scope = 'anon'` para poder ocupar el
  lugar de `AnonRateThrottle` en la configuración por defecto.
- `ConfirmarIdentidadThrottle` (10/h) y `VerificarConfirmacionThrottle` (30/h),
  ambos heredando de `PublicIPThrottle`.
- Cuotas: 10/h para confirmar, 30/h para verificar; 60/min con `DEBUG`.

**Lo que NO se tocó, a propósito:** `middleware.py:244` sigue contando solo
respuestas 4xx, y `PasswordReset` sigue devolviendo 200 siempre para no
enumerar correos. Por eso el middleware **no aporta nada** en ese endpoint, y
eso es correcto: arreglarlo sería el error. La capa que limita es el throttle.
Quien lea el código y vea el 200 tiene que saber que no es un descuido.

**Regresión cubierta** (`backend/api/test_throttle_bypass.py`, 6 tests, aparte
de `tests.py` para no enredar cambios que ya había sin commitear ahí). Dos de
ellos no son de estos endpoints sino **invariantes que recorren todas las
vistas y la configuración por defecto**, porque el bug original no fue un
error de lógica sino de inventario: las vistas ya corregidas estaban bien y
estas dos se colaron porque nadie las revisó. Comprobado que los tests no son
vacíos: reintroduciendo el bug fallan 4 de 6.

**Origen:** `backend/api/throttles.py:4-39`, usado en `views_auth.py:83,186,324`,
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

### 2.2 Sin TLS: JWT y cookie de refresh en claro [VERIFICADO — **ABIERTO, es lo que queda**]

> **Prioridad ahora: el hallazgo abierto más grave del informe.** Todos los
> demás altos están cerrados; este no, porque no se arregla con código sino
> con certificados y un dominio. Ojo con un matiz: hay findings relacionados
> en §4 que hablan de este mismo punto y cuyo estado sí cambió (ver 4.2 y
> 4.3), así que no los cuentes dos veces al planificar.

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

### 3.1 `docker-compose.override.yml` publica MySQL y Django en `0.0.0.0` [ARREGLADO — commit `91e8d75`]

**Verificado cómo:** el fichero **no existe** en el repo, y `docker compose ps`
confirma que el backend solo tiene `expose` (sin `ports`) y que MySQL, Redis y
frontend están atados a `127.0.0.1`. Se añadió además una nota larga al pie del
compose explicando por qué no debe volver a crearse, porque el fallo no era
técnico sino de criterio: *lo que se commitea es lo que se aplica en
producción*.

El riesgo que este hallazgo describía —que con Django accesible sin nginx, DRF
leyera el **último** elemento de `X-Forwarded-For` y todos los throttles se
volvieran evadibles— queda cerrado por el mismo cambio, ya que el 8000 no se
publica. Aun así, la corrección de 2.1 se hizo por IP igualmente: no depended
de que nadie tenga abierto el puerto.

**Texto original conservado:**

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

### 3.2 Registrar de nuevo reactiva una cuenta desactivada conservando `rol='admin'` [ARREGLADO — commit `e9cf6f2`]

**Arreglado más a fondo de lo que pedía este hallazgo.** La rama de
reactivación ahora **rechaza** el registro, en dos casos:

1. `candidata.desactivado_por_admin` → error. Una cuenta que el administrador
   desactivó no vuelve por una ruta pública, **aunque su rol sea `jugador`**.
2. `candidata.rol == 'admin'` → error. Una cuenta admin cerrada no se reactiva
   ni siquiera si el cierre vino del propio usuario, porque reactivarla
   devolvería justo los privilegios que el cierre quería quitar.

Además valida que ni el username ni el email estén ocupados por otro usuario
(activo o inactivo), que es lo que faltaba para no violar las restricciones
únicas al reactivar. `is_active=False` sigue siendo la única medida de baja que
existe, pero **dejar de ser activo ya no es reversible por el sancionado**.

**Texto original conservado:**

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

### 3.3 `PasswordReset` nunca es penalizado por el middleware de fuerza bruta [ARREGLADO — por otra vía, commit `557defd`]

**Matiz importante, porque la conclusión original era correcta y la
remediación no era la que este hallazgo pedía.** La observación técnica sigue
siendo cierta: `middleware.py:244` solo cuenta 400/401/403/429 y
`PasswordReset.post` devuelve 200 siempre, así que **el middleware sigue
aportando cero** a ese endpoint.

Pero la conclusión ("queda sin ninguna capa de rate limit") ya no era cierta y
este hallazgo se cerró con el throttle de 2.1, no tocando el middleware.
Medido contra la app en marcha: 10 peticiones seguidas a `/api/password-reset/`
dan **3×200 y 7×429** (cuota 3/h).

**Por qué no se "arregló" el middleware aquí:** el 200 existe para no
enumerar correos. Si el middleware contara como fallo esa respuesta, pasarían a
contar los intentos legítimos de cualquier usuario que pida un reset, y el
bloqueo por IP empezaría a castigar a las víctimas. La capa correcta es el
throttle, y ya está. **Quien lea `middleware.py` y vea que `/api/password-reset/`
está en `BRUTE_FORCE_PATHS` debería saber que la línea es inerte ahí, no
olvidada.**

**Texto original conservado:**

`middleware.py:24-31` registra `/api/password-reset/` en `BRUTE_FORCE_PATHS`, pero
`middleware.py:222-227` solo cuenta respuestas **4xx**. Y
`views_password_reset.py:258-261` devuelve **200 siempre**, exista o no el email
—que es anti-enumeración correcta, pero anula el contador.

Resultado: el middleware aporta **cero** a ese endpoint. Y con 2.1, tampoco el
throttle. Queda sin ninguna capa de rate limit.

### 3.4 Peticiones encoladas sin `_retry` ⇒ tormenta de refresh amplificada [ARREGLADO — commit `94f926f`]

**Verificado cómo:** en `frontend/src/api/axios.js` la bandera se pone ahora
**antes** de esperar a la renovación, y no después de la rama de la cola. El
comentario del código lo dice explícitamente: *"se pone ANTES de esperar la
renovación, también para las que se encolan: si se pusiera después, una petición
reencolada llegaría al reintento sin ella"*. El diagnóstico de este hallazgo
era exacto y la corrección es la que propugnaba.

**Texto original conservado:**

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

### 3.5 `error.config` se desreferencia sin guard [ARREGLADO — commit `94f926f`]

**Verificado cómo:** `axios.js` empieza el interceptor de error con

```js
const originalRequest = error?.config
if (!originalRequest) return Promise.reject(error)
```

El guard está **antes** de cualquier uso de `originalRequest`, que es
exactamente lo que pedía este hallazgo. Consecuencia ya resuelta: un error de
red (que llega sin `config` ni `response`) devuelve el error real en vez de
sustituirlo por un `TypeError` lanzado dentro del interceptor, que es lo que
vía el usuario como "falló la conexión" mientras el desarrollador veía otra
cosa.

**Texto original conservado:**

`axios.js:90` — `const originalRequest = error.config`, que puede ser
`undefined`. `axios.js:103` — `originalRequest.url.includes(...)` y
`axios.js:106` — `!originalRequest._retry` se evalúan **antes** del `if`, así que
corren para toda respuesta fallida. Cualquier camino de axios que entregue un
error sin `config` produce un `TypeError` **dentro del interceptor**, que
sustituye el error original por algo inútil. Debería ser
`originalRequest?.url ?? ''` y `!originalRequest?._retry`.

### 3.6 El formulario de perfil de Settings nunca se rellena [ARREGLADO — commit `94f926f`]

**Verificado cómo:** `Settings.jsx:96-97` usa ahora
`useState(user?.username ?? '')` y `useState(user?.email ?? '')`, es decir el
estado inicial ya viene del usuario y el bloque `prevProfileId` desapareció. Es
la corrección literal que proponía este hallazgo.

**Texto original conservado:**

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

### 3.7 Paginación rota en Admin: datos invisibles y conteos falsos [ARREGLADO — commit `8894315`]

**Verificado cómo, contra la app en marcha y no solo leyendo código:** se
metieron 60 usuarios de prueba y se pidieron dos páginas con token de admin.

```
count=62 (sin token extra: 62)
?page=1 -> 50 filas, ids 21-72
?page=2 -> 12 filas, ids 73-84
page1 ∩ page2 = 0 filas   -> sin solape, paginación real
```

El badge anterior habría dicho **"50 usuarios"** cuando eran 62. Los 60 usuarios
de prueba se borraron después; la BD volvió a sus 2 usuarios reales.

**Qué se añadió:**

- `frontend/src/hooks/usePaginada.js` — lee `count` y mantiene la página en
  estado. `pageSize` se pasa **explícito** porque DRF no lo devuelve en la
  respuesta, y así el rango "1-50 de 312" es cierto en vez de aproximado. Si se
  borra la última fila de la última página, retrocede en lugar de dejar la
  tabla vacía.
- `frontend/src/components/Paginacion.jsx` — "Mostrando X-Y de Z" más
  Anterior/Siguiente, deshabilitados en los extremos, sin pintar nada si todo
  cabe en una página, y **alcanzables con teclado** (requisito directo de 3.9:
  no repetir el patrón que acabamos de corregir).
- `Admin.jsx` — las tres pestañas (usuarios, niveles, partidas) pasan a usar el
  hook y a mostrar `total` en vez de `.length`.

**`Home.jsx` no se paginó, y el motivo es que no se puede.** El backend usa el
`PageNumberPagination` de DRF **sin `page_size_query_param`**, así que
`?page_size=N` se ignora; comprobado: `?page_size=1` sigue devolviendo la página
entera. Se mantiene la intención de producto (las 5 más recientes) pero ya no
se descarta el resto **en silencio**: se avisa de cuántas hay en total.

**Cobertura:** 12 tests nuevos (117 en el frontend, antes 104). Dos fallaron al
escribirlos y **los tests eran lo incorrecto, no el código**: un mock que
devolvía vacío siempre provocaba una cascada de páginas, y se daba por hecho
que un botón deshabilitado recibe el foco (no lo hace, el navegador lo salta).

**Texto original conservado:**

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

### 3.8 CSP con `unsafe-inline` y `unsafe-eval` [ARREGLADO — commits `1d8d601` y `1579fa7`]

**Verificado contra el nginx real, no solo el fichero:** se reconstruyó la
imagen (la configuración va horneada, no montada) y se leyó la cabecera que
sirve. Ahora es `script-src 'self'`, **sin `unsafe-inline` ni `unsafe-eval`**, y
el HTML servido tiene **0 scripts inline**. El bundle compilado tiene **0
`eval(` y 0 `new Function`**, y es un build de producción real (`jsxDEV` y
`react-stack-bottom-frame` ausentes), así que la CSP es exigible de verdad y no
se está rompiendo nada.

**La causa concreta que señalaba este hallazgo era exacta:** el
`<script type="speculationrules">` inline de `index.html` no ejecutaba
JavaScript (es un bloque de datos) y sus dos arrays estaban vacíos. Era código
muerto, y estaba debilitando el único cinturón que frena el robo de sesión a
cambio de no hacer nada. **Borrado** en `1579fa7`.

Se prefirió borrar el código muerto antes que meter un hash SHA-256 en la CSP:
el hash es frágil (cualquier retoque obliga a recalcularlo) y su fallo es
silencioso, porque el navegador bloquea y no se ve en los tests.

**Por qué esto pesa aquí más que en una app normal,** y es el punto que el
informe original subrayaba: el token de acceso vive solo en memoria
(`api/tokenStore.js`), lo cual protege contra que lo roben del disco, pero
**no** contra un XSS. Con ejecución de JS en el origen, el atacante llama a
`fetch('/api/usuarios/')`, el interceptor de axios le añade el `Authorization`
solo, recibe la respuesta, y puede pedir `POST /api/token/refresh/` para acuñar
un token nuevo y exportarlo. Guardar el token en memoria no hace que la CSP sea
opcional.

`unsafe-eval` ya lo había quitado `1d8d601`, junto con `object-src 'none'`,
`base-uri 'self'`, `form-action 'self'` y los headers de los assets (ver 4.3).

**Lo que queda abierto en materia de CSP** es 4.13, que no es lo mismo: la CSP
de **Django** sigue condicionada a un header del cliente.

**Texto original conservado:**

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

### 3.9 5 botones de contraseña inalcanzables por teclado [ARREGLADO — commit `75064aa`]

**Verificado cómo:** `grep` de `tabIndex={-1}` sobre todo `src/` devuelve
**0 coincidencias**, y los cinco botones están en el orden de tabulación con su
respectivo `aria-label`. De paso se añadió el `aria-label` que faltaba en los
dos de `ForgotPassword.jsx`.

```jsx
<button ... aria-label={showPassword ? 'Ocultar' : 'Mostrar'}>
```

El comentario original de `Login.jsx` decía *"Excluido del tab order para
accesibilidad"* haciendo exactamente lo contrario de lo que anunciaba: quien lo
escribió quiso excluirlo y se equivocó de lado. Ese comentario se ha borrado.

Los tests de la paginación nueva (3.7) cubren explícitamente que sus botones
**sí** son alcanzables y activables con teclado, precisamente para que no se
repita el patrón que aquí se corrige.

**Lo que este hallazgo dejaba abierto y sigue abierto:** `eslint.config.js` no
incluye `eslint-plugin-jsx-a11y`, que es lo que habría detectado esto
automáticamente. Está en 4.15, y es la parte preventiva, no la curativa.

**Texto original conservado:**

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

**Triage al 2026-10-01. Esta sección NO se ha reverificado entera.** Lo que no
aparece en la tabla conserva su estado original, y eso significa *pendiente de
revisión*, no *confirmado*. De los 17 medios, 6 los he vuelto a comprobar.

| # | Hallazgo | Estado tras el triage |
|---|---|---|
| 4.1 | Recuperación consume 2 intentos por error | **[FALSO]** — no se sostiene. Ver 4.1 |
| 4.2 | HSTS y CSP de nginx | **Sigue abierto** (parcial: ver nota) |
| 4.3 | Assets pierden los headers de seguridad | **[ARREGLADO]** (`1d8d601`) |
| 4.4 | Contraseñas con espacios | **Sin reverificar** (hay cambios locales sin commitear en `views_users.py`) |
| 4.5 | `logout` miente si el blacklist falla | **[ARREGLADO]** (`53d4538`) |
| 4.6 | `verifySession` confunde caída de red con sesión expirada | **Sigue abierto** |
| 4.7 | `removeItem` que lanza deja el estado sucio | **[ARREGLADO]** (`9838a00`) |
| 4.8 | `LoadingScreen` se reinicia en cada render | **Sin reverificar** |
| 4.9 | Enumeración de usuarios en login | **[ARREGLADO]** (`53d4538`) |
| 4.10 | Redis caído: rate limiting silencioso | **Sin reverificar** |
| 4.11 | `TRUSTED_PROXIES` cubre rangos privados | **Sin reverificar** |
| 4.12 | `AUTH_PASSWORD_VALIDATORS` nunca se invoca | **Sin reverificar** |
| 4.13 | CSP de Django condicionada a header del cliente | **Sigue abierto** (misma raíz que 4.2) |
| 4.14 | 22 de 31 módulos sin test | Parcialmente mejorado (ver nota) |
| 4.15 | 15 de 21 `.jsx` sin `aria-*` | Parcialmente mejorado (ver 3.9) |
| 4.16 | Check-then-act en lockout de login | **[ARREGLADO]** (`492e29d`) |
| 4.17 | Contador de fallos por IP no atómico | **Arreglado en local, SIN COMMITEAR** ⚠ |

**Tres avisos sobre la tabla:**

- **4.17 está arreglado pero no está en el repo.** El contador atómico existe
  en tu working tree (`middleware.py`), pero **no en `HEAD`**: lo comprobé con
  `git show HEAD:backend/api/middleware.py`. Mientras no se commitee, para
  cualquier otra persona —y para un despliegue desde el repo— **el bug sigue
  ahí**. Es el único punto de todo este documento donde el estado del código en
  disco y el estado del código versionado no coinciden, y por eso lleva aviso.
- **4.2 y 4.13 cuentan lo mismo.** Ambos hablan de que la CSP solo se aplica si
  el cliente no envía `X-Forwarded-Proto`. En el estado actual sigue siendo
  cierto en Django, pero **el escenario de riesgo cambió**: con 3.1 arreglado
  Django ya no es accesible sin nginx, y nginx pone siempre ese header, así que
  la rama que decide queda prácticamente inalcanzable por red. Sigue siendo
  código defectuoso y no debe fiarse uno de él, pero es menos grave que cuando
  se escribió. No los sumes dos veces al planificar el trabajo.
- **4.14 y 4.15 mejoraron, no se cerraron.** 4.15 baja de 15 a 13 ficheros sin
  `aria-*` por los `aria-label` de 3.9, y sigue sin haber
  `eslint-plugin-jsx-a11y`. 4.14 baja de 22 a 20 módulos sin test gracias a
  `usePaginada` y `Paginacion` (con sus 13 tests nuevos), pero el problema de
  fondo —la cobertura medida por líneas no existe— sigue entero.

**Un aviso sobre el ritmo.** La verificación que cerró 4.1 y 4.17 salió de
seguir dos hallazgos que había marcado como "sin reverificar". Uno era falso y
otro estaba arreglado a medias. Ninguno de los dos habría salido de leer el
código: los dos malgastaron tiempo en direcciones que no eran el problema.

**Sobre 4.1**, que ya no está pendiente: era un hallazgo **falso**, comprobado
contra la app en marcha. Los dos puntos de incremento existen, pero el frontend
hace `return` antes del segundo POST, así que un código incorrecto consume un
solo intento. Detalle y medición en 4.1.

### 4.1 "Consume 2 intentos por error" — [FALSO, el hallazgo no se sostiene]

**Este hallazgo era incorrecto y no debe contar en ningún plan de trabajo.**
Cerrado el 2026-10-01 tras seguir el flujo completo, no solo leyéndolo.

Decía que el backend incrementaba `MAX_INTENTOS_CODIGO` en `/verificar-codigo/`
**y** en `/confirm/`, y que por tanto el usuario tenía 5 intentos reales en vez
de 10. La primera mitad es cierta: los dos puntos de incremento existen
(`views_password_reset.py:336` en `PasswordResetConfirm` y `:456` en
`VerificarCodigo`). La conclusión es falsa, y por dos motivos independientes:

1. **El frontend nunca hace las dos llamadas con un código incorrecto.**
   `ForgotPassword.jsx:154-158` valida el código y, si no es válido,
   **hace `return` en la línea 157**. La llamada a `/confirm/` de la línea 160
   es inalcanzable en ese escenario. El segundo POST no se ejecuta.
2. **Y aunque se ejecutara, `/confirm/` no contaría nada.** En esa vista el
   chequeo de `confirmado` (L324) va **antes** que el del código (L335), así que
   un flujo sin confirmar identidad se detiene sin tocar el contador.

Comprobado contra la app en marcha, no solo por lectura. Se creó un
`ConfirmacionReset` real y se mandó un código erróneo por nginx:

```
POST /password-reset/verificar-codigo/  (codigo incorrecto) -> 400
   intentos tras el paso 1: 1        <- UN intento, no dos
```

**Por qué las dos vistas incrementan y no es un descuido:** es defensa en
profundidad. Son dos endpoints distintos con contratos distintos, y cada uno
tiene que proteger su propio umbral. Si mañana alguien llama a `/confirm/`
directamente desde curl, saltándose el frontend, ese límite lo para. Que el
frontendResulta limpio no vuelve innecesario el del servidor.

**Lección sobre el propio informe:** este hallazgo se wrote por leer dos
llamadores del incrementador y asumir que los dos se ejecutaban en un mismo
intento del usuario. Era un `REPORTADO`, nunca se reprodujo, y el propio
documento marcaba esa diferencia. La etiqueta era correcta: no lo tomes como
ejemplo de hallazgo verificado.

*Registro del cierre: `token_hash` de prueba creado y borrado; la fila que queda
en `confirmaciones_reset` es tuya del 2026-09-24, ajena a esta prueba.*

**Texto original conservado:**

### 4.2 HSTS y CSP de nginx [REPORTADO]

`middleware.py:129-142` emite la CSP **solo si no llega `X-Forwarded-Proto`**. Una
cabecera de seguridad condicionada a un header de request es desactivable desde
el lado del atacante si Django es accesible directamente (y lo es, por 3.1). Sin
`add_header` de HSTS en nginx, el primer documento nunca lleva HSTS. `SECURE_HSTS_PRELOAD=True`
en `settings.py:360` es irreversible en la práctica si el dominio no está listo.

### 4.3 Los assets estáticos pierden todos los headers de seguridad [ARREGLADO — commit `1d8d601`]

**Verificado cómo:** el `location` de assets usa ahora `expires 1y;` en lugar de
`add_header Cache-Control`, con un comentario que explica **por qué** y que es
justo el mecanismo que este hallazgo señalaba: *con `add_header` dentro del
bloque, los headers heredados del `server` no se acumulan, se sustituyen en
cuanto se usa uno*. La mitigación que el propio repo ya conocía en `index.html`
(`expires -1` en vez de `add_header`) se aplicó aquí al otro `location`, que es
literalmente lo que este finding recomendaba.

Este era un **arreglado por el mismo commit** que quitó `unsafe-eval` de la CSP
(ver 3.8), lo cual explica por qué la lista de headers de §3 y §4 mencionaba el
mismo fichero en hallazgos distintos.

**Texto original conservado:**

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

### 4.5 `logout` afirma cerrar sesión aunque el blacklist falle [ARREGLADO — commit `53d4538`]

**Verificado cómo, leyendo la respuesta real del código** (`views_auth.py:478-495`):
cuando `blacklist()` lanza, ahora se registra con `logger.error` y se devuelve
**500 con `"No se pudo cerrar la sesión en el servidor. Inténtalo de nuevo."`**,
borrando igualmente la cookie. Es exactamente lo que pedía este hallazgo,
incluido el matiz de **mantener el borrado de cookie aunque la revocación
falle**.

El comentario del código explica por qué el resto de casos **sí** devuelven
200, y es un matiz que este finding original no recogía: si el token que llega
ya está caducado o es inválido, la sesión está muerta igualmente, así que
responder 200 mantiene el logout **idempotente**. Distinguir "no pude
revocar porque el token ya no valía" de "no pude revocar porque el servidor
falló" es lo que evita que un logout real se convierta en un error para el
usuario.

**Texto original conservado:**

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

### 4.7 `removeItem` que lanza deja el estado de auth sin limpiar [ARREGLADO — commit `9838a00`]

**Verificado cómo:** `AuthContext.jsx` envuelve el `logout` en
`try { ... } catch { ... } finally { ... }`, y el `setUser(null)` +
`setTokenReady(false)` están en el **`finally`**, que se ejecuta aunque
`removeItem` lance. Es el `try/finally` que pedía este hallazgo.

Sobre la causa raíz (`localStorage.removeItem` lanzando `SecurityError` en
Safari): el hallazgo la daba por supuesta y yo no la he reproducido, así que no
la doy por buena. Lo que sí es cierto es que **el `finally` neutraliza la causa
raíz**, que es la parte que de verdad importa: a partir de ahí, un
`removeItem` que falle ya no puede dejar la UI mostrando a un usuario sin
token, sea cual sea el motivo.

**Texto original conservado:**

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

### 4.9 Enumeración de usuarios en login por código HTTP [ARREGLADO — commit `53d4538`]

**Verificado cómo, leyendo las tres ramas de salida de la vista de login**
(`views_auth.py:262-309`): usuario inexistente, cuenta inactiva y cuenta
bloqueada devuelnen **las tres** la misma variable `credenciales_invalidas`, con
el mismo código y el mismo cuerpo. Ya no hay 404 para "no existe" ni 403 para
"bloqueada".

El detalle fino que hace que esto esté bien resuelto, y que el finding original
no pedía explícitamente: en las dos ramas bloqueantes se ejecuta
`usuario.check_password(password)` **antes** de responder, precisamente para
igualar el tiempo de respuesta con el de un login válido. Sin eso, el mensaje
uniforme solo taparía el canal visual y dejaría abierto el temporal. El
comentario del código lo dice: *"NO se comunican los minutos restantes:
confirmarían que la cuenta existe y está bloqueada"*.

**Texto original conservado:**

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

### 4.16 Check-then-act en lockout de login [ARREGLADO — commit `492e29d`]

**Verificado cómo, leyendo el modelo** (`models.py`, `increment_failed_attempts`):
ahora el incremento, la comprobación del umbral y la escritura del bloqueo
ocurren **dentro de `transaction.atomic()`, precedidos de un
`select_for_update()`** sobre la fila. Son indivisibles, que es exactamente lo
que pedía este hallazgo.

El comentario del código explica además el fallo real, que era más sutil que
un simple check-then-act: el incremento **ya era atómico** (`F() + 1`), pero la
**decisión de bloquear** no lo era. K peticiones concurrentes con el contador
cerca del umbral pasaban todas el `>= 5` y cada una bumpeaba `lockout_count` y
sobrescribía `locked_until`, escalando el bloqueo de golpe hasta el máximo. Se
añadió además el guard `not row.is_locked()` para no re-escalar con un bloqueo
en curso. Como efecto colateral, `locked_until` ya no queda incoherentemente
pisado respecto a `lockout_count`.

**Texto original conservado:**

`views_auth.py:232` — `SELECT` sin `FOR UPDATE`; `is_locked()` se evalúa sobre
datos leídos al inicio y nunca se bloquea la fila. N peticiones concurrentes leen
todas `locked_until = NULL` y **todas** verifican contraseña. El bloqueo limita
intentos secuenciales, no concurrentes. `PasswordResetConfirm` **sí** lo hace
bien con `select_for_update()` (`views_password_reset.py:339-345`) — la
inconsistencia sugiere que el patrón correcto ya existe en el repo.

### 4.17 Contador de fallos por IP no atómico [⚠ ARREGLADO **PERO SOLO EN TU DISCO**]

> **El riesgo real de este hallazgo no es que el bug siga vivo. Es que tú
> estás probando contra una versión arreglada mientras el repo tiene la
> rota.**
>
> Comprobado: el contenedor `free_ricky_backend` **sí** contiene el arreglo
> (`grep cache.incr /app/api/middleware.py` → L116). El compose solo monta
> `backend_logs`, así que el fuente va **horneado en la imagen**: construiste
> la imagen cuando `middleware.py` ya tenía el fix. Pero `git show HEAD:...`
> confirma que **`HEAD` sigue con el `cache.get + 1`**.
>
> Traducción: localmente todo parece correcto y las pruebas pasan. Quien clone
> el repo, o un despliegue desde el repo, recibe el bug. **Falsa confianza.**

**Medición directa contra Redis real**, 50 hilos llamando en paralelo a cada
lógica:

```
intentos lanzados            : 50
LOGICA VIEJA (la que hay en HEAD) : 20    <- se pierde el 60%
LOGICA NUEVA (el fix)              : 50    <- exacto
```

El 60% de intentos perdidos no es un detalle teórico: el atacante que dispara
en paralelo es justo el caso para el que existe este contador.

**El arreglo, tal cual está en tu disco:**

```python
if not cache.add(key, 1, BruteForceIPMiddleware.WINDOW_SECONDS):
    try:
        attempts = cache.incr(key)
    except ValueError:
        cache.add(key, 1, BruteForceIPMiddleware.WINDOW_SECONDS)
        attempts = 1
else:
    attempts = 1
```

`cache.add()` es atómico (solo el primer llamante crea la clave) y `incr()` también
en Redis, de modo que no hay read-modify-write. El `except ValueError` cubre la
carrera en la que la clave expira entre el `add()` que falló y el `incr()`.

**Por qué `cache.incr` y no un `F()` de Django:** el contador vive en Redis, no
en la BD, así que no hay ORM queocking aquí. Y ojo con una cosa que este arreglo
**no** arregla: con `LocMemCache` (el fallback degradado de 4.10) `incr` es
atómico *dentro de un proceso*, pero cada worker de gunicorn tiene su propio
contador. Arreglar 4.17 sin 4.10 deja el fallo abierto en el escenario de Redis
caído, que es justo cuando más importa.

**Acción pendiente: commitearlo.** Es lo único que separa "arreglado" de
"arreglado de verdad" en todo este documento. Revisa antes los otros cambios
locales de ese mismo fichero.

**Texto original conservado:**

`middleware.py:102-104` — `cache.get(key,0) + 1` seguido de `cache.set`. No es
atómico: K peticiones paralelas leen el mismo `n` y escriben todas `n+1`, así que
se pierden K-1 intentos. 50 POST paralelos registran **un** fallo en lugar de 50.

---

### 4.18 Jugar no exigía correo verificado [ARREGLADO, sin commitear]

**No venía en el informe original.** Lo encontré al implementar el requisito de
que jugar exija correo verificado, y conviene dejarlo escrito porque el cambio es
pequeño pero cambia quién puede consumir recursos del ranking.

El campo `Usuario.is_verified` existía y el registro público lo dejaba a `False`,
pero nada lo comprobaba: `POST /api/partidas/` solo pedía `IsAuthenticated`.
Es decir, la verificación de correo era **decorativa**: cualquiera se registraba,
recibía el token de sesión y podía jugar y subir al ranking sin confirmar nunca
que el correo fuera suyo. Para un ranking público eso significa que la
puntuación no está atada a una identidad comprobada.

El arreglo mete `IsEmailVerified` (`backend/api/permissions.py`) en
`PartidaListView`, pero **solo en el POST**:

```python
def get_permissions(self):
    if self.request.method == 'POST':
        return [IsAuthenticated(), IsEmailVerified()]
    return [IsAuthenticated()]
```

El detalle que no es trivial: el permiso va por método y **no** en
`permission_classes`, porque puesto ahí un usuario sin verificar no podría ni
mirar su propio historial, y el frontend recibiría un 403 en una pantalla que no
tiene nada que ver con jugar. Ver el historial es inocuo; lo que se protege es
poder registrar partidas.

**Evidencia (145/145 backend en verde, más el flujo real por HTTP):**

| Paso | Resultado |
|---|---|
| Registro público | `201`, `is_verified=false` |
| `POST /api/partidas/` sin verificar | `403` + mensaje que dice cómo resolverlo |
| `GET /api/partidas/` sin verificar | `200` con historial vacío |
| `POST /api/verificar-email/` con el token del correo | `200` "Correo verificado" |
| `POST /api/partidas/` ya verificado | `201`, partida creada y visible en el ranking |
| `POST /api/partidas/` sin token | `401`, no `403` (la autenticación precede al permiso) |

**Lo que este arreglo NO hace.** Tras completar el flujo (ver 4.20), de esta
lista solo queda pendiente el envio de correo real:

- **No se envia correo real.** `EMAIL_HOST_PASSWORD` esta vacio, asi que
  `settings.py` usa `console.EmailBackend` y el enlace sale por los logs. Los
  tokens de verificacion se imprimen en texto plano ahi.
- **`email_utils.enviar_email` se traga las excepciones** y la API responde `200`
  aunque no se haya enviado nada. Con consola es lo razonable; con SMTP real en
  produccion significa "creo que se envio" cuando puede no haberse enviado.

---

### 4.19 Token con tipo incorrecto provoque 500 en tres endpoints publicos [ARREGLADO, sin commitear]

**No venia en el informe original.** Lo encontre al probar el flujo de
verificacion de correo a mano, cuando un POST mio con `{"token": {"a": 1}}`
devolvio 500 en vez de 400.

Los tres afectados hacen lo mismo: `token = request.data.get('token', '')` y acto
seguido `hashlib.sha256(token.encode())`. Si el cliente envia un objeto o una
lista en vez de una cadena, `.encode()` no existe y salta `AttributeError`:

| Endpoint | Autenticado | Toma el token de |
|---|---|---|
| `POST /api/verificar-email/` | No | `request.data` |
| `POST /api/password-reset/confirmar/` | No | `request.data` |
| `POST /api/password-reset/verificar-codigo/` | No | `request.data` |

Por que importa mas alla del 500: los tres son **publicos y sin autenticar**, y
por tanto alcanzables por cualquiera que conozca la URL. Un 500 no es solo ruido:
ensucia el panel de errores con trazas que no indican un fallo real del sistema,
y en el caso de `confirmar/` lo que se devuelve al navegador es una pagina de
error en lugar del JSON que el frontend espera, asi que el usuario ve un error
generico en vez de "el enlace no es valido".

El arreglo es una comprobacion de tipo antes de usar el valor, no un `try/except`
alrededor del hash: `if not isinstance(token, str)` en los tres sitios. Es mas
estricto que capturar la excepcion porque ademas convierte en 400 los casos que
antes ni siquiera fallaban (por ejemplo `{"token": null}`).

Los endpoints que ya recibian el token de un **serializer** (no de `request.data`)
no tienen el problema, porque ahi el tipo ya viene validado. `VerificarConfirmacion`
lo toma de `query_params`, que siempre devuelve cadenas.

Dos tests nuevos, uno por endpoint, con `subTest` para los cuatro cuerpos mal
formados: `{"token": {"a": 1}}`, `{"token": ["x"]}`, `{"token": 12345}` y
`{"token": null}`.

---

### 4.20 Abrir el enlace de verificacion confirmaba el correo sin pulsar nada [ARREGLADO, sin commitear]

**No venia en el informe original.** Lo encontre al unificar el flujo de
verificacion con el de recuperacion de contrasena.

`VerificarEmail.jsx` hacia el POST en un `useEffect` al montar el componente. Es
decir, el enlace del correo ya verificaba solo: abrirlo bastaba.

Eso no es solo una molestia de UX. Los clientes de correo y sus sistemas
antiphishing (**Outlook Safe Links**, Proofpoint, la barra del antivirus del
navegador, algunos proxies corporativos) siguen los enlaces en segundo plano para
analizarlos. Con la verificacion automatica al montar, uno de esos rastreos
consumia el token de un solo uso sin que el usuario hubiera pulsado nada, y el
usuario se encontraba al llegar un token ya invalidado. Es un fallo de
usabilidad que se manifiesta como "el enlace no funciona", sin causa aparente.

El arreglo mete un paso intermedio explicito, igual que el de recuperacion de
contrasena: el enlace abre una pantalla **"¿Eres Tu?"** con un boton, y la
peticion solo sale al pulsarlo. Verificado sobre el flujo real:

| Paso | Resultado |
|---|---|
| Abrir `/verificar-email?token=...` sin pulsar nada | `is_verified` sigue en `0` |
| Pulsar "Si, soy yo" | `200`, `is_verified=true` |
| Reusar el mismo token | `400` token invalido (un solo uso) |
| `POST /api/partidas/` despues | `201` |

El correo cambio de "Confirma tu correo" a la plantilla "¿Eres tu?" con boton
**"Si, soy yo"** y enlace "No, cancelar", reutilizando el mismo diseno que el
restablecimiento de contrasena. Sin este cambio en el HTML del correo, el paso
intermedio del frontend no tendria nada que mostrar.

---

### 4.21 El boton de la landing pedia una descarga, no jugar [ARREGLADO, sin commitear]

**No venia en el informe original.** Salio al implementar 4.18, al mirar que
ocurre en la practice cuando un usuario sin verificar pulsa el boton.

Decia **"DESCARGAR AHORA"** con un icono de descarga, y seguia deshabilitado
porque el juego no esta publicado. El problema es que la etiqueta miente sobre la
regla de negocio: lo que el backend protege (4.18) es poder **registrar una
partida**, es decir jugar. Una descarga no tiene nada que ver con esa comprobacion,
asi que el boton no describia lo que el usuario se va a encontrar.

Ahora dice **"JUGAR"** con icono de play, y el titulo de la seccion es "Juega
Salt Born". Sigue deshabilitado, pero por un unico motivo que ya no se confunde
con el del correo: que el juego todavia no existe. En cuanto haya ruta de juego,
este es el sitio donde conectarla.

La decision de dejarlo apagado fue del usuario: sin destino real al que enviar el
enlace, activarlo seria un boton que lleva a un sitio inexistente.

---

## 5. Bajos e información

> **Sin reverificar en bloque al 2026-10-01**, salvo lo indicado. Sigue siendo
> lectura estática, sin reproducir. Los hallazgos de esta sección no se han
> marcado `[ARREGLADO]` por el mero hecho de que el commit exista.

### Código muerto [VERIFICADO por grep — revalidado solo parcialmente]

| Ubicación | Estado |
|---|---|
| `api/models.py:279-288` `ConfirmacionReset.verificar_codigo()` | **Sin ningún llamador.** Y si alguien lo usa: no comprueba `confirmado`, no incrementa `failed_attempts` (eludiendo `MAX_INTENTOS_CODIGO`), compara por igualdad en BD en vez de `compare_digest`. Riesgo de reintroducir un bypass. **Sin reverificar.** |
| `hooks/useFetch.js:36-41` `refetch` | Nadie lo usa ni lo testea. Con `catch` **vacío** (fallo invisible) y un `AbortController` que se crea y se tira. |
| `authService.js:141-143` `getStoredToken()` | Nunca llamado. |
| `AuthContext.jsx:158-173` `checkSession` | Expuesto en el contexto, consumido **solo por tests**. |
| `utils/format.js:5-11` `DIFFICULTY_CONFIG`, `BADGE_MAP` | Cero usos, ni en producción ni en tests. |
| `utils/format.js:1-3` `formatTime` | Usado **solo por su test**. `Admin.jsx:370` reimplementa la lógica idéntica inline. |
| `index.html:15-20` `speculationrules` | **[ARREGLADO — `1579fa7`] Arrays vacíos, no hacían nada, y eran la causa raíz de `unsafe-inline` en la CSP. Borrados.** Ver 3.8. |
| `requirements.txt:75` `django-ipware==7.0.0` | No se importa en ningún sitio; `middleware.py:52-78` implementa su propia resolución de IP. |
| `requirements-dev.txt:18` `safety==3.8.1` | Ya no lo usa el CI. Documentado como no usado. |
| `hooks/useIsMobile.js:12-15` | `matchMedia` en cada llamada (correcto por `Object.is` sobre primitivo, pero ineficiente). |
| `Team.jsx:141` | Variable CSS global sin retirar al desmontar. |
| `ForgotPassword.jsx:56-57` `tokenRef` | Redundante: siempre refleja `urlToken`, que ya es estable. |

**El único cambio de esta tabla es `speculationrules`**, y conviene dejar claro
por qué: se borró porque era la causa raíz de `unsafe-inline` (3.8), no
simplemente porque se tocara la CSP. **El resto de la tabla sigue igual** y
este documento parecería mejor de lo que está si se leyera como si todo se
hubiera limpiado.

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

## 6. Lo que queda

### Abierto y verificado

1. **2.2 — Sin TLS.** Lo único que queda de los 2 críticos y los 9 altos. No se
   arregla con código: es dominio, certificados y configuración de despliegue.
   Requiere tu decisión y tu participación.

### Abierto, con la severidad reevaluada a la baja

2. **4.13 / 4.2 (misma raíz, contar uno) — CSP de Django condicionada a
   `X-Forwarded-Proto`.** Sigue siendo código defectuoso, pero con 3.1 cerrado
   Django ya no es accesible sin nginx, y nginx siempre pone esa cabecera. La
   rama es casi inalcanzable por red. Arreglo pequeño (emitir la CSP siempre) y
   sensato, pero ya no es urgente como lo era.
3. **4.6 — `verifySession` trata una caída de red como sesión expirada.** Un 500
   expulsa al usuario a la landing sin explicación. Impacto de UX, no de
   seguridad. Es el único medio de la lista que verifiqué que sigue abierto tal
   cual se describió.

### Sin reverificar — no planifiques a partir de esto

4. **4.4, 4.8, 4.10, 4.11, 4.12** — el estado de estos cinco no lo he
   comprobado. 4.4 tiene además cambios locales sin commitear en
   `views_users.py`, así que la cadena de código descrita en el hallazgo puede
   no ser la que tienes delante.
5. **4.14 y 4.15** — mejorados, no cerrados. La cobertura por líneas no existe y
   `eslint-plugin-jsx-a11y` sigue sin instalarse, que es lo que habría detectado
   3.9 automáticamente.
6. **§5 completos** — CI y Docker sin revisar desde la redacción original.

### Pendiente de una decisión, no de código

7. **4.17 — commiteear el contador atómico.** El arreglo ya está escrito en tu
   working tree y **no está en el repo**. Es lo único que separa "arreglado" de
   "arreglado de verdad" en toda esta lista.

8. **4.18 — activar el envío de correo real.** El backend ya exige correo
   verificado para jugar (4.18) y el flujo ya pide el clic de "¿Eres tú?" (4.20),
   pero los correos siguen sin salir: `EMAIL_HOST_PASSWORD` está vacío y todo va
   al backend de consola. Es lo único que queda abierto del recorrido. Necesita
   una contraseña de aplicación de Gmail y, en `.env` (más `docker compose up -d
   --build backend`). Junto a eso, `email_utils.enviar_email` debería dejar de
   responder `200` cuando el envío falla.

### No era un problema

9. **4.1 — "consume 2 intentos por error".** Falso. El frontend corta el flujo
   antes del segundo POST, así que un código incorrecto consume un intento. Las
   dos vistas siguen incrementando a propósito, como defensa en profundidad para
   quien llame a `/confirm/` sin pasar por el frontend.

### Lo que deliberadamente NO se hizo

- **No se forzó TLS** ni se puso un certificado de pruebas: es una decisión de
  despliegue con consecuencias (HSTS preload es irreversible en la práctica) y
  no corresponde tomarla en un fichero de configuración.
- **No se tocó `middleware.py:244`** para contar el 200 de `/api/password-reset/`
  (ver 3.3). Arreglarlo habría estado mal.
- **No se amplió el alcance** a los medios sin reverificar, porque marcarlos
  como cerrados en bloque habría destruido la única propiedad que hace útil a
  este documento: distinguir lo comprobado de lo supuesto.

---

## 7. Límites de esta auditoría

### Límites de la redacción original (2026-09-29)

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

### Límites de esta actualización (2026-10-01)

Conviene que sean explícitos, porque el título de este documento ahora dice
muchos más "arreglado" de lo que decía antes:

- **Se reverificó §2 y §3 enteras, y 7 de los 17 medios.** Los otros 10 medios y
  toda la §5 conservan el estado original **sin comprobar**, no "confirmado".
  Uno de los siete (4.1) resultó ser **falso**: estaba en la lista y no
  reproduce.
- **No se reejecutó un escáner.** No hay Trivy, ni Bandit, ni npm audit sobre el
  estado actual. La ausencia de un hallazgo nuevo aquí **no significa que no
  exista**.
- **La evidencia es mi lectura más una comprobación puntual en runtime** para
  2.1, 3.3, 3.7 y 3.8 (peticiones reales contra la app en marcha). El resto se
  resolvió leyendo el código, que es más débil: un test puede estar verde y el
  flujo seguir roto.
- **Los números de cobertura (4.14) son recuentos de ficheros**, no de líneas,
  y los de accesibilidad (4.15) se han reformed con los `aria-label` de 3.9 sin
  volver a contar el conjunto.
- **Hay un desfase entre el disco y el repo** (4.17). Quien lea este documento y
  clone el repo no verá todo lo que aquí se da por arreglado.
- **Las referencias `fichero:línea` se han quedado viejas** en los hallazgos
  arreglados, porque los commits han desplazado las líneas. Donde la línea ya no
  cuadra, lo relevante es el nombre de la función, no el número.
