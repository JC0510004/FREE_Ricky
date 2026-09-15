import { beforeEach, describe, it, expect } from 'vitest'
import { setAccessToken, getAccessToken, clearAccessToken } from './tokenStore'

describe('tokenStore', () => {
  beforeEach(() => {
    clearAccessToken()
  })

  it('inicia sin token', () => {
    expect(getAccessToken()).toBeNull()
  })

  it('guarda y recupera el token', () => {
    setAccessToken('jwt-token-123')
    expect(getAccessToken()).toBe('jwt-token-123')
  })

  it('limpia el token', () => {
    setAccessToken('jwt-token-123')
    clearAccessToken()
    expect(getAccessToken()).toBeNull()
  })

  it('sobrescribe el token anterior', () => {
    setAccessToken('token-uno')
    setAccessToken('token-dos')
    expect(getAccessToken()).toBe('token-dos')
  })
})