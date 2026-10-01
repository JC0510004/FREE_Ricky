import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn() },
}))

const API_MODULE = await import('../api/axios')

vi.mock('../api/tokenStore', () => ({
  getAccessToken: () => null,
}))

import usePaginada from './usePaginada'

// Reproduce la respuesta de DRF PageNumberPagination.
const pagina = (results, count) => ({
  count,
  next: null,
  previous: null,
  results,
})

describe('usePaginada', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lee `count` del backend y no lo confunde con el tamaño de la página', async () => {
    // 50 filas en la página pero 312 usuarios en total: el fallo original
    // pintaba "50 usuarios" cuando en realidad eran 312.
    API_MODULE.default.get.mockResolvedValue({
      data: pagina(Array.from({ length: 50 }, (_, i) => ({ id: i + 1 })), 312),
    })

    const { result } = renderHook(() => usePaginada('/usuarios/', 50))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(50)
    expect(result.current.total).toBe(312)
    expect(result.current.totalPaginas).toBe(7)
  })

  it('pide la página 1 al montar', async () => {
    API_MODULE.default.get.mockResolvedValue({ data: pagina([], 0) })

    const { result } = renderHook(() => usePaginada('/usuarios/', 50))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(API_MODULE.default.get).toHaveBeenCalledWith(
      '/usuarios/',
      expect.objectContaining({ params: { page: 1 } })
    )
  })

  it('vuelve a pedir cuando se cambia de página (esto es lo que faltaba)', async () => {
    API_MODULE.default.get.mockResolvedValue({ data: pagina([{ id: 51 }], 312) })

    const { result } = renderHook(() => usePaginada('/usuarios/', 50))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.irA(2))

    await waitFor(() =>
      expect(API_MODULE.default.get).toHaveBeenCalledWith(
        '/usuarios/',
        expect.objectContaining({ params: { page: 2 } })
      )
    )
    expect(result.current.page).toBe(2)
    expect(result.current.items).toEqual([{ id: 51 }])
  })

  it('reload() refresca conservando la página actual', async () => {
    API_MODULE.default.get.mockResolvedValue({ data: pagina([{ id: 1 }], 312) })

    const { result } = renderHook(() => usePaginada('/usuarios/', 50))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.irA(3))
    await waitFor(() => expect(result.current.page).toBe(3))
    const llamadasAntes = API_MODULE.default.get.mock.calls.length

    act(() => result.current.reload())

    await waitFor(() =>
      expect(API_MODULE.default.get.mock.calls.length).toBeGreaterThan(llamadasAntes)
    )
    expect(result.current.page).toBe(3)
  })

  it('retrocede de página si se borra la última fila de la última página', async () => {
    // La 7 queda vacía (se acaba de borrar su única fila) pero la 6 sigue con
    // contenido. El mock depende de la página a propósito: si devolviera vacío
    // siempre, el hook retrocederia en cascada hasta la 1, que no es un caso real.
    API_MODULE.default.get.mockImplementation((_url, { params }) => Promise.resolve({
      data: params.page === 7
        ? pagina([], 312)
        : pagina([{ id: (params.page - 1) * 50 + 1 }], 312),
    }))

    const { result } = renderHook(() => usePaginada('/usuarios/', 50))
    await waitFor(() => expect(result.current.loading).toBe(false))

    act(() => result.current.irA(7))
    await waitFor(() => expect(result.current.page).toBe(6))
    expect(result.current.items).toHaveLength(1)
  })

  it('acepta endpoints que no paginan (lista plana)', async () => {
    API_MODULE.default.get.mockResolvedValue({ data: [{ id: 1 }, { id: 2 }] })

    const { result } = renderHook(() => usePaginada('/ranking/', 50))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.items).toHaveLength(2)
    expect(result.current.total).toBe(2)
    expect(result.current.totalPaginas).toBe(1)
  })

  it('captura el error de carga pero no confunde un aborto con un fallo', async () => {
    const error = new Error('Network Error')
    error.name = 'CanceledError'
    API_MODULE.default.get.mockRejectedValue(error)

    const { result } = renderHook(() => usePaginada('/usuarios/', 50))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // Un CanceledError es React desmontando el efecto, no un fallo de red.
    expect(result.current.error).toBeNull()
  })
})