// ─── COMPONENTE: RUTA PROTEGIDA ───────────────────────────────────────
// Este componente actúa como guardia de ruta (route guard).
// Se coloca alrededor de las rutas que requieren autenticación y/o
// permisos de administrador. Si el usuario no cumple los requisitos,
// es redirigido automáticamente a la página correspondiente.
// Patrón común en aplicaciones con roles:wrap las rutas protegidas
// con <ProtectedRoute> en el archivo de rutas (main.jsx).

// ─── IMPORTACIONES ────────────────────────────────────────────────────
// Navigate: componente de React Router que redirige a otra ruta
// de forma declarativa (similar a un redirect)
import { Navigate } from 'react-router-dom'
// useAuth: hook personalizado para acceder al contexto de autenticación
import { useAuth } from '../contexts/useAuth'

// ─── COMPONENTE ProtectedRoute ────────────────────────────────────────
// Parámetros (props):
// - children: los componentes hijos que se renderizan si la protección pasa
// - adminOnly: booleano (default false) que indica si la ruta requiere
//   permisos de administrador. Si es true, solo los usuarios con
//   rol 'admin' pueden acceder.
export default function ProtectedRoute({ children, adminOnly = false }) {
  // Obtenemos el estado de autenticación del contexto
  const { user, isAuthenticated, isLoading } = useAuth()

  // ─── ESTADO DE CARGA ──────────────────────────────────────────────
  // Si aún se está verificando la sesión (isLoading = true), no
  // renderizamos nada (return null) para evitar un flash de contenido
  // o de redirección antes de que se confirme el estado de auth.
  if (isLoading) return null

  // ─── VERIFICACIÓN DE AUTENTICACIÓN ────────────────────────────────
  // Si el usuario NO está autenticado, lo redirigimos a la página
  // principal (/) donde puede ver el landing page y opciones de login.
  // "replace" evita que el usuario pueda volver a la ruta protegida
  // con el botón de retroceso del navegador.
  if (!isAuthenticated) return <Navigate to="/" replace />

  // ─── VERIFICACIÓN DE ROL (SOLO ADMIN) ─────────────────────────────
  // Si la ruta es adminOnly Y el usuario no tiene rol 'admin',
  // lo redirigimos a /home (página de usuario normal).
  // user?.rol usa optional chaining para evitar errores si user es null.
  if (adminOnly && user?.rol !== 'admin') return <Navigate to="/" replace />

  // ─── ACCESO PERMITIDO ─────────────────────────────────────────────
  // Si pasó todas las verificaciones, renderizamos los hijos
  // (el componente de la ruta protegida)
  return children
}
