import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

vi.mock('../api/axios', () => ({
  default: { get: vi.fn() },
}))

const API_MODULE = await import('../api/axios')

// El hook no usa tokenStore en este test pero importa getAccessToken
vi.mock('../api/tokenStore', () => ({
  getAccessToken: () => null,
}))

import useFetch from './useFetch'

describe('useFetch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna los datos obtenidos de la API', async () => {
    API_MODULE.default.get.mockResolvedValue({ data: { results: [1, 2, 3] } })

    const { result } = renderHook(() => useFetch('/niveles/'))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toEqual({ results: [1, 2, 3] })
    expect(result.current.error).toBeNull()
    expect(API_MODULE.default.get).toHaveBeenCalledWith(
      '/niveles/',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
  })

  it('queda loading=false cuando enabled es false', () => {
    const { result } = renderHook(() => useFetch('/niveles/', { enabled: false }))
    expect(result.current.loading).toBe(false)
    expect(API_MODULE.default.get).not.toHaveBeenCalled()
  })

  it('no llama a la API si no hay url', () => {
    const { result } = renderHook(() => useFetch(null))
    expect(result.current.loading).toBe(false)
    expect(API_MODULE.default.get).not.toHaveBeenCalled()
  })

  it('setea el error cuando la petición falla', async () => {
    const error = new Error('Network Error')
    API_MODULE.default.get.mockRejectedValue(error)

    const { result } = renderHook(() => useFetch('/ranking/'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBe(error)
    expect(result.current.data).toBeNull()
  })
})