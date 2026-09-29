// ─── TESTS: Settings ────────────────────────────────────────────────────
// Cubren el hallazgo 3.6 de AUDITORIA.md: el formulario de perfil se
// renderizaba VACÍO porque `prevProfileId` se inicializaba con el id actual,
// así que el bloque de precarga nunca se ejecutaba en el primer render.
//
// Contrato que se verifica aquí:
//   a) el formulario se precarga con los datos reales del perfil,
//   b) al guardar se envían los datos reales (no vacíos),
//   c) nunca se puede guardar el perfil en vacío.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

// vi.hoisted garantiza que los dobles existen antes de que los módulos
// mockeados losquetsen: sin esto, el factory se ejecutaría en TDZ.
const { apiGet, apiPut, apiPost, updateUser, logout, auth } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  apiPost: vi.fn(),
  updateUser: vi.fn(),
  logout: vi.fn(),
  auth: { current: null },
}))

vi.mock('../../api/axios', () => ({
  default: {
    get: (...args) => apiGet(...args),
    put: (...args) => apiPut(...args),
    post: (...args) => apiPost(...args),
  },
}))

vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({
    user: auth.current,
    isAuthenticated: !!auth.current,
    isLoading: false,
    tokenReady: true,
    updateUser: (...args) => updateUser(...args),
    logout: (...args) => logout(...args),
  }),
}))

import Settings from '../Settings'

// Perfil que devuelve GET /usuarios/7/ (UsuarioSerializer del backend).
const PERFIL = {
  id: 7,
  username: 'ricky',
  email: 'ricky@example.com',
  rol: 'jugador',
  fecha_registro: '2025-01-15T10:00:00Z',
  is_active: true,
  is_verified: true,
  last_login: '2025-06-01T12:30:00Z',
}

function renderSettings() {
  return render(
    <MemoryRouter>
      <Settings />
    </MemoryRouter>
  )
}

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.current = { id: 7, username: 'ricky', email: 'ricky@example.com', rol: 'jugador' }
    apiGet.mockResolvedValue({ data: PERFIL })
    apiPut.mockResolvedValue({ data: { mensaje: 'Actualizado', usuario: PERFIL } })
    apiPost.mockResolvedValue({ data: { mensaje: 'ok' } })
  })

  // ─── (a) PRECARGA ────────────────────────────────────────────────────
  it('precarga el formulario con los datos reales del perfil', async () => {
    renderSettings()

    expect(await screen.findByDisplayValue('ricky')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ricky@example.com')).toBeInTheDocument()
    // El perfil se pide al endpoint de detalle, no solo al contexto.
    expect(apiGet).toHaveBeenCalledWith('/usuarios/7/', { signal: expect.anything() })
  })

  it('precarga aunque el contexto llegue sin los datos del perfil', async () => {
    // El contexto puede venir de localStorage y estar incompleto o
    // desactualizado. La fuente de verdad es GET /usuarios/<id>/.
    auth.current = { id: 7, rol: 'jugador' }
    renderSettings()

    expect(await screen.findByDisplayValue('ricky')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ricky@example.com')).toBeInTheDocument()
  })

  it('muestra estado de carga en vez de un formulario vacío si el usuario aún no ha cargado', () => {
    auth.current = null
    renderSettings()

    expect(screen.getByRole('status')).toHaveTextContent(/cargando/i)
    expect(screen.queryByRole('textbox', { name: /nombre de usuario/i })).not.toBeInTheDocument()
    expect(apiGet).not.toHaveBeenCalled()
  })

  it('no pisa lo que el usuario está escribiendo cuando llega la respuesta del backend', async () => {
    const user = userEvent.setup()
    let resolver
    // El GET del perfil se queda en vuelo: el usuario escribe antes de que llegue.
    apiGet.mockReturnValue(new Promise((r) => { resolver = r }))
    renderSettings()

    // La precarga desde el contexto es inmediata, no espera al backend.
    const input = screen.getByDisplayValue('ricky')
    await user.clear(input)
    await user.type(input, 'ricky_atrevido')

    // Llega la respuesta autoritativa: no debe pisar la edición en curso.
    await act(async () => { resolver({ data: { ...PERFIL, username: 'ricky', email: 'ricky@example.com' } }) })

    expect(screen.getByDisplayValue('ricky_atrevido')).toBeInTheDocument()
  })

  // ─── (b) GUARDADO CON DATOS REALES ───────────────────────────────────
  it('guarda los datos reales del perfil y sincroniza el contexto', async () => {
    const user = userEvent.setup()
    apiPut.mockResolvedValue({
      data: { mensaje: 'Actualizado', usuario: { ...PERFIL, username: 'ricky_atrevido' } },
    })
    renderSettings()

    const input = await screen.findByDisplayValue('ricky')
    await user.clear(input)
    await user.type(input, 'ricky_atrevido')
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith('/usuarios/7/', {
        username: 'ricky_atrevido',
        email: 'ricky@example.com',
      })
    )
    expect(await screen.findByText('Perfil actualizado correctamente')).toBeInTheDocument()
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ username: 'ricky_atrevido' }))
  })

  it('muestra el error del backend si el guardado falla', async () => {
    const user = userEvent.setup()
    apiPut.mockRejectedValue({ response: { data: { username: ['Este nombre de usuario no está disponible'] } } })
    renderSettings()

    const input = await screen.findByDisplayValue('ricky')
    await user.clear(input)
    await user.type(input, 'ricky_atrevido')
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Este nombre de usuario no está disponible')
  })

  // ─── (c) NO SE PUEDE GUARDAR VACÍO ───────────────────────────────────
  it('no envía nada si el nombre de usuario queda vacío', async () => {
    const user = userEvent.setup()
    renderSettings()

    const input = await screen.findByDisplayValue('ricky')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Completa el nombre de usuario y el correo')
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('no envía nada si el correo queda vacío', async () => {
    const user = userEvent.setup()
    renderSettings()

    const input = await screen.findByDisplayValue('ricky@example.com')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Completa el nombre de usuario y el correo')
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('no borra el perfil aunque se pulse guardar con solo espacios', async () => {
    const user = userEvent.setup()
    renderSettings()

    const input = await screen.findByDisplayValue('ricky')
    await user.clear(input)
    await user.type(input, '   ')
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Completa el nombre de usuario y el correo')
    expect(apiPut).not.toHaveBeenCalled()
  })

  it('marca como inválidos los campos vacíos tras un intento fallido', async () => {
    const user = userEvent.setup()
    renderSettings()

    const input = await screen.findByDisplayValue('ricky')
    await user.clear(input)
    await user.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getByDisplayValue('ricky@example.com')).toHaveAttribute('aria-invalid', 'true')
  })
})
