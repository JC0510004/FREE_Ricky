// ─── TESTS: ProtectedRoute ────────────────────────────────────────────────
// Cubre el componente guardia de ruta.
// Los 7 casos que debe manejar:
//   1. isLoading = true                          → null (no renderiza nada)
//   2. isLoading = true con usuario en memoria   → null (espera confirmación)
//   3. No autenticado                            → redirige a "/"
//   4. No autenticado + adminOnly                → redirige a "/"
//   5. Autenticado, ruta normal                  → renderiza hijos
//   6. Autenticado, adminOnly, rol admin         → renderiza hijos
//   7. Autenticado, adminOnly, rol jugador       → redirige a "/home"
// + edge cases: rol undefined, hijos complejos

import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'

// ─── MOCK: useAuth ────────────────────────────────────────────────────────
vi.mock('../contexts/useAuth', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../contexts/useAuth'

// ─── HELPER: árbol de rutas completo ─────────────────────────────────────
function renderProtectedRoute({
  adminOnly = false,
  children = <span data-testid="contenido-protegido">Contenido</span>,
  initialPath = '/protected',
} = {}) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route
          path="/protected"
          element={
            <ProtectedRoute adminOnly={adminOnly}>
              {children}
            </ProtectedRoute>
          }
        />
        <Route path="/"     element={<span data-testid="landing">Landing</span>} />
        <Route path="/home" element={<span data-testid="home">Home</span>} />
      </Routes>
    </MemoryRouter>
  )
}

// ─────────────────────────────────────────────────────────────────────────
describe('ProtectedRoute', () => {

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('cuando isLoading es true', () => {
    it('no renderiza nada — ni hijos ni redirección', () => {
      useAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: true })
      const { container } = renderProtectedRoute()
      expect(container).toBeEmptyDOMElement()
    })

    it('tampoco renderiza nada aunque haya usuario en memoria', () => {
      useAuth.mockReturnValue({ user: { id: 1, username: 'juan', rol: 'admin' }, isAuthenticated: true, isLoading: true })
      const { container } = renderProtectedRoute({ adminOnly: true })
      expect(container).toBeEmptyDOMElement()
    })
  })

  describe('cuando el usuario no está autenticado', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({ user: null, isAuthenticated: false, isLoading: false })
    })

    it('redirige a "/" en ruta normal', () => {
      renderProtectedRoute()
      expect(screen.getByTestId('landing')).toBeInTheDocument()
      expect(screen.queryByTestId('contenido-protegido')).not.toBeInTheDocument()
    })

    it('redirige a "/" también en rutas adminOnly', () => {
      renderProtectedRoute({ adminOnly: true })
      expect(screen.getByTestId('landing')).toBeInTheDocument()
    })
  })

  describe('cuando el usuario está autenticado y la ruta no es adminOnly', () => {
    it('renderiza los hijos correctamente (jugador)', () => {
      useAuth.mockReturnValue({ user: { id: 1, username: 'juan', rol: 'jugador' }, isAuthenticated: true, isLoading: false })
      renderProtectedRoute()
      expect(screen.getByTestId('contenido-protegido')).toBeInTheDocument()
    })

    it('un admin también puede acceder a rutas normales', () => {
      useAuth.mockReturnValue({ user: { id: 2, username: 'admin', rol: 'admin' }, isAuthenticated: true, isLoading: false })
      renderProtectedRoute()
      expect(screen.getByTestId('contenido-protegido')).toBeInTheDocument()
    })
  })

  describe('cuando la ruta es adminOnly y el usuario tiene rol admin', () => {
    it('renderiza los hijos', () => {
      useAuth.mockReturnValue({ user: { id: 2, username: 'superadmin', rol: 'admin' }, isAuthenticated: true, isLoading: false })
      renderProtectedRoute({ adminOnly: true })
      expect(screen.getByTestId('contenido-protegido')).toBeInTheDocument()
    })
  })

  describe('cuando la ruta es adminOnly y el usuario NO tiene rol admin', () => {
    it('redirige a "/home" — no a "/"', () => {
      useAuth.mockReturnValue({ user: { id: 3, username: 'jugador', rol: 'jugador' }, isAuthenticated: true, isLoading: false })
      renderProtectedRoute({ adminOnly: true })
      expect(screen.getByTestId('home')).toBeInTheDocument()
      expect(screen.queryByTestId('landing')).not.toBeInTheDocument()
      expect(screen.queryByTestId('contenido-protegido')).not.toBeInTheDocument()
    })

    it('también redirige si el rol es cualquier string distinto de "admin"', () => {
      useAuth.mockReturnValue({ user: { id: 4, username: 'moderador', rol: 'moderador' }, isAuthenticated: true, isLoading: false })
      renderProtectedRoute({ adminOnly: true })
      expect(screen.getByTestId('home')).toBeInTheDocument()
    })
  })

  describe('edge cases', () => {
    it('maneja user.rol undefined sin romper — redirige a /home en adminOnly', () => {
      useAuth.mockReturnValue({ user: { id: 5, username: 'sinrol' }, isAuthenticated: true, isLoading: false })
      renderProtectedRoute({ adminOnly: true })
      expect(screen.getByTestId('home')).toBeInTheDocument()
    })

    it('renderiza hijos JSX complejos correctamente', () => {
      useAuth.mockReturnValue({ user: { id: 1, username: 'juan', rol: 'jugador' }, isAuthenticated: true, isLoading: false })
      const ComplexChild = () => (
        <div>
          <h1 data-testid="titulo">Dashboard</h1>
          <p data-testid="descripcion">Bienvenido</p>
        </div>
      )
      renderProtectedRoute({ children: <ComplexChild /> })
      expect(screen.getByTestId('titulo')).toBeInTheDocument()
      expect(screen.getByTestId('descripcion')).toBeInTheDocument()
    })
  })
})