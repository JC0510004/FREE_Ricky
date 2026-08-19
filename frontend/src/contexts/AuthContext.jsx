// ─── PROVEEDOR DE CONTEXTO DE AUTENTICACIÓN ───────────────────────────
// Este componente es el proveedor del contexto de autenticación.
// Gestiona todo el estado relacionado con la sesión del usuario (login,
// registro, cierre de sesión, verificación de sesión) y lo distribuye
// a todos los componentes hijos a través de React Context.
// IMPORTANTE: Este archivo contiene la lógica, pero el contexto en sí
// (AuthContext) se define en auth-context.js para evitar dependencias
// circulares entre el proveedor y los consumidores.

// ─── IMPORTACIONES DE REACT ───────────────────────────────────────────
// useState: para gestionar el estado del usuario y el loading
// useEffect: para verificar la sesión al montar el componente
// useCallback: para memorizar funciones y evitar re-renderizados innecesarios
// useMemo: para memorizar el objeto de valor del contexto
import { useState, useEffect, useCallback, useMemo } from 'react'
// authService: capa de servicio que maneja las peticiones HTTP de auth
import { authService } from '../services/authService'
// AuthContext: el contexto React definido en auth-context.js
import { AuthContext } from './auth-context'

// ─── COMPONENTE PROVEEDOR ─────────────────────────────────────────────
// Envuelve los componentes hijos y les provee acceso al estado de
// autenticación y las funciones de autenticación a través del contexto.
export function AuthProvider({ children }) {
  // Estado del usuario actual. Se inicializa leyendo de localStorage
  // para restaurar la sesión si el usuario recargó la página.
  // Si no hay datos guardados, será null (no autenticado).
  const [user, setUser] = useState(() => authService.getStoredUser())

  // Estado de carga inicial. Se usa para evitar parpadeos de UI
  // mientras se verifica si la sesión almacenada sigue siendo válida.
  // Inicia en true y se pone en false cuando termina la verificación.
  const [isLoading, setIsLoading] = useState(true)

  // ─── EFECTO: VERIFICACIÓN DE SESIÓN AL MONTAR ─────────────────────
  // Se ejecuta una sola vez al montar el AuthProvider.
  // Verifica si el usuario guardado en localStorage tiene una sesión
  // válida en el backend (el refresh token puede haber expirado).
  useEffect(() => {
    // Flag para evitar actualizaciones de estado si el componente
    // ya se desmontó (previene memory leaks en React 18 strict mode)
    let isMounted = true

    const verify = async () => {
      // Primero verificamos si hay datos de usuario en localStorage
      const stored = authService.getStoredUser()
      if (!stored) {
        // Si no hay usuario guardado, simplemente terminamos la carga
        // y el usuario verá la página de login
        if (isMounted) setIsLoading(false)
        return
      }

      // Si hay usuario guardado, verificamos con el backend si la
      // sesión sigue siendo válida (el refresh token no expiró)
      const valid = await authService.verifySession()

      if (isMounted) {
        // Si la sesión no es válida, limpiamos el estado del usuario
        // para que el usuario tenga que iniciar sesión de nuevo
        if (!valid) setUser(null)
        // Terminamos la carga en cualquier caso
        setIsLoading(false)
      }
    }

    verify()

    // Cleanup: si el componente se desmonta antes de que termine
    // la verificación, evitamos actualizar el estado
    return () => { isMounted = false }
  }, []) // Array vacío = solo se ejecuta una vez al montar

  // ─── FUNCIÓN: INICIAR SESIÓN ──────────────────────────────────────
  // Memorizada con useCallback para evitar re-renderizados innecesarios
  // en componentes hijos que reciben esta función como prop.
  const login = useCallback(async (username, password) => {
    // Llamamos al servicio de auth que hace la petición HTTP
    const response = await authService.login(username, password)
    // Actualizamos el estado con los datos del usuario autenticado
    setUser(response.usuario)
  }, [])

  // ─── FUNCIÓN: REGISTRAR NUEVO USUARIO ─────────────────────────────
  // Llama al servicio de auth para registrar un nuevo usuario.
  // NO inicia sesión automáticamente; el usuario debe ir a login.
  const register = useCallback(async (data) => {
    await authService.register(data)
  }, [])

  // ─── FUNCIÓN: CERRAR SESIÓN ───────────────────────────────────────
  // Llama al servicio de auth para cerrar la sesión (notifica al backend
  // y limpia tokens) y luego pone el usuario en null para que la UI
  // muestre las páginas públicas.
  const logout = useCallback(async () => {
    await authService.logout()
    setUser(null)
  }, [])

  // ─── FUNCIÓN: ACTUALIZAR DATOS DEL USUARIO ───────────────────────
  // Permite actualizar parcialmente los datos del usuario en el estado
  // Y en localStorage. Se usa cuando el usuario modifica su perfil
  // (nombre, email, configuración, etc.).
  const updateUser = useCallback((newData) => {
    setUser(prev => {
      // Mezclamos los datos anteriores con los nuevos (spread operator)
      const updated = { ...prev, ...newData }
      // Guardamos en localStorage para que persista entre recargas
      localStorage.setItem('usuario:v1', JSON.stringify(updated))
      return updated
    })
  }, [])

  // ─── FUNCIÓN: VERIFICAR SESIÓN ────────────────────────────────────
  // Permite verificar manualmente si la sesión sigue siendo válida.
  // Se usa por ejemplo en ProtectedRoute o al hacer acciones sensibles.
  const checkSession = useCallback(async () => {
    const valid = await authService.verifySession()
    if (!valid) {
      // Si la sesión ya no es válida, limpiamos el usuario del estado
      setUser(null)
    }
    return valid
  }, [])

  // ─── VALOR DERIVADO: isAuthenticated ──────────────────────────────
  // Booleano que indica si hay un usuario autenticado.
  // Se calcula con !! para convertir el objeto user a booleano:
  // !!null = false, !!{...} = true
  const isAuthenticated = !!user

  // ─── VALOR DEL CONTEXTO (MEMORIZADO) ──────────────────────────────
  // useMemo evita que se cree un nuevo objeto en cada renderizado,
  // lo que causaría re-renderizados innecesarios en todos los
  // componentes hijos que consumen este contexto.
  const value = useMemo(
    () => ({ user, isAuthenticated, isLoading, login, register, logout, updateUser, checkSession }),
    [user, isAuthenticated, isLoading, login, register, logout, updateUser, checkSession]
  )

  // ─── RENDERIZADO ───────────────────────────────────────────────────
  // AuthContext.Provider provee el objeto value a todos los componentes
  // hijos que usen useAuth() o useContext(AuthContext)
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
