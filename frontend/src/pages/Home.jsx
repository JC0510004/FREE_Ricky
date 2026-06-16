import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Home() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, logout, checkSession } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [isLoading, isAuthenticated, navigate])

  const handleLogout = async () => {
    setLoggingOut(true)
    await logout()
    navigate('/')
  }

  if (isLoading) {
    return (
      <div className="auth-page">
        <div className="loading-content" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="loading-dots">
            <div className="dot" />
            <div className="dot" />
            <div className="dot" />
          </div>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="auth-page">
      <nav className="dashboard-nav">
        <div className="dashboard-nav-inner">
          <Link to="/" className="dashboard-logo">SALT BORN</Link>
          <div className="dashboard-nav-links">
            <Link to="/home" className="dashboard-nav-link active">Inicio</Link>
            {user.rol === 'admin' && (
              <Link to="/admin" className="dashboard-nav-link">Admin</Link>
            )}
            <Link to="/settings" className="dashboard-nav-link">Configuración</Link>
          </div>
          <div className="dashboard-user-area">
            <span className="dashboard-username">{user.username}</span>
            <span className={`dashboard-role ${user.rol}`}>{user.rol === 'admin' ? 'Admin' : 'Jugador'}</span>
            <button className="dashboard-logout-btn" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? '...' : 'Cerrar Sesión'}
            </button>
          </div>
        </div>
      </nav>

      <main className="dashboard-main">
        <div className="dashboard-welcome">
          <h1>Bienvenido, {user.username}</h1>
          <p>Has iniciado sesión como <strong>{user.rol === 'admin' ? 'Administrador' : 'Jugador'}</strong></p>
        </div>

        <div className="dashboard-cards">
          <div className="dashboard-card">
            <span className="material-symbols-outlined dashboard-card-icon">person</span>
            <h3>Perfil</h3>
            <p>{user.email}</p>
            <p className="dashboard-card-meta">Miembro desde {new Date(user.fecha_registro).toLocaleDateString()}</p>
          </div>

          {user.rol === 'admin' && (
            <Link to="/admin" className="dashboard-card dashboard-card-link">
              <span className="material-symbols-outlined dashboard-card-icon">admin_panel_settings</span>
              <h3>Panel Admin</h3>
              <p>Gestiona usuarios del sistema</p>
            </Link>
          )}

          <Link to="/settings" className="dashboard-card dashboard-card-link">
            <span className="material-symbols-outlined dashboard-card-icon">settings</span>
            <h3>Configuración</h3>
            <p>Actualiza tus datos personales</p>
          </Link>
        </div>
      </main>
    </div>
  )
}
