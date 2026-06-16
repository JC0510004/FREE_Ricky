import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(authService.getStoredUser())
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const verify = async () => {
      const stored = authService.getStoredUser()
      if (!stored) {
        setIsLoading(false)
        return
      }
      const valid = await authService.verifySession()
      if (!valid) {
        setUser(null)
      }
      setIsLoading(false)
    }
    verify()
  }, [])

  const login = useCallback(async (username, password) => {
    const response = await authService.login(username, password)
    setUser(response.usuario)
  }, [])

  const register = useCallback(async (data) => {
    await authService.register(data)
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('usuario')
  }, [])

  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  const checkSession = useCallback(async () => {
    const valid = await authService.verifySession()
    if (!valid) {
      setUser(null)
    }
    return valid
  }, [])

  const isAuthenticated = !!user

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated, isLoading, login, register, logout, checkSession }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
