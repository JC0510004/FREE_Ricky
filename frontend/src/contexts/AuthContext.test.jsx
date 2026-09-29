// ─── TESTS: AuthContext (AuthProvider) ───────────────────────────────────
// Cubre el proveedor de contexto de autenticación.
// Estrategia: montar AuthProvider con un componente consumidor mínimo
// que expone los valores del contexto a los assertions.

import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AuthProvider } from './AuthContext'
import { useAuth } from './useAuth'

// ─── MOCK: authService ────────────────────────────────────────────────────
vi.mock('../services/authService', () => ({
  authService: {
    getStoredUser:  vi.fn(),
    verifySession:  vi.fn(),
    login:          vi.fn(),
    register:       vi.fn(),
    logout:         vi.fn(),
  },
}))

import { authService } from '../services/authService'

// ─── HELPER: consumidor mínimo del contexto ───────────────────────────────
function ContextConsumer() {
  const { user, isAuthenticated, isLoading, tokenReady } = useAuth()
  return (
    <div>
      <span data-testid="user">{user ? JSON.stringify(user) : 'null'}</span>
      <span data-testid="isAuthenticated">{String(isAuthenticated)}</span>
      <span data-testid="isLoading">{String(isLoading)}</span>
      <span data-testid="tokenReady">{String(tokenReady)}</span>
    </div>
  )
}

async function renderAndWait() {
  let result
  await act(async () => {
    result = render(
      <AuthProvider>
        <ContextConsumer />
      </AuthProvider>
    )
  })
  return result
}

// ─────────────────────────────────────────────────────────────────────────
describe('AuthProvider', () => {

  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // ─── SIN USUARIO GUARDADO ────────────────────────────────────────
  describe('sin usuario en localStorage', () => {
    it('termina el loading con usuario null y sin autenticación', async () => {
      authService.getStoredUser.mockReturnValue(null)

      await renderAndWait()

      expect(screen.getByTestId('isLoading')).toHaveTextContent('false')
      expect(screen.getByTestId('user')).toHaveTextContent('null')
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false')
      expect(screen.getByTestId('tokenReady')).toHaveTextContent('false')
    })

    it('NO llama a verifySession si no hay usuario guardado', async () => {
      authService.getStoredUser.mockReturnValue(null)

      await renderAndWait()

      expect(authService.verifySession).not.toHaveBeenCalled()
    })
  })

  // ─── SESIÓN GUARDADA Y VÁLIDA ─────────────────────────────────────
  describe('con usuario en localStorage y sesión válida', () => {
    const storedUser = { id: 1, username: 'juan', rol: 'jugador' }
    const freshUser  = { id: 1, username: 'juan', rol: 'jugador', activo: true }

    beforeEach(() => {
      authService.getStoredUser.mockReturnValue(storedUser)
      authService.verifySession.mockResolvedValue({ usuario: freshUser })
    })

    it('llama a verifySession al montar', async () => {
      await renderAndWait()
      expect(authService.verifySession).toHaveBeenCalledOnce()
    })

    it('actualiza el usuario con los datos frescos del backend', async () => {
      await renderAndWait()
      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(freshUser))
    })

    it('pone isAuthenticated y tokenReady en true', async () => {
      await renderAndWait()
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true')
      expect(screen.getByTestId('tokenReady')).toHaveTextContent('true')
    })

    it('termina el loading', async () => {
      await renderAndWait()
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false')
    })

    it('persiste el usuario fresco en localStorage', async () => {
      await renderAndWait()
      const stored = JSON.parse(localStorage.getItem('usuario:v1'))
      expect(stored).toEqual(freshUser)
    })
  })

  // ─── SESIÓN GUARDADA PERO INVÁLIDA ───────────────────────────────
  describe('con usuario en localStorage pero sesión inválida', () => {
    it('limpia el usuario cuando verifySession devuelve null', async () => {
      authService.getStoredUser.mockReturnValue({ id: 1, username: 'juan' })
      authService.verifySession.mockResolvedValue(null)

      await renderAndWait()

      expect(screen.getByTestId('user')).toHaveTextContent('null')
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false')
    })
  })

  // ─── login() ──────────────────────────────────────────────────────
  describe('login()', () => {
    it('actualiza el usuario y tokenReady al hacer login exitoso', async () => {
      authService.getStoredUser.mockReturnValue(null)
      const loggedUser = { id: 2, username: 'nuevo', rol: 'jugador' }
      authService.login.mockResolvedValue({ usuario: loggedUser })

      function WithLogin() {
        const { user, isAuthenticated, tokenReady, login } = useAuth()
        return (
          <div>
            <span data-testid="user">{user ? JSON.stringify(user) : 'null'}</span>
            <span data-testid="isAuthenticated">{String(isAuthenticated)}</span>
            <span data-testid="tokenReady">{String(tokenReady)}</span>
            <button onClick={() => login('nuevo', '1234')}>Login</button>
          </div>
        )
      }

      await act(async () => {
        render(<AuthProvider><WithLogin /></AuthProvider>)
      })

      await userEvent.click(screen.getByRole('button', { name: 'Login' }))

      expect(authService.login).toHaveBeenCalledWith('nuevo', '1234')
      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(loggedUser))
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true')
      expect(screen.getByTestId('tokenReady')).toHaveTextContent('true')
    })
  })

  // ─── logout() ─────────────────────────────────────────────────────
  describe('logout()', () => {
    it('limpia usuario y tokenReady al hacer logout', async () => {
      const u = { id: 1, username: 'juan', rol: 'jugador' }
      authService.getStoredUser.mockReturnValue(u)
      authService.verifySession.mockResolvedValue({ usuario: u })
      authService.logout.mockResolvedValue()

      function WithLogout() {
        const { user, tokenReady, logout } = useAuth()
        return (
          <div>
            <span data-testid="user">{user ? user.username : 'null'}</span>
            <span data-testid="tokenReady">{String(tokenReady)}</span>
            <button onClick={logout}>Logout</button>
          </div>
        )
      }

      await act(async () => {
        render(<AuthProvider><WithLogout /></AuthProvider>)
      })

      await waitFor(() =>
        expect(screen.getByTestId('user')).toHaveTextContent('juan')
      )

      await userEvent.click(screen.getByRole('button', { name: 'Logout' }))

      expect(screen.getByTestId('user')).toHaveTextContent('null')
      expect(screen.getByTestId('tokenReady')).toHaveTextContent('false')
    })
  })

  // ─── register() ───────────────────────────────────────────────────
  describe('register()', () => {
    it('inicia sesión automáticamente si el backend devuelve access_token', async () => {
      authService.getStoredUser.mockReturnValue(null)
      const newUser = { id: 3, username: 'casper', rol: 'jugador' }
      authService.register.mockResolvedValue({ usuario: newUser, access_token: 'tok' })

      function WithRegister() {
        const { user, isAuthenticated, register } = useAuth()
        return (
          <div>
            <span data-testid="user">{user ? user.username : 'null'}</span>
            <span data-testid="isAuthenticated">{String(isAuthenticated)}</span>
            <button onClick={() => register({ username: 'casper', password: '1234' })}>
              Registro
            </button>
          </div>
        )
      }

      await act(async () => {
        render(<AuthProvider><WithRegister /></AuthProvider>)
      })

      await userEvent.click(screen.getByRole('button', { name: 'Registro' }))

      expect(screen.getByTestId('user')).toHaveTextContent('casper')
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true')
    })

    it('NO inicia sesión si el backend NO devuelve access_token (cuenta inactiva)', async () => {
      authService.getStoredUser.mockReturnValue(null)
      authService.register.mockResolvedValue({ mensaje: 'Revisa tu email' })

      function WithRegister() {
        const { user, register } = useAuth()
        return (
          <div>
            <span data-testid="user">{user ? user.username : 'null'}</span>
            <button onClick={() => register({ username: 'inactivo', password: '1234' })}>
              Registro
            </button>
          </div>
        )
      }

      await act(async () => {
        render(<AuthProvider><WithRegister /></AuthProvider>)
      })

      await userEvent.click(screen.getByRole('button', { name: 'Registro' }))

      expect(screen.getByTestId('user')).toHaveTextContent('null')
    })
  })

  // ─── updateUser() ─────────────────────────────────────────────────
  describe('updateUser()', () => {
    it('fusiona los datos nuevos sin reemplazar el objeto completo', async () => {
      const u = { id: 1, username: 'juan', rol: 'jugador', email: 'juan@test.com' }
      authService.getStoredUser.mockReturnValue(u)
      authService.verifySession.mockResolvedValue({ usuario: u })

      function WithUpdate() {
        const { user, updateUser } = useAuth()
        return (
          <div>
            <span data-testid="user">{user ? JSON.stringify(user) : 'null'}</span>
            <button onClick={() => updateUser({ email: 'nuevo@test.com' })}>
              Actualizar
            </button>
          </div>
        )
      }

      await act(async () => {
        render(<AuthProvider><WithUpdate /></AuthProvider>)
      })

      await waitFor(() =>
        expect(screen.getByTestId('user')).toHaveTextContent('juan')
      )

      await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }))

      const updated = JSON.parse(screen.getByTestId('user').textContent)
      expect(updated.username).toBe('juan')
      expect(updated.email).toBe('nuevo@test.com')
      expect(JSON.parse(localStorage.getItem('usuario:v1')).email).toBe('nuevo@test.com')
    })
  })

  // ─── evento auth:session-expired ─────────────────────────────────
  describe('evento global auth:session-expired', () => {
    it('limpia usuario y tokenReady al recibir el evento', async () => {
      const u = { id: 1, username: 'juan', rol: 'jugador' }
      authService.getStoredUser.mockReturnValue(u)
      authService.verifySession.mockResolvedValue({ usuario: u })

      await renderAndWait()

      await waitFor(() =>
        expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true')
      )

      act(() => {
        window.dispatchEvent(new Event('auth:session-expired'))
      })

      expect(screen.getByTestId('user')).toHaveTextContent('null')
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false')
      expect(screen.getByTestId('tokenReady')).toHaveTextContent('false')
    })
  })

  // ─── Resiliencia ante rechazos de authService ─────────────────────
  // authService traga hoy sus propios errores, asi que estos mocks no son
  // alcanzables con la implementacion actual. Fijan el contrato de que el
  // contexto no se rompe si esa garantia cambia: sin esto, un verify()
  // que rechazara dejaria isLoading en true para siempre y ProtectedRoute
  // dejaria todas las rutas en blanco sin forma de recuperacion.
  describe('si authService rechaza la promesa', () => {
    const u = { id: 1, username: 'juan', rol: 'jugador' }

    it('verify() termina el loading en vez de dejar la app colgada', async () => {
      authService.getStoredUser.mockReturnValue(u)
      authService.verifySession.mockRejectedValue(new Error('red caída'))

      await renderAndWait()

      // Si isLoading se quedara en true, ProtectedRoute renderiza null en
      // todas las rutas y no habria forma de llegar a la pantalla de login.
      expect(screen.getByTestId('isLoading')).toHaveTextContent('false')
    })

    it('verify() no tira la sesión del usuario ante un fallo de red', async () => {
      authService.getStoredUser.mockReturnValue(u)
      authService.verifySession.mockRejectedValue(new Error('red caída'))

      await renderAndWait()

      // Un fallo puntual de red no equivale a sesión caída: si el token
      // estuviera muerto, las siguientes peticiones darían 401 y el
      // interceptor ya se encargaría. El waitFor cubre el act inicial.
      await waitFor(() =>
        expect(screen.getByTestId('isLoading')).toHaveTextContent('false')
      )
      expect(screen.getByTestId('user')).toHaveTextContent(JSON.stringify(u))
    })

    it('logout() limpia el estado local aunque el backend falle', async () => {
      authService.getStoredUser.mockReturnValue(u)
      authService.verifySession.mockResolvedValue({ usuario: u })
      authService.logout.mockRejectedValue(new Error('red caída'))

      function WithLogout() {
        const { user, tokenReady, logout } = useAuth()
        return (
          <div>
            <span data-testid="user">{user ? user.username : 'null'}</span>
            <span data-testid="tokenReady">{String(tokenReady)}</span>
            <button onClick={logout}>Logout</button>
          </div>
        )
      }

      await act(async () => {
        render(<AuthProvider><WithLogout /></AuthProvider>)
      })

      await waitFor(() =>
        expect(screen.getByTestId('user')).toHaveTextContent('juan')
      )

      await userEvent.click(screen.getByRole('button', { name: 'Logout' }))

      // El finally garantiza esto: sin el, el rechazo se comería el
      // setUser(null) y el usuario se quedaría "conectado" en la UI.
      expect(screen.getByTestId('user')).toHaveTextContent('null')
      expect(screen.getByTestId('tokenReady')).toHaveTextContent('false')
    })
  })

  // ─── checkSession() ────────────────────────────────────────────────
  describe('checkSession()', () => {
    it('devuelve false y limpia el estado si verifySession rechaza', async () => {
      const u = { id: 1, username: 'juan', rol: 'jugador' }
      authService.getStoredUser.mockReturnValue(u)
      authService.verifySession.mockResolvedValue({ usuario: u })

      let result
      function WithCheck() {
        const { user, checkSession } = useAuth()
        return (
          <div>
            <span data-testid="user">{user ? user.username : 'null'}</span>
            <button
              onClick={async () => { result = await checkSession() }}
            >
              Check
            </button>
          </div>
        )
      }

      await act(async () => {
        render(<AuthProvider><WithCheck /></AuthProvider>)
      })

      await waitFor(() =>
        expect(screen.getByTestId('user')).toHaveTextContent('juan')
      )

      authService.verifySession.mockRejectedValue(new Error('red caída'))
      await userEvent.click(screen.getByRole('button', { name: 'Check' }))

      expect(result).toBe(false)
      expect(screen.getByTestId('user')).toHaveTextContent('null')
    })
  })
})