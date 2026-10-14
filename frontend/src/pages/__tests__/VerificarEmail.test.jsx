// ─── TESTS: pages/VerificarEmail.jsx ──────────────────────────────────
// Se simulan la API (axios), useAuth (loginWithResponse) y useNavigate.
// La URL con ?token=... se controla con MemoryRouter.

import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const { post, loginWithResponse, navegar } = vi.hoisted(() => ({
  post: vi.fn(),
  loginWithResponse: vi.fn(),
  navegar: vi.fn(),
}))

vi.mock('../../api/axios', () => ({ default: { post } }))

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ loginWithResponse }),
}))

vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navegar,
}))

import VerificarEmail from '../VerificarEmail'

// ─── Ayudas ───────────────────────────────────────────────────────────
const RUTA_CON_TOKEN = '/verificar-email?token=abc123'
const RUTA_SIN_TOKEN = '/verificar-email'

function renderPagina(ruta = RUTA_CON_TOKEN, { estricto = false } = {}) {
  const pagina = (
    <MemoryRouter initialEntries={[ruta]}>
      <VerificarEmail />
    </MemoryRouter>
  )
  return render(estricto ? <StrictMode>{pagina}</StrictMode> : pagina)
}

// Responde según la URL: una función para verificar y otra para reenviar.
function simular({ verificar, reenviar } = {}) {
  post.mockImplementation((url) => {
    if (url === '/verificar-email/') {
      return verificar ? verificar() : new Promise(() => {})
    }
    if (url === '/verificar-email/reenviar/') {
      return reenviar ? reenviar() : Promise.resolve({ data: {} })
    }
    return Promise.reject(new Error(`URL inesperada: ${url}`))
  })
}

const falla = (status, data) => () => Promise.reject({ response: { status, data } })

const botonReenviar = () =>
  screen.getByRole('button', { name: 'Reenviar correo de verificación' })
const campoCorreo = () => screen.queryByLabelText('Tu correo electrónico')

beforeEach(() => {
  post.mockReset()
  loginWithResponse.mockReset()
  loginWithResponse.mockReturnValue(true)
  navegar.mockReset()
})

// ══════════════════════════════════════════════════════════════════════
describe('VerificarEmail - verificación automática', () => {
  it('mientras espera muestra "Verificando Correo"', () => {
    simular() // la petición nunca termina
    renderPagina()
    expect(screen.getByRole('heading', { name: 'Verificando Correo' })).toBeTruthy()
  })

  it('al abrir el enlace envía el token a la API', async () => {
    simular()
    renderPagina()
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
      expect(post).toHaveBeenCalledWith('/verificar-email/', { token: 'abc123' })
  })

  it('con sesión abierta: confirma, avisa y el botón vuelve al inicio', async () => {
    simular({ verificar: () => Promise.resolve({ data: { access_token: 't' } }) })
    renderPagina()

    expect(await screen.findByRole('heading', { name: 'Correo Verificado' })).toBeTruthy()
    expect(loginWithResponse).toHaveBeenCalledWith({ access_token: 't' })
    expect(screen.getByText(/tu sesión está abierta/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Ir al inicio' }))
    expect(navegar).toHaveBeenCalledWith('/')
  })

  it('sin sesión (no hubo auto-login): el botón también vuelve al inicio', async () => {
    loginWithResponse.mockReturnValue(null)
    simular({ verificar: () => Promise.resolve({ data: {} }) })
    renderPagina()

    expect(await screen.findByRole('heading', { name: 'Correo Verificado' })).toBeTruthy()
    expect(screen.getByText(/Ya puedes jugar/i)).toBeTruthy()
    expect(screen.queryByText(/tu sesión está abierta/i)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Ir al inicio' }))
    expect(navegar).toHaveBeenCalledWith('/')
  })

  it('siempre ofrece volver al inicio de sesión', () => {
    simular()
    renderPagina()
    expect(
      screen.getByRole('link', { name: 'Volver al inicio de sesión' }).getAttribute('href')
    ).toBe('/login')
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('VerificarEmail - enlace sin token', () => {
  it('muestra el error directamente y no llama a la API', () => {
    renderPagina(RUTA_SIN_TOKEN)
    expect(screen.getByRole('heading', { name: 'No se Pudo Verificar' })).toBeTruthy()
    expect(screen.getByText('El enlace no tiene un token válido.')).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('pide el correo a mano para poder reenviar', () => {
    renderPagina(RUTA_SIN_TOKEN)
    expect(campoCorreo()).not.toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('VerificarEmail - token inválido o expirado', () => {
  it('muestra el mensaje genérico cuando no hay detalle', async () => {
    simular({ verificar: () => Promise.reject(new Error('fallo')) })
    renderPagina()

    expect(await screen.findByRole('heading', { name: 'No se Pudo Verificar' })).toBeTruthy()
    expect(
      screen.getByText('El enlace es inválido o ha expirado. Puedes solicitarlo de nuevo.')
    ).toBeTruthy()
  })

  it('muestra el motivo real del servidor (campo "error")', async () => {
    simular({ verificar: falla(429, { error: 'Demasiadas solicitudes, espera un minuto' }) })
    renderPagina()
    expect(await screen.findByText('Demasiadas solicitudes, espera un minuto')).toBeTruthy()
  })

  it('o el campo "detail" si no hay "error"', async () => {
    simular({ verificar: falla(400, { detail: 'Token ya usado' }) })
    renderPagina()
    expect(await screen.findByText('Token ya usado')).toBeTruthy()
  })

  it('con token en la URL no pide el correo todavía', async () => {
    simular({ verificar: falla(400, {}) })
    renderPagina()
    await screen.findByRole('heading', { name: 'No se Pudo Verificar' })
    expect(campoCorreo()).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('VerificarEmail - cancelación y una sola verificación', () => {
    it('si se desmonta antes de la respuesta, la verificación igual se completa', async () => {
    let resolver
    simular({ verificar: () => new Promise((r) => { resolver = r }) })
    const { unmount } = renderPagina()
    await waitFor(() => expect(post).toHaveBeenCalled())

    unmount()
    await act(async () => {
      resolver({ data: { access_token: 't' } })
    })
    expect(loginWithResponse).toHaveBeenCalledWith({ access_token: 't' })
  })

  it('si cambia loginWithResponse (nuevo render) no vuelve a llamar a la API', async () => {
    simular({ verificar: () => Promise.resolve({ data: {} }) })
    const { rerender } = renderPagina()
    await screen.findByRole('heading', { name: 'Correo Verificado' })

    rerender(
      <MemoryRouter initialEntries={[RUTA_CON_TOKEN]}>
        <VerificarEmail />
      </MemoryRouter>
    )
    expect(post).toHaveBeenCalledTimes(1)
  })

  // Con StrictMode (desarrollo) React ejecuta el efecto dos veces. El token es
  // de un solo uso, así que debe llamarse a la API una sola vez Y la página
  // debe llegar a un resultado. Si este test falla, es un bug real en desarrollo.
  it('con StrictMode llama una sola vez y llega a "Correo Verificado"', async () => {
    simular({ verificar: () => Promise.resolve({ data: { access_token: 't' } }) })
    renderPagina(RUTA_CON_TOKEN, { estricto: true })

    expect(await screen.findByRole('heading', { name: 'Correo Verificado' })).toBeTruthy()
    expect(post).toHaveBeenCalledTimes(1)
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('VerificarEmail - reenviar con token en la URL', () => {
  async function abrirConErrorDeVerificacion(extra = {}) {
    simular({ verificar: falla(400, {}), ...extra })
    renderPagina()
    await screen.findByRole('heading', { name: 'No se Pudo Verificar' })
  }

  it('reenvía usando solo el token y confirma al usuario', async () => {
    await abrirConErrorDeVerificacion()
    fireEvent.click(botonReenviar())

    expect(
      await screen.findByText('Correo reenviado. Revisa tu bandeja de entrada.')
    ).toBeTruthy()
    expect(post).toHaveBeenLastCalledWith('/verificar-email/reenviar/', { token: 'abc123' })
    expect(screen.queryByRole('button', { name: 'Reenviar correo de verificación' })).toBeNull()
  })

  it('si el servidor responde 400, pide el correo a mano', async () => {
    await abrirConErrorDeVerificacion({ reenviar: falla(400, {}) })
    fireEvent.click(botonReenviar())

    expect(await screen.findByText('Indica tu correo para reenviar el enlace')).toBeTruthy()
    expect(campoCorreo()).not.toBeNull()
  })

  it('con el correo escrito reintenta enviando token y correo', async () => {
    let intento = 0
    await abrirConErrorDeVerificacion({
      reenviar: () => (++intento === 1 ? falla(400, {})() : Promise.resolve({ data: {} })),
    })

    fireEvent.click(botonReenviar())
    await screen.findByText('Indica tu correo para reenviar el enlace')

    fireEvent.change(campoCorreo(), { target: { value: 'juan@correo.com' } })
    fireEvent.click(botonReenviar())

    expect(
      await screen.findByText('Correo reenviado. Revisa tu bandeja de entrada.')
    ).toBeTruthy()
    expect(post).toHaveBeenLastCalledWith('/verificar-email/reenviar/', {
      token: 'abc123',
      email: 'juan@correo.com',
    })
  })

  it('un error del servidor muestra su mensaje', async () => {
    await abrirConErrorDeVerificacion({ reenviar: falla(429, { error: 'Límite alcanzado' }) })
    fireEvent.click(botonReenviar())
    expect(await screen.findByText('Límite alcanzado')).toBeTruthy()
  })

  it('un fallo sin detalle muestra el mensaje por defecto y libera el botón', async () => {
    await abrirConErrorDeVerificacion({ reenviar: () => Promise.reject(new Error('red')) })
    fireEvent.click(botonReenviar())

    expect(
      await screen.findByText('No se pudo reenviar el correo. Intenta más tarde.')
    ).toBeTruthy()
    expect(botonReenviar().disabled).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════
describe('VerificarEmail - reenviar sin token', () => {
  const escribirCorreo = (valor) =>
    fireEvent.change(campoCorreo(), { target: { value: valor } })

  it('sin escribir correo no llama a la API y avisa', () => {
    renderPagina(RUTA_SIN_TOKEN)
    fireEvent.click(botonReenviar())

    expect(screen.getByText('Indica tu correo para reenviar el enlace')).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('un correo sin "@" tampoco se envía', () => {
    renderPagina(RUTA_SIN_TOKEN)
    escribirCorreo('esto-no-es-un-correo')
    fireEvent.click(botonReenviar())

    expect(screen.getByText('Indica tu correo para reenviar el enlace')).toBeTruthy()
    expect(post).not.toHaveBeenCalled()
  })

  it('con un correo válido envía solo el correo (sin token) recortado', async () => {
    simular()
    renderPagina(RUTA_SIN_TOKEN)
    escribirCorreo('  juan@correo.com  ')
    fireEvent.click(botonReenviar())

    expect(
      await screen.findByText('Correo reenviado. Revisa tu bandeja de entrada.')
    ).toBeTruthy()
    expect(post).toHaveBeenCalledWith('/verificar-email/reenviar/', {
      email: 'juan@correo.com',
    })
    expect(post.mock.calls[0][1]).not.toHaveProperty('token')
  })

  it('mientras reenvía bloquea el botón y el campo', async () => {
    let resolver
    simular({ reenviar: () => new Promise((r) => { resolver = r }) })
    renderPagina(RUTA_SIN_TOKEN)
    escribirCorreo('juan@correo.com')
    fireEvent.click(botonReenviar())

    const boton = await screen.findByRole('button', { name: 'Reenviando...' })
    expect(boton.disabled).toBe(true)
    expect(campoCorreo().disabled).toBe(true)

    await act(async () => {
      resolver({ data: {} })
    })
    expect(screen.getByText('Correo reenviado. Revisa tu bandeja de entrada.')).toBeTruthy()
  })
})