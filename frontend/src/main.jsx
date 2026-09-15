import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import App from './App.jsx'
import {
  Login, Register, ForgotPassword, Admin, Home, Settings
} from './routes/lazyPages'

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
// Adjunta el árbol de React al elemento #root. La jerarquía es:
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

          <Route path="/register" element={
            <Suspense fallback={<div className="route-loading"><span className="spinner" /></div>}>
              <Register />
            </Suspense>
          } />

          <Route path="/forgot-password" element={
            <Suspense fallback={<div className="route-loading"><span className="spinner" /></div>}>
              <ForgotPassword />
            </Suspense>
          } />

          {/* ─── RUTA PROTEGIDA: DASHBOARD DEL JUEGO ─────────── */}
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
