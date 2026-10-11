// ─── TESTS: hooks/useIsMobile.js ──────────────────────────────────────
// jsdom no trae matchMedia, así que se simula con un objeto que guarda los
// oyentes y permite "cambiar de pantalla" a mano.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'

import { useIsMobile } from './useIsMobile'

const CONSULTA = '(max-width: 1023px)'
const matchMediaOriginal = window.matchMedia

function simularPantalla(esMovil) {
  const oyentes = new Set()
  const lista = {
    matches: esMovil,
    addEventListener: vi.fn((tipo, fn) => oyentes.add(fn)),
    removeEventListener: vi.fn((tipo, fn) => oyentes.delete(fn)),
  }
  window.matchMedia = vi.fn(() => lista)

  return {
    lista,
    oyentes,
    cambiarA(valor) {
      lista.matches = valor
      oyentes.forEach((fn) => fn())
    },
  }
}

afterEach(() => {
  window.matchMedia = matchMediaOriginal
})

describe('useIsMobile', () => {
  it('devuelve false en una pantalla ancha', () => {
    simularPantalla(false)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
  })

  it('devuelve true en una pantalla de móvil', () => {
    simularPantalla(true)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(true)
  })

  it('consulta el punto de corte de 1023px', () => {
    simularPantalla(false)
    renderHook(() => useIsMobile())
    expect(window.matchMedia).toHaveBeenCalledWith(CONSULTA)
  })

  it('se actualiza cuando la pantalla cambia de tamaño', () => {
    const pantalla = simularPantalla(false)
    const { result } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)

    act(() => pantalla.cambiarA(true))
    expect(result.current).toBe(true)

    act(() => pantalla.cambiarA(false))
    expect(result.current).toBe(false)
  })

  it('escucha el evento "change" y deja de escucharlo al desmontar', () => {
    const pantalla = simularPantalla(false)
    const { unmount } = renderHook(() => useIsMobile())

    expect(pantalla.lista.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    )
    expect(pantalla.oyentes.size).toBe(1)

    unmount()

    expect(pantalla.lista.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    )
    expect(pantalla.oyentes.size).toBe(0)
  })

  it('devuelve false y no falla si el navegador no tiene matchMedia', () => {
    window.matchMedia = undefined
    const { result, unmount } = renderHook(() => useIsMobile())
    expect(result.current).toBe(false)
    expect(() => unmount()).not.toThrow()
  })

  // Cubre getServerSnapshot (la línea 18 del hook), que solo se usa al
  // renderizar en servidor. Si este test da error de entorno (por ejemplo
  // con TextEncoder), se puede borrar sin perder nada importante.
  it('devuelve false al renderizar en el servidor', () => {
    function Sonda() {
      return createElement('span', null, String(useIsMobile()))
    }
    expect(renderToString(createElement(Sonda))).toContain('false')
  })
})