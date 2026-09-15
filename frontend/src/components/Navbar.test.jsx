import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const authMock = vi.fn()

vi.mock('../contexts/useAuth', () => ({
  useAuth: () => authMock(),
}))

// Evita que el router real haga peticiones de imágenes externas (no necesario)
import Navbar from './Navbar'

function renderNavbar() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Navbar />
    </MemoryRouter>
  )
}

describe('Navbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockReturnValue({
      user: null,
      isAuthenticated: false,
      logout: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('muestra enlaces públicos para visitantes', () => {
    renderNavbar()
    expect(screen.getByText('SALT BORN')).toBeInTheDocument()
    expect(screen.getByText('INICIAR SESIÓN')).toBeInTheDocument()
    expect(screen.getByText('REGISTRARSE')).toBeInTheDocument()
    expect(screen.getByText('HISTORIA')).toBeInTheDocument()
    expect(screen.getByText('ACTUALIZACIONES')).toBeInTheDocument()
    expect(screen.getByText('TRIPULACIÓN')).toBeInTheDocument()
    expect(screen.getByText('COMUNIDAD')).toBeInTheDocument()
  })

  it('muestra el menú de usuario para usuarios autenticados', () => {
    authMock.mockReturnValue({
      user: { username: 'capitan', rol: 'jugador' },
      isAuthenticated: true,
      logout: vi.fn().mockResolvedValue(undefined),
    })
    renderNavbar()
    expect(screen.getByText('capitan')).toBeInTheDocument()
    // No muestra el botón de registro para autenticados
    expect(screen.queryByText('REGISTRARSE')).not.toBeInTheDocument()
  })

  it('abre el menú desplegable al hacer clic', () => {
    authMock.mockReturnValue({
      user: { username: 'capitan', rol: 'jugador' },
      isAuthenticated: true,
      logout: vi.fn().mockResolvedValue(undefined),
    })
    renderNavbar()
    fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    expect(screen.getByText('Configuración')).toBeInTheDocument()
    expect(screen.getByText('Cerrar Sesión')).toBeInTheDocument()
  })

  it('muestra enlace de Estadísticas solo para admin', () => {
    authMock.mockReturnValue({
      user: { username: 'admin', rol: 'admin' },
      isAuthenticated: true,
      logout: vi.fn().mockResolvedValue(undefined),
    })
    renderNavbar()
    fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    expect(screen.getByText('Estadísticas')).toBeInTheDocument()
  })

  it('no muestra enlace de Estadísticas para jugador', () => {
    authMock.mockReturnValue({
      user: { username: 'capitan', rol: 'jugador' },
      isAuthenticated: true,
      logout: vi.fn().mockResolvedValue(undefined),
    })
    renderNavbar()
    fireEvent.click(screen.getByRole('button', { name: 'Menú de usuario' }))
    expect(screen.queryByText('Estadísticas')).not.toBeInTheDocument()
  })
})