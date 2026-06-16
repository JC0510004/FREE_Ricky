import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import API from '../api/axios'

export default function Home() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [stats, setStats] = useState(null)
  const [ranking, setRanking] = useState([])
  const [partidas, setPartidas] = useState([])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [isLoading, isAuthenticated, navigate])

  useEffect(() => {
    if (!isAuthenticated) return
    API.get('/estadisticas/').then(r => setStats(r.data)).catch(() => {})
    API.get('/ranking/').then(r => setRanking(r.data)).catch(() => {})
    API.get('/partidas/').then(r => setPartidas(r.data)).catch(() => {})
  }, [isAuthenticated])

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

        {stats && (
          <div className="dashboard-cards">
            <div className="dashboard-card dashboard-stat">
              <span className="material-symbols-outlined dashboard-card-icon">sports_esports</span>
              <h3>Partidas</h3>
              <p className="stat-number">{stats.total_partidas}</p>
              <p className="dashboard-card-meta">jugadas</p>
            </div>
            <div className="dashboard-card dashboard-stat">
              <span className="material-symbols-outlined dashboard-card-icon">star</span>
              <h3>Mejor Puntuación</h3>
              <p className="stat-number">{stats.mejor_puntuacion}</p>
              <p className="dashboard-card-meta">puntos</p>
            </div>
            <div className="dashboard-card dashboard-stat">
              <span className="material-symbols-outlined dashboard-card-icon">trending_up</span>
              <h3>Promedio</h3>
              <p className="stat-number">{stats.promedio_puntuacion}</p>
              <p className="dashboard-card-meta">puntos x partida</p>
            </div>
            <div className="dashboard-card dashboard-stat">
              <span className="material-symbols-outlined dashboard-card-icon">schedule</span>
              <h3>Tiempo Total</h3>
              <p className="stat-number">{Math.floor(stats.tiempo_total / 60)}m {stats.tiempo_total % 60}s</p>
              <p className="dashboard-card-meta">en juego</p>
            </div>
          </div>
        )}

        <div className="dashboard-cards">
          <div className="dashboard-card" style={{ flex: 1 }}>
            <span className="material-symbols-outlined dashboard-card-icon">person</span>
            <h3>Perfil</h3>
            <p>{user.email}</p>
            <p className="dashboard-card-meta">Miembro desde {new Date(user.fecha_registro).toLocaleDateString()}</p>
          </div>

          {user.rol === 'admin' && (
            <Link to="/admin" className="dashboard-card dashboard-card-link" style={{ flex: 1 }}>
              <span className="material-symbols-outlined dashboard-card-icon">admin_panel_settings</span>
              <h3>Panel Admin</h3>
              <p>Gestiona usuarios del sistema</p>
            </Link>
          )}

          <Link to="/settings" className="dashboard-card dashboard-card-link" style={{ flex: 1 }}>
            <span className="material-symbols-outlined dashboard-card-icon">settings</span>
            <h3>Configuración</h3>
            <p>Actualiza tus datos personales</p>
          </Link>
        </div>

        {ranking.length > 0 && (
          <div className="dashboard-section">
            <h2 className="section-title">Ranking Global</h2>
            <div className="ranking-table">
              <div className="ranking-header">
                <span className="rank-pos">#</span>
                <span className="rank-user">Jugador</span>
                <span className="rank-score">Mejor Punt.</span>
                <span className="rank-games">Partidas</span>
                <span className="rank-avg">Promedio</span>
              </div>
              {ranking.map(r => (
                <div key={r.usuario_id} className={`ranking-row ${r.usuario_id === user.id ? 'is-me' : ''}`}>
                  <span className="rank-pos">{r.posicion}</span>
                  <span className="rank-user">{r.username}</span>
                  <span className="rank-score">{r.mejor_puntuacion}</span>
                  <span className="rank-games">{r.total_partidas}</span>
                  <span className="rank-avg">{r.promedio_puntuacion}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {partidas.length > 0 && (
          <div className="dashboard-section">
            <h2 className="section-title">Últimas Partidas</h2>
            <div className="ranking-table">
              <div className="ranking-header">
                <span className="rank-game">Nivel</span>
                <span className="rank-score">Punt.</span>
                <span className="rank-deaths">Muertes</span>
                <span className="rank-time">Tiempo</span>
                <span className="rank-date">Fecha</span>
              </div>
              {partidas.map(p => (
                <div key={p.id} className="ranking-row">
                  <span className="rank-game">
                    {p.nivel_nombre}
                    <span className={`difficulty-badge ${p.nivel_dificultad}`}>{p.nivel_dificultad}</span>
                  </span>
                  <span className="rank-score">{p.puntuacion}</span>
                  <span className="rank-deaths">{p.muertes}</span>
                  <span className="rank-time">{p.tiempo ? `${Math.floor(p.tiempo / 60)}:${String(p.tiempo % 60).padStart(2, '0')}` : '-'}</span>
                  <span className="rank-date">{new Date(p.fecha).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
