// ─── HOOK PERSONALIZADO: useAuth ──────────────────────────────────────
// Este hook proporciona una forma segura y cómoda de acceder al contexto
// de autenticación desde cualquier componente. Internamente usa
// useContext(AuthContext) pero agrega una validación para asegurar que
// el hook se use dentro de un AuthProvider.
// En lugar de usar useContext(AuthContext) directamente en cada componente,
// usamos useAuth() que incluye el manejo de errores.

// ─── IMPORTACIONES ────────────────────────────────────────────────────
// useContext: hook de React para consumir un contexto
import { useContext } from 'react'
// AuthContext: el contexto de autenticación definido en auth-context.js
import { AuthContext } from './auth-context'

// ─── HOOK useAuth ─────────────────────────────────────────────────────
// Retorna el objeto de contexto de autenticación que contiene:
// user, isAuthenticated, isLoading, login, register, logout,
// updateUser, checkSession
export function useAuth() {
  // Obtenemos el valor del contexto. Si el componente no está dentro
  // de un AuthProvider, el valor será null (el valor por defecto del createContext)
  const context = useContext(AuthContext)

  // Validación de seguridad: si el hook se usa fuera de un AuthProvider,
  // lanzamos un error claro que indica al desarrollador qué está mal.
  // Esto previene errores silenciosos difíciles de depurar como
  // "Cannot read property 'login' of null".
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  // Devolvemos el contexto con todos los valores y funciones de autenticación
  return context
}
