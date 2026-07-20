import { useState, useEffect, useCallback, useMemo } from 'react'
import { authService } from '../services/authService'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authService.getStoredUser())
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

  const value = useMemo(
    () => ({ user, isAuthenticated, isLoading, login, register, logout, checkSession }),
    [user, isAuthenticated, isLoading, login, register, logout, checkSession]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
