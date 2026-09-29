// ─── TESTS: api/axios.js (interceptores y cola de refresh) ───────────────
// Estos tests NO usan la red: sustituyen el adapter de la instancia con un
// "servidor falso" que devuelve las respuestas que nos interesen, de modo que
// se ejercita la cadena real de interceptores de axios.
//
// Se reimporta el módulo en cada test (vi.resetModules) porque el estado de
// concurrencia del refresh (promesa en vuelo + refresh suspendido) vive en el
// ámbito del módulo: si se compartiera entre tests, uno podría "envenenar" al
// siguiente y los fallos dependerían del orden de ejecución.

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Rutas del backend usadas por la app. Coinciden con backend/api/urls.py.
const REFRESH_URL = '/token/refresh/'
const PROTEGIDA = '/ranking/'

let axios
let API
let mod
let tokenStore

// ─── Servidor falso ────────────────────────────────────────────────────
// Sustituye API.defaults.adapter por un manejador propio.
// `routes` es un mapa url -> manejador:
//   - función: recibe (config, nº de intentos para esa url) y devuelve
//     { status, data }
//   - objeto: respuesta fija
// Devuelve el array `calls`, con una entrada por petición y en orden.
function serve(routes) {
  const calls = []
  API.defaults.adapter = async (config) => {
    const attempts = calls.filter((c) => c.url === config.url).length
    calls.push({
      url: config.url,
      method: config.method,
      authorization: authHeaderOf(config),
    })
    const route = routes[config.url]
    if (!route) throw new Error(`Petición inesperada a ${config.url}`)
    const result = typeof route === 'function' ? await route(config, attempts) : route
    const response = {
      data: result.data,
      status: result.status,
      statusText: '',
      headers: new axios.AxiosHeaders(),
      config,
      request: {},
    }
    if (result.status >= 200 && result.status < 300) return response
    throw new axios.AxiosError(
      `Request failed with status code ${result.status}`,
      'ERR_BAD_RESPONSE',
      config,
      {},
      response
    )
  }
  return calls
}

// Lee el header Authorization sin asumir que headers sea un AxiosHeaders.
function authHeaderOf(config) {
  const h = config.headers
  if (h && typeof h.get === 'function') return h.get('Authorization')
  return h?.Authorization
}

// Cuerpo que devuelve SimpleJWT cuando el access token caducó o fue revocado.
const TOKEN_EXPIRADO = {
  code: 'token_not_valid',
  messages: [{ token: { code: 'token_not_valid', message: 'Given token not valid for any token type' } }],
  detail: 'Given token not valid for any token type',
}

// Lo que devuelve el refresh cuando la sesión ya no existe (views_auth.py).
const SESION_EXPIRADA = { error: 'Sesión expirada. Inicie sesión nuevamente' }

// Mapa de rutas protegidas que fallan con 401 la primera vez y luego funcionan.
function protegidasCon401(urls) {
  const mapa = {}
  for (const url of urls) {
    mapa[url] = (config, intentos) =>
      intentos === 0 ? { status: 401, data: TOKEN_EXPIRADO } : { status: 200, data: { ok: url } }
  }
  return mapa
}

function cuentaLlamadas(calls, url) {
  return calls.filter((c) => c.url === url).length
}

// ─────────────────────────────────────────────────────────────────────────
describe('api/axios', () => {
  beforeEach(async () => {
    vi.resetModules()
    localStorage.clear()
    axios = (await import('axios')).default
    mod = await import('./axios')
    API = mod.default
    tokenStore = await import('./tokenStore')
    tokenStore.clearAccessToken()
  })

  // ═══════════════════════════════════════════════════════════════════
  // INTERCEPTOR DE PETICIONES
  // ═══════════════════════════════════════════════════════════════════
  describe('interceptor de peticiones', () => {
    it('añade el header Authorization cuando hay token en memoria', () => {
      tokenStore.setAccessToken('abc123')
      const config = { headers: {} }
      expect(mod.attachAuthHeader(config).headers.Authorization).toBe('Bearer abc123')
    })

    it('no toca los headers si no hay token', () => {
      tokenStore.clearAccessToken()
      const config = { headers: {} }
      mod.attachAuthHeader(config)
      expect(config.headers).toEqual({})
    })

    it('guard defensivo: no explota si la petición no trae config', () => {
      // Un interceptor no debería recibir nunca undefined, pero si lo recibe
      // debe devolverlo tal cual en vez de lanzar un TypeError que tape el
      // error de red real.
      expect(() => mod.attachAuthHeader(undefined)).not.toThrow()
      expect(mod.attachAuthHeader(undefined)).toBeUndefined()
    })

    it('guard defensivo: propaga el error original sin enmascararlo', async () => {
      const original = new Error('boom')
      await expect(mod.forwardRequestError(original)).rejects.toBe(original)
    })

    it('el token viaja en la petición real', async () => {
      tokenStore.setAccessToken('abc123')
      const calls = serve({ [PROTEGIDA]: { status: 200, data: { ok: true } } })
      await API.get(PROTEGIDA)
      expect(calls[0].authorization).toBe('Bearer abc123')
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // CLASIFICACIÓN DEL 401: ¿token caducado o credenciales incorrectas?
  // ═══════════════════════════════════════════════════════════════════
  describe('isExpiredTokenError', () => {
    const conBody = (status, data) => ({ response: { status, data } })

    it('reconoce el code token_not_valid de SimpleJWT', () => {
      expect(mod.isExpiredTokenError(conBody(401, TOKEN_EXPIRADO))).toBe(true)
    })

    it('reconoce la forma anidada { detail: { code } }', () => {
      expect(mod.isExpiredTokenError(conBody(401, { detail: { code: 'token_not_valid' } }))).toBe(true)
    })

    it('reconoce el detail en texto cuando no hay code', () => {
      expect(mod.isExpiredTokenError(conBody(401, { detail: 'Given token not valid for any token type' }))).toBe(true)
    })

    it('NO es un token caducado el 401 de credenciales incorrectas', () => {
      // views_auth.py devuelve exactamente esto tanto si el usuario no existe
      // como si la contraseña falla: la UI no puede (ni debe) distinguirlos.
      expect(mod.isExpiredTokenError(conBody(401, { error: 'Credenciales incorrectas' }))).toBe(false)
    })

    it('NO es un token caducado el 403 de cuenta desactivada', () => {
      expect(mod.isExpiredTokenError(conBody(403, { error: 'Cuenta desactivada' }))).toBe(false)
    })

    it('NO es un token caducado el 401 del propio refresh', () => {
      // El refresh responde 401 con { error }, no con el cuerpo de SimpleJWT:
      // por eso se comprueba el cuerpo y no solo el código HTTP.
      expect(mod.isExpiredTokenError(conBody(401, SESION_EXPIRADA))).toBe(false)
    })

    it('devuelve false sin respuesta (error de red)', () => {
      expect(mod.isExpiredTokenError({})).toBe(false)
      expect(mod.isExpiredTokenError(undefined)).toBe(false)
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // GUARD DE error.config (hallazgo 3.5)
  // ═══════════════════════════════════════════════════════════════════
  describe('guard de error.config', () => {
    it('un error de red sin config se propaga intacto, sin TypeError', async () => {
      const networkError = new axios.AxiosError('Network Error', 'ERR_NETWORK')
      API.defaults.adapter = async () => { throw networkError }

      await expect(API.get(PROTEGIDA)).rejects.toBe(networkError)
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // RENOVACIÓN DEL TOKEN
  // ═══════════════════════════════════════════════════════════════════
  describe('renovación del token', () => {
    it('renueva y reintenta la petición original con el token nuevo', async () => {
      tokenStore.setAccessToken('viejo')
      const calls = serve({
        ...protegidasCon401([PROTEGIDA]),
        [REFRESH_URL]: { status: 200, data: { access_token: 'nuevo' } },
      })

      const { data } = await API.get(PROTEGIDA)

      expect(data).toEqual({ ok: PROTEGIDA })
      expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(1)
      // El reintento debe llevar el token NUEVO, no el caducado.
      expect(calls.filter((c) => c.url === PROTEGIDA)[1].authorization).toBe('Bearer nuevo')
      expect(tokenStore.getAccessToken()).toBe('nuevo')
    })

    it('cuatro 401 en paralelo producen UN solo refresh (hallazgo 3.4)', async () => {
      tokenStore.setAccessToken('viejo')
      const rutas = ['/ranking/', '/niveles/', '/partidas/', '/estadisticas/']

      // Gate: el refresh no responde hasta que las 4 peticiones ya fallaron,
      // así se garantiza que las 4 estaban en vuelo a la vez.
      let liberarRefresh
      const puerta = new Promise((resolve) => { liberarRefresh = resolve })

      const calls = serve({
        ...protegidasCon401(rutas),
        [REFRESH_URL]: async () => {
          await puerta
          return { status: 200, data: { access_token: 'nuevo' } }
        },
      })

      const pendientes = Promise.allSettled(rutas.map((url) => API.get(url)))
      for (const url of rutas) {
        await vi.waitFor(() => expect(cuentaLlamadas(calls, url)).toBe(1))
      }
      await vi.waitFor(() => expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(1))
      liberarRefresh()
      const resultados = await pendientes

      // Todas se recuperan...
      expect(resultados.every((r) => r.status === 'fulfilled')).toBe(true)
      // ...con UN único refresh, no uno por petición (el bug del hallazgo 3.4).
      expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(1)
      // Y cada reintento va con el token nuevo.
      for (const url of rutas) {
        expect(calls.filter((c) => c.url === url)[1].authorization).toBe('Bearer nuevo')
      }
    })

    it('el propio refresh NUNCA se reintenta a sí mismo (sin bucle infinito)', async () => {
      const calls = serve({ [REFRESH_URL]: { status: 401, data: SESION_EXPIRADA } })

      await expect(API.post(REFRESH_URL)).rejects.toBeTruthy()
      expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(1)
    })

    it('no intenta refrescar ante un 401 de credenciales', async () => {
      const calls = serve({ '/login/': { status: 401, data: { error: 'Credenciales incorrectas' } } })

      await expect(API.post('/login/', { username: 'x', password: 'y' })).rejects.toBeTruthy()
      expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(0)
      expect(cuentaLlamadas(calls, '/login/')).toBe(1)
    })

    it('no intenta refrescar ante un 403 (cuenta desactivada)', async () => {
      const calls = serve({ [PROTEGIDA]: { status: 403, data: { error: 'Cuenta desactivada' } } })

      await expect(API.get(PROTEGIDA)).rejects.toBeTruthy()
      expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(0)
    })

    it('no reintenta una petición que ya se reintentó una vez', async () => {
      tokenStore.setAccessToken('viejo')
      const calls = serve({
        [PROTEGIDA]: { status: 401, data: TOKEN_EXPIRADO },
        [REFRESH_URL]: { status: 200, data: { access_token: 'nuevo' } },
      })

      await expect(API.get(PROTEGIDA)).rejects.toBeTruthy()
      // 1 llamada original + 1 reintento, y solo 1 refresh.
      expect(cuentaLlamadas(calls, PROTEGIDA)).toBe(2)
      expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(1)
    })

    it('un refresh sin access_token se trata como sesión caída', async () => {
      tokenStore.setAccessToken('viejo')
      localStorage.setItem('usuario:v1', JSON.stringify({ id: 1 }))
      const expirado = vi.fn()
      window.addEventListener('auth:session-expired', expirado)
      serve({
        ...protegidasCon401([PROTEGIDA]),
        [REFRESH_URL]: { status: 200, data: {} },
      })

      await expect(API.get(PROTEGIDA)).rejects.toBeTruthy()
      expect(tokenStore.getAccessToken()).toBeNull()
      expect(localStorage.getItem('usuario:v1')).toBeNull()
      expect(expirado).toHaveBeenCalledOnce()
      window.removeEventListener('auth:session-expired', expirado)
    })
  })

  // ═══════════════════════════════════════════════════════════════════
  // FALLO DEL REFRESH: liberar la cola sin colgarla
  // ═══════════════════════════════════════════════════════════════════
  describe('fallo del refresh', () => {
    it('rechaza TODAS las peticiones encoladas con el error del refresh', async () => {
      tokenStore.setAccessToken('viejo')
      const rutas = ['/ranking/', '/niveles/', '/partidas/']

      let liberarRefresh
      const puerta = new Promise((resolve) => { liberarRefresh = resolve })
      const mapa = {}
      for (const url of rutas) mapa[url] = { status: 401, data: TOKEN_EXPIRADO }
      mapa[REFRESH_URL] = async () => {
        await puerta
        return { status: 401, data: SESION_EXPIRADA }
      }
      const calls = serve(mapa)

      const pendientes = Promise.allSettled(rutas.map((url) => API.get(url)))
      for (const url of rutas) {
        await vi.waitFor(() => expect(cuentaLlamadas(calls, url)).toBe(1))
      }
      await vi.waitFor(() => expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(1))
      liberarRefresh()
      const resultados = await pendientes

      // Ninguna queda colgada: las 3 terminan rechazadas, y las 3 con el
      // MISMO error, el del refresh (no con su propio 401, que dejaría al
      // llamante sin saber que lo que falló fue la sesión entera).
      expect(resultados.every((r) => r.status === 'rejected')).toBe(true)
      for (const r of resultados) {
        expect(r.reason.response.data).toEqual(SESION_EXPIRADA)
        expect(r.reason.response.config.url).toBe(REFRESH_URL)
      }
    })

    it('limpia token, localStorage y avisa a React cuando el refresh falla', async () => {
      tokenStore.setAccessToken('viejo')
      localStorage.setItem('usuario:v1', JSON.stringify({ id: 1 }))
      const expirado = vi.fn()
      window.addEventListener('auth:session-expired', expirado)
      serve({
        ...protegidasCon401([PROTEGIDA]),
        [REFRESH_URL]: { status: 401, data: SESION_EXPIRADA },
      })

      await expect(API.get(PROTEGIDA)).rejects.toBeTruthy()

      expect(tokenStore.getAccessToken()).toBeNull()
      expect(localStorage.getItem('usuario:v1')).toBeNull()
      expect(expirado).toHaveBeenCalledOnce()
      window.removeEventListener('auth:session-expired', expirado)
    })

    it('tras un refresh fallido NO vuelve a intentar refrescar (sin tormenta)', async () => {
      tokenStore.setAccessToken('viejo')
      const calls = serve({
        [PROTEGIDA]: { status: 401, data: TOKEN_EXPIRADO },
        [REFRESH_URL]: { status: 401, data: SESION_EXPIRADA },
      })

      await expect(API.get(PROTEGIDA)).rejects.toBeTruthy()
      expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(1)

      // La sesión está muerta: más 401 no deben generar más refresh.
      await expect(API.get(PROTEGIDA)).rejects.toBeTruthy()
      expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(1)
      expect(cuentaLlamadas(calls, PROTEGIDA)).toBe(2)
    })

    it('un login correcto vuelve a armar la renovación', async () => {
      tokenStore.setAccessToken('viejo')
      const calls = serve({
        // Falla con 401 las DOS primeras veces: una antes del login (donde el
        // refresh morirá) y otra después (donde ya debe poder renovarse).
        [PROTEGIDA]: (config, intentos) =>
          intentos < 2 ? { status: 401, data: TOKEN_EXPIRADO } : { status: 200, data: { ok: PROTEGIDA } },
        // El primer refresh muere (sesión caída); el segundo, tras el login,
        // funciona porque el backend ya emitió una cookie refresh_token nueva.
        [REFRESH_URL]: (config, intentos) =>
          intentos === 0
            ? { status: 401, data: SESION_EXPIRADA }
            : { status: 200, data: { access_token: 'nuevo' } },
        '/login/': { status: 200, data: { usuario: { id: 1 }, access_token: 'nuevo' } },
      })

      await expect(API.get(PROTEGIDA)).rejects.toBeTruthy()
      expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(1)

      // El usuario inicia sesión otra vez: la cookie de refresco es nueva.
      await API.post('/login/', { username: 'juan', password: 'x' })

      const { data } = await API.get(PROTEGIDA)
      expect(data).toEqual({ ok: PROTEGIDA })
      expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(2)
    })

    it('un logout no dispara refresh aunque el token ya haya caducado', async () => {
      tokenStore.setAccessToken('viejo')
      const calls = serve({
        '/logout/': { status: 401, data: TOKEN_EXPIRADO },
        [REFRESH_URL]: { status: 200, data: { access_token: 'nuevo' } },
      })

      await expect(API.post('/logout/')).rejects.toBeTruthy()
      expect(cuentaLlamadas(calls, REFRESH_URL)).toBe(0)
      expect(cuentaLlamadas(calls, '/logout/')).toBe(1)
    })
  })
})
