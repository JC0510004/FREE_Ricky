import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import API from '../api/axios'

const difficultyConfig = {
  facil: { label: 'Fácil', color: '#22c55e' },
  medio: { label: 'Medio', color: '#eab308' },
  dificil: { label: 'Difícil', color: '#ef4444' },
}

export default function Home() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)
  const [stats, setStats] = useState(null)
  const [ranking, setRanking] = useState([])
  const [partidas, setPartidas] = useState([])
  const [niveles, setNiveles] = useState([])

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isLoading, isAuthenticated, navigate])

  useEffect(() => {
    if (!isAuthenticated) return
    API.get('/estadisticas/').then(r => setStats(r.data)).catch(() => {})
    API.get('/ranking/').then(r => setRanking(r.data)).catch(() => {})
    API.get('/partidas/').then(r => setPartidas(r.data)).catch(() => {})
    API.get('/niveles/').then(r => setNiveles(r.data)).catch(() => {})
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
    <div className="gaming-dashboard">
      <nav className="gaming-nav">
        <div className="gaming-nav-inner">
          <Link to="/" className="gaming-logo">
            <span className="logo-icon">⬡</span>
            SALT BORN
          </Link>
          <div className="gaming-nav-links">
            <Link to="/home" className="gaming-nav-link active">Inicio</Link>
            {user.rol === 'admin' && (
              <Link to="/admin" className="gaming-nav-link">Admin</Link>
            )}
            <Link to="/settings" className="gaming-nav-link">Configuración</Link>
          </div>
          <div className="gaming-user-area">
            <div className="gaming-user-info">
              <div className="gaming-avatar">
                {user.username[0].toUpperCase()}
              </div>
              <div className="gaming-user-text">
                <span className="gaming-username">{user.username}</span>
                <span className={`gaming-badge ${user.rol}`}>
                  {user.rol === 'admin' ? 'Administrador' : 'Jugador'}
                </span>
              </div>
            </div>
            <button type="button" className="gaming-logout-btn" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? '...' : 'Salir'}
            </button>
          </div>
        </div>
      </nav>

      <main className="gaming-main">
        <section className="gaming-hero">
          <div className="hero-glow" />
          <div className="hero-content">
            <div className="hero-text">
              <span className="hero-greeting">Bienvenido de vuelta,</span>
              <h1 className="hero-title">{user.username}</h1>
              <p className="hero-subtitle">
                {stats ? `${stats.total_partidas} partidas jugadas · ${stats.mejor_puntuacion} pts máximos` : 'Cargando estadísticas...'}
              </p>
            </div>
            {stats && (
              <div className="hero-stats">
                <div className="hero-stat">
                  <span className="hero-stat-value">{stats.total_partidas}</span>
                  <span className="hero-stat-label">Partidas</span>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-value">{stats.mejor_puntuacion}</span>
                  <span className="hero-stat-label">Mejor Score</span>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-value">{stats.promedio_puntuacion}</span>
                  <span className="hero-stat-label">Promedio</span>
                </div>
                <div className="hero-stat">
                  <span className="hero-stat-value">
                    {Math.floor(stats.tiempo_total / 60)}m
                  </span>
                  <span className="hero-stat-label">Tiempo Total</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="gaming-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">▶</span>
              Niveles
            </h2>
            <span className="section-subtitle">Elige un nivel para comenzar</span>
          </div>
          <div className="levels-grid">
            {niveles.map(n => {
              const diff = difficultyConfig[n.dificultad] || { label: n.dificultad, color: '#888' }
              return (
                <div key={n.id} className="level-card" style={{ '--accent': diff.color }}>
                  <div className="level-card-glow" />
                  <div className="level-card-header">
                    <span className="level-difficulty" style={{ background: `${diff.color}20`, color: diff.color }}>
                      {diff.label}
                    </span>
                    {n.tiempo_limite && (
                      <span className="level-time">{n.tiempo_limite}s</span>
                    )}
                  </div>
                  <h3 className="level-name">{n.nombre}</h3>
                  <div className="level-card-footer">
                    <button type="button" className="level-play-btn" style={{ '--btn-accent': diff.color }}>
                      JUGAR
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="gaming-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🏆</span>
              Ranking Global
            </h2>
            <span className="section-subtitle">Top jugadores por puntuación</span>
          </div>
          <div className="gaming-table-wrap">
            <div className="gaming-table-header">
              <span className="col-pos">#</span>
              <span className="col-player">Jugador</span>
              <span className="col-score">Puntos</span>
              <span className="col-games">Partidas</span>
              <span className="col-avg">Promedio</span>
            </div>
            {ranking.map(r => (
              <div key={r.usuario_id} className={`gaming-table-row ${r.usuario_id === user.id ? 'is-me' : ''}`}>
                <span className="col-pos">
                  {r.posicion <= 3 ? (
                    <span className={`medal medal-${r.posicion}`}>
                      {['🥇', '🥈', '🥉'][r.posicion - 1]}
                    </span>
                  ) : (
                    r.posicion
                  )}
                </span>
                <span className="col-player">
                  {r.usuario_id === user.id && <span className="you-tag">TÚ</span>}
                  {r.username}
                </span>
                <span className="col-score">{r.mejor_puntuacion.toLocaleString()}</span>
                <span className="col-games">{r.total_partidas}</span>
                <span className="col-avg">{r.promedio_puntuacion}</span>
              </div>
            ))}
            {ranking.length === 0 && (
              <div className="gaming-table-empty">
                Aún no hay partidas registradas. ¡Sé el primero!
              </div>
            )}
          </div>
        </section>

        <div className="gaming-bottom-grid">
          <section className="gaming-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">⚡</span>
                Últimas Partidas
              </h2>
            </div>
            <div className="gaming-table-wrap">
              <div className="gaming-table-header">
                <span className="col-level">Nivel</span>
                <span className="col-score-sm">Pts</span>
                <span className="col-deaths">💀</span>
                <span className="col-time">Tiempo</span>
                <span className="col-date">Fecha</span>
              </div>
              {partidas.map(p => (
                <div key={p.id} className="gaming-table-row">
                  <span className="col-level">
                    {p.nivel_nombre}
                    <span className={`mini-badge ${p.nivel_dificultad}`}>
                      {p.nivel_dificultad[0].toUpperCase()}
                    </span>
                  </span>
                  <span className="col-score-sm">{p.puntuacion}</span>
                  <span className="col-deaths">{p.muertes}</span>
                  <span className="col-time">
                    {p.tiempo ? `${Math.floor(p.tiempo / 60)}:${String(p.tiempo % 60).padStart(2, '0')}` : '-'}
                  </span>
                  <span className="col-date">{new Date(p.fecha).toLocaleDateString()}</span>
                </div>
              ))}
              {partidas.length === 0 && (
                <div className="gaming-table-empty">
                  No has jugado ninguna partida aún.
                </div>
              )}
            </div>
          </section>

          <section className="gaming-section gaming-profile-card">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">👤</span>
                Perfil
              </h2>
            </div>
            <div className="profile-content">
              <div className="profile-info">
                <div className="profile-field">
                  <span className="profile-label">Email</span>
                  <span className="profile-value">{user.email}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Miembro desde</span>
                  <span className="profile-value">{new Date(user.fecha_registro).toLocaleDateString()}</span>
                </div>
                <div className="profile-field">
                  <span className="profile-label">Rol</span>
                  <span className={`gaming-badge ${user.rol}`}>
                    {user.rol === 'admin' ? 'Administrador' : 'Jugador'}
                  </span>
                </div>
              </div>
              <Link to="/settings" className="profile-edit-btn">
                Editar Perfil
              </Link>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
