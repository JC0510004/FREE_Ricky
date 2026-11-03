import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, act, waitFor } from '@testing-library/react'

const { navegar } = vi.hoisted(() => ({ navegar: vi.fn() }))

import Juego from '../Juego'
import API from '../../api/axios'

vi.mock('../../api/axios', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))
vi.mock('../../contexts/useAuth', () => ({
  useAuth: () => ({ user: { username: 'jugador1' } }),
}))
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal()),
  useNavigate: () => navegar,
  useLocation: () => ({ state: { nivelId: 3 } }),
}))

const ORIGEN = new URL(
  import.meta.env.VITE_GAME_ORIGIN || 'http://192.168.18.50:8080'
).origin

const NIVELES = { data: { results: [{ id: 3, nombre: 'La Guarida' }] } }

function enviar(data, origin = ORIGEN) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data, origin }))
  })
}

function renderJuego() {
  return render(<Juego />)
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('VITE_UNITY_LEGACY_COMPAT', 'false')
  API.get.mockResolvedValue(NIVELES)
  API.post.mockResolvedValue({ data: {} })
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
})

describe('Juego', () => {
  it('ignora mensajes de un origen distinto', () => {
    renderJuego()
    enviar({ type: 'resultadoPartida', datos: { muertes: 1, tiempo: 10, completado: true } }, 'http://evil.test')

    expect(API.post).not.toHaveBeenCalled()
    expect(navegar).not.toHaveBeenCalled()
  })

  it('ignora mensajes fuera del contrato', () => {
    renderJuego()
    enviar({ type: 'stats', datos: { deaths: 3, time: 10 } })

    expect(API.post).not.toHaveBeenCalled()
  })

  it('responde a unityListo con el nombre y el nivel', () => {
    const { container } = renderJuego()
    const iframe = container.querySelector('iframe')
    const postMessage = vi
      .spyOn(iframe.contentWindow, 'postMessage')
      .mockImplementation(() => {})

    enviar({ type: 'unityListo' })

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'setPlayerName', nombre: 'jugador1' },
      ORIGEN
    )
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'cargarNivel', nivel: 3 },
      ORIGEN
    )
  })

  it('guarda resultadoPartida completada y vuelve al panel', async () => {
    renderJuego()
    enviar({
      type: 'resultadoPartida',
      datos: { nivelId: 3, muertes: 2, tiempo: 90, completado: true },
    })

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/partidas/', {
        nivel: 3,
        muertes: 2,
        tiempo: 90,
        completado: true,
      })
    })
    await waitFor(() => expect(navegar).toHaveBeenCalledWith('/home'), { timeout: 2000 })
  })

  it('guarda salirPanel con stats como abandono', async () => {
    renderJuego()
    enviar({
      type: 'salirPanel',
      datos: { muertes: 4, tiempo: 120 },
    })

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/partidas/', {
        nivel: 3,
        muertes: 4,
        tiempo: 120,
        completado: false,
      })
    })
    expect(navegar).toHaveBeenCalledWith('/home')
  })

  it('no guarda dos veces la misma partida', async () => {
    renderJuego()
    const mensaje = {
      type: 'resultadoPartida',
      datos: { nivelId: 3, muertes: 2, tiempo: 90, completado: true },
    }
    enviar(mensaje)
    enviar(mensaje)

    await waitFor(() => expect(API.post).toHaveBeenCalledTimes(1))
  })

  it('pide stats y guarda abandono por timeout si salirPanel no trae datos', async () => {
    vi.useFakeTimers()
    const { container } = renderJuego()
    const iframe = container.querySelector('iframe')
    const postMessage = vi.spyOn(iframe.contentWindow, 'postMessage').mockImplementation(() => {})

    enviar({ type: 'salirPanel' })

    expect(postMessage).toHaveBeenCalledWith({ type: 'solicitarDatos' }, ORIGEN)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(API.post).toHaveBeenCalledWith('/partidas/', {
      nivel: 3,
      muertes: 0,
      tiempo: 0,
      completado: false,
    })
  })
})

describe('Juego con compatibilidad legacy', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_UNITY_LEGACY_COMPAT', 'true')
  })

  it('normaliza stats legacy y guarda el abandono', async () => {
    renderJuego()
    enviar({ type: 'stats', datos: { deaths: 3, time: 10 } })
    enviar({ type: 'salirPanel' })

    await waitFor(() => {
      expect(API.post).toHaveBeenCalledWith('/partidas/', {
        nivel: 3,
        muertes: 3,
        tiempo: 10,
        completado: false,
      })
    })
  })

  it('envía las variantes legacy al pedir stats', async () => {
    vi.useFakeTimers()
    const { container } = renderJuego()
    const iframe = container.querySelector('iframe')
    const postMessage = vi
      .spyOn(iframe.contentWindow, 'postMessage')
      .mockImplementation(() => {})

    enviar({ type: 'salirPanel' })

    expect(postMessage).toHaveBeenCalledWith({ type: 'solicitarDatos' }, ORIGEN)
    expect(postMessage).toHaveBeenCalledWith({ type: 'getStats' }, ORIGEN)
    expect(postMessage).toHaveBeenCalledTimes(9)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000)
    })

    expect(API.post).toHaveBeenCalledWith('/partidas/', {
      nivel: 3,
      muertes: 0,
      tiempo: 0,
      completado: false,
    })
  })
})
