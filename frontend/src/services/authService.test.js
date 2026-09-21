import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('../api/axios', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}))

const API_MODULE = await import('../api/axios')

let tokenStore
let tokenStoreModule

describe('authService', () => {
  let authService

  beforeEach(async () => {
    vi.clearAllMocks()
    tokenStore = (await import('../api/tokenStore'))
    tokenStore.clearAccessToken()
    localStorage.clear()

    const module = await import('./authService')
    authService = module.authService
    tokenStoreModule = await import('../api/tokenStore')
  })

  it('login guarda usuario en localStorage y token en memoria', async () => {
    const user = { id: 1, username: 'testuser' }
    API_MODULE.default.post.mockResolvedValue({
      data: { usuario: user, access_token: 'jwt-token' },
    })

    const result = await authService.login('testuser', 'Secret123!')

    expect(API_MODULE.default.post).toHaveBeenCalledWith('/login/', {
      username: 'testuser',
      password: 'Secret123!',
    })
    expect(JSON.parse(localStorage.getItem('usuario:v1'))).toEqual(user)
    expect(tokenStoreModule.getAccessToken()).toBe('jwt-token')
    expect(result.usuario).toEqual(user)
  })

  it('login no falla si no viene access_token', async () => {
    API_MODULE.default.post.mockResolvedValue({ data: { usuario: { id: 1 } } })
    const result = await authService.login('testuser', 'Secret123!')
    expect(result.usuario).toEqual({ id: 1 })
    expect(tokenStoreModule.getAccessToken()).toBeNull()
  })

  it('register envía los datos al endpoint', async () => {
    API_MODULE.default.post.mockResolvedValue({ data: { id: 2 } })
    const data = { username: 'newuser', email: 'a@b.com', password: 'x', confirm_password: 'x' }
    const result = await authService.register(data)
    expect(API_MODULE.default.post).toHaveBeenCalledWith('/register/', data)
    expect(result).toEqual({ id: 2 })
  })

  it('register inicia sesión automáticamente si el backend devuelve tokens', async () => {
    const user = { id: 3, username: 'newuser', rol: 'jugador' }
    API_MODULE.default.post.mockResolvedValue({
      data: { usuario: user, access_token: 'jwt-token' },
    })

    const result = await authService.register({ username: 'newuser' })

    expect(JSON.parse(localStorage.getItem('usuario:v1'))).toEqual(user)
    expect(tokenStoreModule.getAccessToken()).toBe('jwt-token')
    expect(result.usuario).toEqual(user)
  })

  it('logout limpia localStorage y memoria aunque falle el backend', async () => {
    localStorage.setItem('usuario:v1', JSON.stringify({ id: 1 }))
    tokenStoreModule.setAccessToken('token')
    API_MODULE.default.post.mockRejectedValue(new Error('offline'))

    await authService.logout()

    expect(localStorage.getItem('usuario:v1')).toBeNull()
    expect(tokenStoreModule.getAccessToken()).toBeNull()
  })

  it('verifySession devuelve el usuario fresco si la sesión es válida', async () => {
    const usuario = { id: 1, username: 'testuser', rol: 'jugador' }
    API_MODULE.default.get.mockResolvedValue({ data: { authenticated: true, usuario } })
    const result = await authService.verifySession()
    expect(result.usuario).toEqual(usuario)
  })

  it('verifySession devuelve null si la sesión falla', async () => {
    API_MODULE.default.get.mockRejectedValue(new Error('401'))
    expect(await authService.verifySession()).toBeNull()
  })

  it('getStoredUser retorna null con localStorage corrupto', () => {
    localStorage.setItem('usuario:v1', '{invalido-json')
    expect(authService.getStoredUser()).toBeNull()
  })

  it('getStoredUser retorna el usuario parseado', () => {
    localStorage.setItem('usuario:v1', JSON.stringify({ id: 5, username: 'pepe' }))
    expect(authService.getStoredUser()).toEqual({ id: 5, username: 'pepe' })
  })
})