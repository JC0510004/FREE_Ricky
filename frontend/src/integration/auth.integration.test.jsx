// Prueba de integración de la autenticación, con un servidor simulado (MSW).
//
// A diferencia de las demás pruebas, aquí NO se mockea código propio:
// se ejecuta de verdad AuthProvider -> authService -> axios (con sus
// interceptores) -> tokenStore. Lo único falso es el backend.
import { useContext } from 'react'
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import API from '../api/axios'
import { getAccessToken, setAccessToken, clearAccessToken } from '../api/tokenStore'
import { AuthProvider } from '../contexts/AuthContext'
import { AuthContext } from '../contexts/auth-context'

// MSW necesita los streams web de Node. Algunos entornos jsdom no los exponen
// en el global; vi.hoisted corre ANTES de los imports, así que los restituimos
// aquí para que `import 'msw'` no falle con "WritableStream is not defined".
await vi.hoisted(async () => {
  const web = await import('node:stream/web')
  for (const nombre of ['ReadableStream', 'WritableStream', 'TransformStream']) {
    if (typeof globalThis[nombre] === 'undefined') globalThis[nombre] = web[nombre]
  }
})

// ─── Datos y servidor simulado ────────────────────────────────────────
const USER_KEY = 'usuario:v1'
const ana = { id: 1, username: 'ana', email: 'ana@correo.com', rol: 'jugador' }
const anaAdmin = { ...ana, rol: 'admin' }

// El comodín delante hace que funcione con o sin VITE_API_URL.
const url = (ruta) => `*/api${ruta}`

const loginOk = http.post(url('/login/'), async ({ request }) => {
  const { password } = await request.json()
  if (password === 'Clave123!') {
    return HttpResponse.json({ usuario: ana, access_token: 'tok-1' })
  }
  return HttpResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
})

// Un recurso protegido: solo acepta el token nuevo (tok-2).
const partidasConTokenNuevo = http.get(url('/partidas/'), ({ request }) => {
  if (request.headers.get('Authorization') === 'Bearer tok-2') {
    return HttpResponse.json({ ok: true })
  }
  return HttpResponse.json({ code: 'token_not_valid', detail: 'Token inválido' }, { status: 401 })
})

const refreshOk = http.post(url('/token/refresh/'), () =>
  HttpResponse.json({ access_token: 'tok-2' }))
const refreshMuerto = http.post(url('/token/refresh/'), () =>
  HttpResponse.json({ error: 'No hay sesión' }, { status: 401 }))

const server = setupServer(loginOk, refreshOk)

// Registro de las peticiones que de verdad salieron, para contarlas.
let llamadas = []

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(async () => {
  llamadas = []
  server.events.on('request:start', ({ request }) => {
    llamadas.push(`${request.method} ${new URL(request.url).pathname.replace('/api', '')}`)
  })
  // El módulo de axios guarda estado entre pruebas (renovación suspendida
  // tras un refresh fallido). Un login correcto lo rearma, igual que en la app.
  server.use(loginOk, refreshOk)
  await API.post('/login/', { password: 'Clave123!' })
  server.resetHandlers()
  localStorage.clear()
  clearAccessToken()
  llamadas = []
})

afterEach(() => {
  cleanup()
  server.events.removeAllListeners()
  server.resetHandlers()
})

// ─── Sonda: muestra el estado del contexto y expone sus funciones ─────
let ctx
function Sonda() {
  ctx = useContext(AuthContext)
  const estado = ctx.isLoading
    ? 'cargando'
    : ctx.isAuthenticated ? `dentro:${ctx.user.username}:${ctx.user.rol}` : 'fuera'
  return (
    <div>
      <span data-testid="estado">{estado}</span>
      <span data-testid="token">{ctx.tokenReady ? 'listo' : 'no'}</span>
    </div>
  )
}

const estado = () => screen.getByTestId('estado').textContent
const montar = () => render(<AuthProvider><Sonda /></AuthProvider>)
const esperarCarga = () => waitFor(() => expect(estado()).not.toBe('cargando'))

// Ejecuta una acción del contexto y devuelve su resultado o su error.
async function ejecutar(accion) {
  let salida
  await act(async () => {
    try { salida = await accion() } catch (e) { salida = { fallo: e } }
  })
  return salida
}

// ─── Arranque de la app ───────────────────────────────────────────────
describe('Auth integración - arranque', () => {
  it('sin usuario guardado queda fuera y no pide nada al servidor', async () => {
    montar()
    await esperarCarga()
    expect(estado()).toBe('fuera')
    expect(llamadas).toEqual([])
  })

  it('al recargar con usuario guardado renueva con la cookie y trae el usuario fresco', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify(ana))
    server.use(
      refreshOk,
      http.get(url('/verify/'), () => HttpResponse.json({ usuario: anaAdmin })),
    )
    montar()
    await waitFor(() => expect(estado()).toBe('dentro:ana:admin'))
    expect(screen.getByTestId('token').textContent).toBe('listo')
    expect(getAccessToken()).toBe('tok-2')
    // el rol fresco del backend queda guardado, no el viejo
    expect(JSON.parse(localStorage.getItem(USER_KEY)).rol).toBe('admin')
    expect(llamadas).toEqual(['POST /token/refresh/', 'GET /verify/'])
  })

  it('al recargar con la sesión muerta (refresh rechazado) queda fuera y olvida al usuario', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify(ana))
    server.use(refreshMuerto)
    montar()
    await esperarCarga()
    expect(estado()).toBe('fuera')
    expect(localStorage.getItem(USER_KEY)).toBeNull()
    expect(getAccessToken()).toBeNull()
  })
})

// ─── Login ────────────────────────────────────────────────────────────
describe('Auth integración - login', () => {
  it('login correcto: guarda usuario y token, y las siguientes peticiones llevan el token', async () => {
    let cabecera = null
    server.use(http.get(url('/niveles/'), ({ request }) => {
      cabecera = request.headers.get('Authorization')
      return HttpResponse.json({ results: [] })
    }))
    montar()
    await esperarCarga()

    await ejecutar(() => ctx.login('ana', 'Clave123!'))

    await waitFor(() => expect(estado()).toBe('dentro:ana:jugador'))
    expect(screen.getByTestId('token').textContent).toBe('listo')
    expect(JSON.parse(localStorage.getItem(USER_KEY))).toEqual(ana)
    expect(getAccessToken()).toBe('tok-1')

    await API.get('/niveles/')
    expect(cabecera).toBe('Bearer tok-1')
  })

  it('login con contraseña mala: error del servidor, sin sesión y SIN intentar renovar', async () => {
    montar()
    await esperarCarga()

    const res = await ejecutar(() => ctx.login('ana', 'mala'))

    expect(res.fallo.response.status).toBe(401)
    expect(res.fallo.response.data.error).toBe('Credenciales incorrectas')
    expect(estado()).toBe('fuera')
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem(USER_KEY)).toBeNull()
    expect(llamadas).toEqual(['POST /login/'])
  })
})

// ─── Token vencido y renovación ───────────────────────────────────────
describe('Auth integración - token vencido', () => {
  beforeEach(() => { setAccessToken('tok-viejo') })

  it('renueva el token y repite la petición sin que el usuario lo note', async () => {
    server.use(partidasConTokenNuevo, refreshOk)

    const res = await API.get('/partidas/')

    expect(res.data).toEqual({ ok: true })
    expect(getAccessToken()).toBe('tok-2')
    expect(llamadas).toEqual(['GET /partidas/', 'POST /token/refresh/', 'GET /partidas/'])
  })

  it('cuatro peticiones a la vez comparten UNA sola renovación', async () => {
    server.use(partidasConTokenNuevo, refreshOk)

    const respuestas = await Promise.all([
      API.get('/partidas/'), API.get('/partidas/'),
      API.get('/partidas/'), API.get('/partidas/'),
    ])

    expect(respuestas.every((r) => r.data.ok)).toBe(true)
    expect(llamadas.filter((l) => l === 'POST /token/refresh/')).toHaveLength(1)
  })

  it('si la renovación falla: cierra la sesión en React, limpia todo y no insiste', async () => {
    localStorage.setItem(USER_KEY, JSON.stringify(ana))
    server.use(
      http.get(url('/verify/'), () => HttpResponse.json({ usuario: ana })),
      refreshOk,
    )
    montar()
    await waitFor(() => expect(estado()).toBe('dentro:ana:jugador'))
    llamadas = []

    // ahora el servidor ya no reconoce la sesión
    server.use(partidasConTokenNuevo, refreshMuerto)

    await act(async () => {
        await expect(API.get('/partidas/')).rejects.toBeTruthy()
    })
    await waitFor(() => expect(estado()).toBe('fuera'))
    expect(screen.getByTestId('token').textContent).toBe('no')
    expect(localStorage.getItem(USER_KEY)).toBeNull()
    expect(getAccessToken()).toBeNull()

    // la renovación queda suspendida: un nuevo 401 no vuelve a llamar a refresh
    await expect(API.get('/partidas/')).rejects.toBeTruthy()
    expect(llamadas.filter((l) => l === 'POST /token/refresh/')).toHaveLength(1)
  })
})

// ─── Logout ───────────────────────────────────────────────────────────
describe('Auth integración - logout', () => {
  async function entrar() {
    montar()
    await esperarCarga()
    await ejecutar(() => ctx.login('ana', 'Clave123!'))
    await waitFor(() => expect(estado()).toBe('dentro:ana:jugador'))
    llamadas = []
  }

  it('avisa al servidor y limpia usuario, token y estado', async () => {
    server.use(http.post(url('/logout/'), () => HttpResponse.json({ mensaje: 'ok' })))
    await entrar()

    await ejecutar(() => ctx.logout())

    expect(llamadas).toEqual(['POST /logout/'])
    expect(estado()).toBe('fuera')
    expect(screen.getByTestId('token').textContent).toBe('no')
    expect(localStorage.getItem(USER_KEY)).toBeNull()
    expect(getAccessToken()).toBeNull()
  })

  it('si el servidor falla, la sesión local se cierra igual', async () => {
    server.use(http.post(url('/logout/'), () => HttpResponse.error()))
    await entrar()

    const res = await ejecutar(() => ctx.logout())

    expect(res).toBeUndefined() // no propaga el error
    expect(estado()).toBe('fuera')
    expect(localStorage.getItem(USER_KEY)).toBeNull()
    expect(getAccessToken()).toBeNull()
  })
})

// ─── checkSession ─────────────────────────────────────────────────────
describe('Auth integración - checkSession', () => {
  async function entrar() {
    montar()
    await esperarCarga()
    await ejecutar(() => ctx.login('ana', 'Clave123!'))
    await waitFor(() => expect(estado()).toBe('dentro:ana:jugador'))
  }

  it('con sesión válida devuelve true y actualiza el usuario', async () => {
    await entrar()
    server.use(http.get(url('/verify/'), () => HttpResponse.json({ usuario: anaAdmin })))

    const ok = await ejecutar(() => ctx.checkSession())

    expect(ok).toBe(true)
    await waitFor(() => expect(estado()).toBe('dentro:ana:admin'))
    expect(JSON.parse(localStorage.getItem(USER_KEY)).rol).toBe('admin')
  })

  it('con sesión válida pero sin usuario en la respuesta, devuelve true y no toca al usuario', async () => {
    await entrar()
    server.use(http.get(url('/verify/'), () => HttpResponse.json({})))

    const ok = await ejecutar(() => ctx.checkSession())

    expect(ok).toBe(true)
    expect(estado()).toBe('dentro:ana:jugador')
  })

  it('con sesión caída devuelve false y deja la app fuera', async () => {
    await entrar()
    server.use(
      http.get(url('/verify/'), () =>
        HttpResponse.json({ code: 'token_not_valid' }, { status: 401 })),
      refreshMuerto,
    )

    const ok = await ejecutar(() => ctx.checkSession())

    expect(ok).toBe(false)
    await waitFor(() => expect(estado()).toBe('fuera'))
    expect(screen.getByTestId('token').textContent).toBe('no')
  })
})

// ─── loginWithResponse y register ─────────────────────────────────────
describe('Auth integración - sesión desde una respuesta y registro', () => {
  it('loginWithResponse con usuario y token abre la sesión sin pedir nada al servidor', async () => {
    montar()
    await esperarCarga()

    const payload = await ejecutar(() =>
      ctx.loginWithResponse({ usuario: ana, access_token: 'tok-9' }))

    expect(payload.access_token).toBe('tok-9')
    await waitFor(() => expect(estado()).toBe('dentro:ana:jugador'))
    expect(getAccessToken()).toBe('tok-9')
    expect(JSON.parse(localStorage.getItem(USER_KEY))).toEqual(ana)
    expect(llamadas).toEqual([])
  })

  it('loginWithResponse sin token no abre sesión', async () => {
    montar()
    await esperarCarga()

    const payload = await ejecutar(() => ctx.loginWithResponse({ usuario: ana }))

    expect(payload).toBeNull()
    expect(estado()).toBe('fuera')
    expect(getAccessToken()).toBeNull()
  })

  it('registro con auto-login deja la sesión abierta', async () => {
    server.use(http.post(url('/register/'), () =>
      HttpResponse.json({ usuario: ana, access_token: 'tok-r' }, { status: 201 })))
    montar()
    await esperarCarga()

    await ejecutar(() => ctx.register({ username: 'ana' }))

    await waitFor(() => expect(estado()).toBe('dentro:ana:jugador'))
    expect(getAccessToken()).toBe('tok-r')
  })

  it('registro de una cuenta reactivada (sin token) NO abre sesión', async () => {
    server.use(http.post(url('/register/'), () =>
      HttpResponse.json({ mensaje: 'Confirma tu correo' }, { status: 201 })))
    montar()
    await esperarCarga()

    const res = await ejecutar(() => ctx.register({ username: 'ana' }))

    expect(res.mensaje).toBe('Confirma tu correo')
    expect(estado()).toBe('fuera')
    expect(getAccessToken()).toBeNull()
    expect(localStorage.getItem(USER_KEY)).toBeNull()
  })
})