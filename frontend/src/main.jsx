// ─── PUNTO DE ENTRADA DE LA APLICACIÓN REACT ──────────────────────────
// Este archivo es el punto de entrada principal de la aplicación frontend.
// Se encarga de montar el árbol de React dentro del DOM, configurar el
// enrutador y envolver todo en el proveedor de autenticación.

// ─── IMPORTACIONES DE REACT ───────────────────────────────────────────
// StrictMode activa verificaciones adicionales en desarrollo para detectar
// problemas potenciales (renderizados dobles, efectos secundarios peligrosos, etc.)
import { StrictMode, lazy, Suspense } from 'react'
// createRoot es la API moderna de React 18 para montar la aplicación en el DOM
// (reemplaza al antiguo ReactDOM.render)
import { createRoot } from 'react-dom/client'

// ─── IMPORTACIONES DEL ENRUTADOR ─────────────────────────────────────
// BrowserRouter: provee el enrutamiento basado en la URL del navegador
// Routes: contenedor que renderiza la ruta que coincida con la URL actual
// Route: define una ruta individual (asociando un path con un componente)
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// ─── IMPORTACIONES DEL CONTEXTO DE AUTENTICACIÓN ─────────────────────
// AuthProvider envuelve toda la aplicación para que cualquier componente
// hijo pueda acceder al estado de autenticación (usuario, login, logout, etc.)
import { AuthProvider } from './contexts/AuthContext'

// ─── IMPORTACIONES DE COMPONENTES ────────────────────────────────────
// ProtectedRoute es un componente de protección de rutas que redirige
// al usuario si no está autenticado o no tiene los permisos necesarios
import ProtectedRoute from './components/ProtectedRoute'

// ─── IMPORTACIONES DE PÁGINAS ────────────────────────────────────────
// App es la página principal/landing page de la aplicación.
// Se mantiene como import estático por ser la ruta inicial (carga crítica).
import App from './App.jsx'

// Las demás páginas se cargan bajo demanda (code splitting) con React.lazy():
// el navegador solo descarga el JS de cada página cuando el usuario la visita.
// - Login: página de inicio de sesión del usuario
const Login = lazy(() => import('./pages/Login.jsx'))
// - Register: página de registro de nuevos usuarios
const Register = lazy(() => import('./pages/Register.jsx'))
// - ForgotPassword: página de recuperación de contraseña
const ForgotPassword = lazy(() => import('./pages/ForgotPassword.jsx'))
// - Admin: panel de administración (solo accesible por usuarios con rol admin)
const Admin = lazy(() => import('./pages/Admin.jsx'))
// - Home: dashboard principal del juego (solo accesible por usuarios autenticados)
const Home = lazy(() => import('./pages/Home.jsx'))
// - Settings: página de configuración/cuenta del usuario
const Settings = lazy(() => import('./pages/Settings.jsx'))

// ─── ESTILOS GLOBALES ────────────────────────────────────────────────
// Se importan los estilos CSS organizados por módulos (orden importa:
// base y variables primero, responsive al final).
import './styles/base.css'
import './styles/loading.css'
import './styles/navbar.css'
import './styles/landing.css'
import './styles/auth.css'
import './styles/gaming.css'
import './styles/settings.css'
import './styles/admin.css'
import './styles/responsive.css'

// ─── MONTAJE DE LA APLICACIÓN ────────────────────────────────────────
// Se busca el elemento con id="root" en el HTML y se monta el árbol de React.
// La estructura de jerarquía es:
//   StrictMode → BrowserRouter → AuthProvider → Routes (páginas)
//
// StrictMode solo afecta en modo desarrollo, no tiene impacto en producción.
// El orden importa: BrowserRouter debe estar fuera de AuthProvider porque
// AuthProvider puede necesitar usar hooks de navegación.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ─── RUTA PRINCIPAL (LANDING PAGE) ────────────────── */}
          {/* La ruta "/" muestra la página de aterrizaje pública */}
          <Route path="/" element={<App />} />

          {/* ─── SUSPENSE: fallback mientras se descarga cada página ─── */}
          {/* Las rutas lazy necesitan Suspense para mostrar un placeholder
              mientras el lazy() resuelve el chunk JS de la página */}
          <Route path="/login" element={
            <Suspense fallback={<div className="route-loading"><span className="spinner" /></div>}>
              <Login />
            </Suspense>
          } />

          {/* ─── RUTA DE REGISTRO ─────────────────────────────── */}
          {/* Permite a nuevos usuarios crear una cuenta */}
          <Route path="/register" element={
            <Suspense fallback={<div className="route-loading"><span className="spinner" /></div>}>
              <Register />
            </Suspense>
          } />

          {/* ─── RUTA DE RECUPERACIÓN DE CONTRASEÑA ───────────── */}
          {/* Permite al usuario recuperar su contraseña olvidada */}
          <Route path="/forgot-password" element={
            <Suspense fallback={<div className="route-loading"><span className="spinner" /></div>}>
              <ForgotPassword />
            </Suspense>
          } />

          {/* ─── RUTA PROTEGIDA: DASHBOARD DEL JUEGO ─────── */}
          {/* Requiere autenticación. Muestra niveles, ranking y partidas */}
          <Route path="/home" element={
            <Suspense fallback={<div className="route-loading"><span className="spinner" /></div>}>
              <ProtectedRoute><Home /></ProtectedRoute>
            </Suspense>
          } />

          {/* ─── RUTA PROTEGIDA: PANEL DE ADMINISTRACIÓN ──────── */}
          {/* adminOnly = true indica que solo los usuarios con rol 'admin'
              pueden acceder a esta ruta. Si el usuario no es admin,
              será redirigido a /home */}
          <Route path="/admin" element={
            <Suspense fallback={<div className="route-loading"><span className="spinner" /></div>}>
              <ProtectedRoute adminOnly><Admin /></ProtectedRoute>
            </Suspense>
          } />

          {/* ─── RUTA PROTEGIDA: CONFIGURACIÓN ────────────────── */}
          {/* Requiere autenticación pero no permisos de admin */}
          <Route path="/settings" element={
            <Suspense fallback={<div className="route-loading"><span className="spinner" /></div>}>
              <ProtectedRoute><Settings /></ProtectedRoute>
            </Suspense>
          } />

          {/* ─── RUTA CATCH-ALL: 404 ──────────────────────────── */}
          {/* Captura cualquier URL no definida y redirige a la landing page */}
          <Route path="*" element={<App />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
