// ─── TESTS: pages/Home.jsx ────────────────────────────────────────────
// Se simulan useFetch (las 4 peticiones) y useAuth, así Home se prueba
// aislado: sin red, sin backend y sin AuthProvider.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import Home from '../Home'
import useFetch from '../../hooks/useFetch'
import { useAuth } from '../../contexts/useAuth'

vi.mock('../../hooks/useFetch', () => ({ default: vi.fn() }))
vi.mock('../../contexts/useAuth', () => ({ useAuth: vi.fn() }))

const VACIO = { data: null, loading: false, error: null }
const USUARIO = { username: 'juan', email: 'juan@test.com', rol: 'jugador' }

// Responde a cada useFetch según la URL; lo que no se indique queda vacío.
function mockApi(respuestas = {}) {
  useFetch.mockImplementation((url) => ({
    ...VACIO,
    ...(respuestas[url] || {}),
  }))
}

function mockUsuario(user = USUARIO, logout = vi.fn()) {
  useAuth.mockReturnValue({ user, logout })
  return logout
}

function renderHome() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  )
}

const partida = (n) => ({
  id: n,
  nivel: 1,
  nivel_nombre: `Nivel-${n}`,
  puntuacion: 100 + n,
  muertes: n,
  tiempo: 60,
  completado: true,
  fecha: '2026-01-15T10:00:00Z',
})

beforeEach(() => {
  vi.clearAllMocks()
  mockUsuario()
  mockApi()
})

describe('Home', () => {
  describe('cabecera', () => {
    it('muestra el nombre del usuario', () => {
      renderHome()
      expect(
        screen.getByRole('heading', { level: 1, name: 'juan' })
      ).toBeTruthy()
    })

    it('usa "Jugador" si no hay usuario', () => {
      mockUsuario(null)
      renderHome()
      expect(
        screen.getByRole('heading', { level: 1, name: 'Jugador' })
      ).toBeTruthy()
    })

    it('el enlace "Volver al inicio" apunta a la raíz', () => {
      renderHome()
      const enlace = screen.getByRole('link', { name: /volver al inicio/i })
      expect(enlace.getAttribute('href')).toBe('/')
    })

    it('llama a logout al pulsar "Cerrar sesión"', () => {
      const logout = mockUsuario()
      renderHome()
      fireEvent.click(screen.getByRole('button', { name: /cerrar sesión/i }))
      expect(logout).toHaveBeenCalledTimes(1)
    })
  })

  describe('tarjetas de estadísticas', () => {
    it('muestra los datos reales formateados', () => {
      mockApi({
        '/estadisticas/': {
          data: {
            total_partidas: 12,
            mejor_puntuacion: 980,
            promedio_puntuacion: 450,
            tiempo_total: 8000, // 2h 13m
          },
        },
      })
      renderHome()

      expect(screen.getByText('12')).toBeTruthy()
      expect(screen.getByText('980')).toBeTruthy()
      expect(screen.getByText('450')).toBeTruthy()
      expect(screen.getByText('2h 13m')).toBeTruthy()
    })

    it('muestra "..." en las 4 tarjetas mientras carga', () => {
      mockApi({ '/estadisticas/': { loading: true } })
      renderHome()
      expect(screen.getAllByText('...')).toHaveLength(4)
    })

    it('muestra "—" en las 4 tarjetas si las estadísticas fallan', () => {
      mockApi({ '/estadisticas/': { error: 'boom' } })
      renderHome()
      expect(screen.getAllByText('—')).toHaveLength(4)
    })

    it('muestra "0" y "0m" si no hay datos todavía', () => {
      mockApi({ '/estadisticas/': { data: {} } })
      renderHome()
      expect(screen.getAllByText('0')).toHaveLength(3)
      expect(screen.getByText('0m')).toBeTruthy()
    })
  })

  describe('aviso de error de carga', () => {
    it('no aparece si todo carga bien', () => {
      renderHome()
      expect(screen.queryByText(/no se pudieron cargar los datos/i)).toBeNull()
    })

    it.each(['/estadisticas/', '/niveles/', '/ranking/', '/partidas/'])(
      'aparece si falla %s',
      (url) => {
        mockApi({ [url]: { error: 'boom' } })
        renderHome()
        expect(
          screen.getByText(/no se pudieron cargar los datos/i)
        ).toBeTruthy()
      }
    )
  })

  describe('niveles', () => {
    const niveles = {
      results: [
        { id: 1, nombre: 'Bosque', dificultad: 'facil' },
        { id: 2, nombre: 'Volcán', dificultad: 'dificil' },
      ],
    }

    it('lista los niveles con su dificultad y el contador', () => {
      mockApi({ '/niveles/': { data: niveles } })
      renderHome()

      expect(screen.getByRole('heading', { name: 'Bosque' })).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Volcán' })).toBeTruthy()
      expect(screen.getByText('Fácil')).toBeTruthy()
      expect(screen.getByText('Difícil')).toBeTruthy()
      expect(screen.getByText('2 disponibles')).toBeTruthy()
    })

    it('acepta una lista simple sin paginar', () => {
      mockApi({ '/niveles/': { data: niveles.results } })
      renderHome()
      expect(screen.getByRole('heading', { name: 'Bosque' })).toBeTruthy()
    })

    it('marca "Completado" solo los niveles con partidas', () => {
      mockApi({
        '/niveles/': { data: niveles },
        '/partidas/': { data: { count: 1, results: [partida(1)] } },
      })
      renderHome()

      // Se revisa CADA tarjeta: contar no basta, porque con la lógica
      // invertida los totales saldrían iguales.
      const bosque = screen
        .getByRole('heading', { name: 'Bosque' })
        .closest('article')
      const volcan = screen
        .getByRole('heading', { name: 'Volcán' })
        .closest('article')
      expect(within(bosque).getByText('Completado')).toBeTruthy()
      expect(within(volcan).getByText('Nuevo desafío')).toBeTruthy()
    })

    it('los botones de jugar están deshabilitados (próximamente)', () => {
      mockApi({ '/niveles/': { data: niveles } })
      renderHome()
      const botones = screen.getAllByRole('button', { name: /próximamente/i })
      expect(botones).toHaveLength(2)
      botones.forEach((b) => expect(b.disabled).toBe(true))
    })

    it('muestra un nivel con dificultad desconocida sin romperse', () => {
      mockApi({
        '/niveles/': {
          data: { results: [{ id: 9, nombre: 'Raro', dificultad: 'extremo' }] },
        },
      })
      renderHome()
      expect(screen.getByText('extremo')).toBeTruthy()
    })

    it('muestra "Cargando..." mientras carga', () => {
      mockApi({ '/niveles/': { loading: true } })
      renderHome()
      expect(screen.getByText('Cargando...')).toBeTruthy()
    })

    it('muestra el estado vacío si no hay niveles', () => {
      mockApi({ '/niveles/': { data: { results: [] } } })
      renderHome()
      expect(screen.getByText('No hay niveles disponibles')).toBeTruthy()
      expect(screen.getByText('0 disponibles')).toBeTruthy()
    })

    it('no muestra el estado vacío si la petición falló', () => {
      mockApi({ '/niveles/': { error: 'boom' } })
      renderHome()
      expect(screen.queryByText('No hay niveles disponibles')).toBeNull()
    })
  })

  describe('ranking global', () => {
    const ranking = [
      {
        username: 'ana',
        mejor_puntuacion: 900,
        total_partidas: 5,
        promedio_puntuacion: 300,
      },
      {
        username: 'juan',
        mejor_puntuacion: 800,
        total_partidas: 3,
        promedio_puntuacion: null,
      },
    ]

    it('lista a los jugadores con sus puntos', () => {
      mockApi({ '/ranking/': { data: ranking } })
      renderHome()

      expect(screen.getByText('ana')).toBeTruthy()
      expect(screen.getByText('900')).toBeTruthy()
      expect(screen.getByText('300')).toBeTruthy()
    })

    it('marca con "TÚ" solo la fila del usuario actual', () => {
      mockApi({ '/ranking/': { data: ranking } })
      renderHome()
      // La insignia debe estar en la fila de juan, no en la de ana.
      const fila = screen.getByText('TÚ').closest('tr')
      expect(fila.textContent).toContain('juan')
      expect(fila.textContent).not.toContain('ana')
    })

    it('muestra "—" cuando el promedio es null', () => {
      mockApi({ '/ranking/': { data: ranking } })
      renderHome()
      expect(screen.getAllByText('—')).toHaveLength(1)
    })

    it('muestra "Cargando ranking..." mientras carga', () => {
      mockApi({ '/ranking/': { loading: true } })
      renderHome()
      expect(screen.getByText('Cargando ranking...')).toBeTruthy()
    })

    it('muestra el mensaje vacío si no hay jugadores', () => {
      mockApi({ '/ranking/': { data: [] } })
      renderHome()
      expect(
        screen.getByText('Aún no hay jugadores en el ranking')
      ).toBeTruthy()
    })

    it('no muestra el mensaje vacío si la petición falló', () => {
      mockApi({ '/ranking/': { error: 'boom' } })
      renderHome()
      expect(
        screen.queryByText('Aún no hay jugadores en el ranking')
      ).toBeNull()
    })
  })

  describe('últimas partidas', () => {
    it('muestra "Cargando historial..." mientras carga', () => {
      mockApi({ '/partidas/': { loading: true } })
      renderHome()
      expect(screen.getByText('Cargando historial...')).toBeTruthy()
    })

    it('muestra un error propio si falla el historial', () => {
      mockApi({ '/partidas/': { error: 'boom' } })
      renderHome()
      expect(screen.getByText('No se pudo cargar tu historial')).toBeTruthy()
    })

    it('muestra el estado vacío si no ha jugado', () => {
      mockApi({ '/partidas/': { data: { count: 0, results: [] } } })
      renderHome()
      expect(
        screen.getByText('No has jugado ninguna partida aún')
      ).toBeTruthy()
    })

    it('muestra las partidas con puntaje y tiempo', () => {
      mockApi({ '/partidas/': { data: { count: 1, results: [partida(1)] } } })
      renderHome()
      expect(screen.getByText('Nivel-1')).toBeTruthy()
      expect(screen.getByText('101')).toBeTruthy()
      expect(screen.getByText('1m')).toBeTruthy()
      expect(screen.getByText(/2026/)).toBeTruthy()
    })

    it('acepta una lista simple sin paginar', () => {
      mockApi({ '/partidas/': { data: [partida(1), partida(2)] } })
      renderHome()
      expect(screen.getByText('Nivel-1')).toBeTruthy()
      expect(screen.getByText('Nivel-2')).toBeTruthy()
    })

    it('con 5 o menos partidas no muestra el aviso de recorte', () => {
      const results = [1, 2, 3].map(partida)
      mockApi({ '/partidas/': { data: { count: 3, results } } })
      renderHome()
      expect(screen.queryByText(/mostrando las/i)).toBeNull()
    })

    it('solo enseña las 5 más recientes y avisa del recorte', () => {
      const results = [1, 2, 3, 4, 5, 6, 7].map(partida)
      mockApi({ '/partidas/': { data: { count: 7, results } } })
      renderHome()

      expect(screen.getByText('Nivel-5')).toBeTruthy()
      expect(screen.queryByText('Nivel-6')).toBeNull()
      expect(
        screen.getByText(/mostrando las 5 partidas más recientes de 7/i)
      ).toBeTruthy()
    })

    it('indica el total real cuando hay más páginas en el backend', () => {
      const results = [1, 2, 3, 4, 5, 6, 7].map(partida)
      mockApi({ '/partidas/': { data: { count: 12, results } } })
      renderHome()
      expect(screen.getByText(/de 12 en total/i)).toBeTruthy()
    })
  })

  describe('perfil', () => {
    it('muestra el email, la inicial y el rol de jugador', () => {
      mockUsuario({ username: 'maria', email: 'maria@test.com', rol: 'jugador' })
      renderHome()

      expect(screen.getByText('maria@test.com')).toBeTruthy()
      expect(screen.getByText('M')).toBeTruthy()
      expect(screen.getByText('Jugador', { selector: '.fr-badge' })).toBeTruthy()
      expect(screen.queryByText('Administrador', { selector: '.fr-badge' })).toBeNull()
    })

    it('muestra "Administrador" si el rol es admin', () => {
      mockUsuario({ ...USUARIO, rol: 'admin' })
      renderHome()
      expect(screen.getByText('Administrador', { selector: '.fr-badge' })).toBeTruthy()
      expect(screen.queryByText('Jugador', { selector: '.fr-badge' })).toBeNull()
    })

    it('muestra "—" si el usuario no tiene email', () => {
      mockUsuario({ username: 'juan', rol: 'jugador' })
      renderHome()
      expect(screen.getByText('—')).toBeTruthy()
    })

    it('muestra "Miembro desde" solo si hay fecha de registro', () => {
      renderHome()
      expect(screen.queryByText('Miembro desde')).toBeNull()
    })

    it('muestra la fecha de registro cuando existe', () => {
      mockUsuario({ ...USUARIO, fecha_registro: '2025-03-10T12:00:00Z' })
      renderHome()
      expect(screen.getByText('Miembro desde')).toBeTruthy()
      expect(screen.getByText(/2025/)).toBeTruthy()
    })
  })
})