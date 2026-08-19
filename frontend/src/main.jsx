// ─── PUNTO DE ENTRADA DE LA APLICACIÓN REACT ──────────────────────────
// Este archivo es el punto de entrada principal de la aplicación frontend.
// Se encarga de montar el árbol de React dentro del DOM, configurar el
// enrutador y envolver todo en el proveedor de autenticación.

// ─── IMPORTACIONES DE REACT ───────────────────────────────────────────
// StrictMode activa verificaciones adicionales en desarrollo para detectar
// problemas potenciales (renderizados dobles, efectos secundarios peligrosos, etc.)
import { StrictMode } from 'react'
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
// App es la página principal/landing page de la aplicación
import App from './App.jsx'
// Login: página de inicio de sesión del usuario
import Login from './pages/Login.jsx'
// Register: página de registro de nuevos usuarios
import Register from './pages/Register.jsx'
// ForgotPassword: página de recuperación de contraseña
import ForgotPassword from './pages/ForgotPassword.jsx'
// Admin: panel de administración (solo accesible por usuarios con rol admin)
import Admin from './pages/Admin.jsx'
// Settings: página de configuración/cuenta del usuario
import Settings from './pages/Settings.jsx'

// ─── ESTILOS GLOBALES ────────────────────────────────────────────────
// Se importan los estilos CSS globales que aplican a toda la aplicación
// (tipografía, reset de estilos, variables CSS, etc.)
import './index.css'

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

          {/* ─── RUTA DE INICIO DE SESIÓN ─────────────────────── */}
          {/* Permite a los usuarios existentes autenticarse */}
          <Route path="/login" element={<Login />} />

          {/* ─── RUTA DE REGISTRO ─────────────────────────────── */}
          {/* Permite a nuevos usuarios crear una cuenta */}
          <Route path="/register" element={<Register />} />

          {/* ─── RUTA DE RECUPERACIÓN DE CONTRASEÑA ───────────── */}
          {/* Permite al usuario recuperar su contraseña olvidada */}
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* ─── RUTA PROTEGIDA: PANEL DE ADMINISTRACIÓN ──────── */}
          {/* adminOnly = true indica que solo los usuarios con rol 'admin'
              pueden acceder a esta ruta. Si el usuario no es admin,
              será redirigido a /home */}
          <Route path="/admin" element={<ProtectedRoute adminOnly><Admin /></ProtectedRoute>} />

          {/* ─── RUTA PROTEGIDA: CONFIGURACIÓN ────────────────── */}
          {/* Requiere autenticación pero no permisos de admin */}
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
