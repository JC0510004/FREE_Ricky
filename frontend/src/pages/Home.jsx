import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import API from '../api/axios'

// ─── Configuración de dificultades ───
// Mapa estático que asocia cada clave de dificultad con su etiqueta visual y color.
// Se usa para estilizar tarjetas de niveles, badges y otros elementos del dashboard.
const difficultyConfig = {
  facil: { label: 'Fácil', color: '#22c55e' },      // Verde para niveles fáciles
  medio: { label: 'Medio', color: '#eab308' },        // Amarillo para niveles medios
  dificil: { label: 'Difícil', color: '#ef4444' },    // Rojo para niveles difíciles
}

export default function Home() {
  // ─── Hooks de navegación y autenticación ───
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, logout } = useAuth()

  // ─── Estado local del componente ───
  const [stats, setStats] = useState(null)             // Estadísticas del usuario actual
  const [ranking, setRanking] = useState([])           // Ranking global de jugadores
  const [partidas, setPartidas] = useState([])         // Historial de partidas del usuario
  const [niveles, setNiveles] = useState([])           // Lista de niveles disponibles

  // ─── Redirección si no está autenticado ───
  // Protege la ruta: si el usuario no tiene sesión activa, se redirige al login.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isLoading, isAuthenticated, navigate])

  // ─── Carga de datos del dashboard ───
  // Realiza todas las peticiones al backend en paralelo al montar el componente.
  // AbortController cancela las peticiones si el componente se desmonta para evitar memory leaks.
  useEffect(() => {
    if (!isAuthenticated) return
    const controller = new AbortController()
    const { signal } = controller
    API.get('/estadisticas/', { signal }).then(r => setStats(r.data)).catch(() => {})
    API.get('/ranking/', { signal }).then(r => setRanking(r.data)).catch(() => {})
    API.get('/partidas/', { signal }).then(r => setPartidas(r.data.results || r.data)).catch(() => {})
    API.get('/niveles/', { signal }).then(r => setNiveles(r.data.results || r.data)).catch(() => {})
    return () => controller.abort()
  }, [isAuthenticated])

  // ─── Manejador de cierre de sesión ───
  // Ejecuta logout del contexto y redirige al landing page.
  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  // ─── Pantalla de carga inicial ───
  // Se muestra mientras se verifica el estado de autenticación del usuario.
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

  // ─── Guardia de renderizado ───
  // Si no hay usuario autenticado después de cargar, no se renderiza nada.
  if (!user) return null

  return (
    <div className="gaming-dashboard">

      {/* ─── Contenido principal del dashboard ─── */}
      <main className="gaming-main">

        {/* ─── Sección hero con bienvenida y estadísticas del usuario ─── */}
        <section className="gaming-hero">
          <div className="hero-glow" />
          <div className="hero-content">
            <div className="hero-text">
              <span className="hero-greeting">Bienvenido de vuelta,</span>
              <h1 className="hero-title">{user.username}</h1>
              {/* Subtítulo que muestra resumen de estadísticas o texto de carga */}
              <p className="hero-subtitle">
                {stats ? `${stats.total_partidas} partidas jugadas · ${stats.mejor_puntuacion} pts máximos` : 'Cargando estadísticas...'}
              </p>
            </div>

            {/* Tarjetas de estadísticas resumen solo si los datos están disponibles */}
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
                  {/* Convierte el tiempo total de segundos a minutos para mostrarlo */}
                  <span className="hero-stat-value">
                    {Math.floor(stats.tiempo_total / 60)}m
                  </span>
                  <span className="hero-stat-label">Tiempo Total</span>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── Sección de niveles disponibles ─── */}
        <section className="gaming-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">▶</span>
              Niveles
            </h2>
            <span className="section-subtitle">Elige un nivel para comenzar</span>
          </div>

          {/* Cuadrícula de tarjetas de niveles */}
          <div className="levels-grid">
            {niveles.map(n => {
              // Obtiene la configuración visual de la dificultad del nivel
              const diff = difficultyConfig[n.dificultad] || { label: n.dificultad, color: '#888' }
              return (
                <div key={n.id} className="level-card" style={{ '--accent': diff.color }}>
                  <div className="level-card-glow" />
                  <div className="level-card-header">
                    {/* Badge de dificultad con color dinámico */}
                    <span className="level-difficulty" style={{ background: `${diff.color}20`, color: diff.color }}>
                      {diff.label}
                    </span>
                    {/* Tiempo límite solo se muestra si el nivel tiene restricción de tiempo */}
                    {n.tiempo_limite && (
                      <span className="level-time">{n.tiempo_limite}s</span>
                    )}
                  </div>
                  <h3 className="level-name">{n.nombre}</h3>
                  <div className="level-card-footer">
                    {/* Botón para jugar el nivel con color de acento dinámico */}
                    <button type="button" className="level-play-btn" style={{ '--btn-accent': diff.color }}>
                      JUGAR
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ─── Sección de ranking global ─── */}
        <section className="gaming-section">
          <div className="section-header">
            <h2 className="section-title">
              <span className="section-icon">🏆</span>
              Ranking Global
            </h2>
            <span className="section-subtitle">Top jugadores por puntuación</span>
          </div>

          {/* Tabla de ranking con cabecera fija */}
          <div className="gaming-table-wrap">
            <div className="gaming-table-header">
              <span className="col-pos">#</span>
              <span className="col-player">Jugador</span>
              <span className="col-score">Puntos</span>
              <span className="col-games">Partidas</span>
              <span className="col-avg">Promedio</span>
            </div>

            {/* Filas del ranking generadas dinámicamente */}
            {ranking.map(r => (
              <div key={r.usuario_id} className={`gaming-table-row ${r.usuario_id === user.id ? 'is-me' : ''}`}>
                <span className="col-pos">
                  {/* Muestra medallas para los 3 primeros puestos, número para el resto */}
                  {r.posicion <= 3 ? (
                    <span className={`medal medal-${r.posicion}`}>
                      {['🥇', '🥈', '🥉'][r.posicion - 1]}
                    </span>
                  ) : (
                    r.posicion
                  )}
                </span>
                <span className="col-player">
                  {/* Etiqueta "TÚ" para resaltar la fila del usuario actual */}
                  {r.usuario_id === user.id && <span className="you-tag">TÚ</span>}
                  {r.username}
                </span>
                <span className="col-score">{r.mejor_puntuacion?.toLocaleString() ?? '0'}</span>
                <span className="col-games">{r.total_partidas}</span>
                <span className="col-avg">{r.promedio_puntuacion}</span>
              </div>
            ))}

            {/* Mensaje vacío cuando no hay datos de ranking */}
            {ranking.length === 0 && (
              <div className="gaming-table-empty">
                Aún no hay partidas registradas. ¡Sé el primero!
              </div>
            )}
          </div>
        </section>

        {/* ─── Grid inferior: partidas recientes y perfil ─── */}
        <div className="gaming-bottom-grid">

          {/* ─── Sección de últimas partidas ─── */}
          <section className="gaming-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">⚡</span>
                Últimas Partidas
              </h2>
            </div>

            {/* Tabla de historial de partidas */}
            <div className="gaming-table-wrap">
              <div className="gaming-table-header">
                <span className="col-level">Nivel</span>
                <span className="col-score-sm">Pts</span>
                <span className="col-deaths">💀</span>
                <span className="col-time">Tiempo</span>
                <span className="col-date">Fecha</span>
              </div>

              {/* Filas de partidas jugadas */}
              {partidas.map(p => (
                <div key={p.id} className="gaming-table-row">
                  <span className="col-level">
                    {p.nivel_nombre}
                    {/* Mini badge con la inicial de la dificultad */}
                    <span className={`mini-badge ${p.nivel_dificultad}`}>
                      {p.nivel_dificultad?.[0]?.toUpperCase() || '?'}
                    </span>
                  </span>
                  <span className="col-score-sm">{p.puntuacion}</span>
                  <span className="col-deaths">{p.muertes}</span>
                  {/* Formatea el tiempo de segundos a MM:SS */}
                  <span className="col-time">
                    {p.tiempo ? `${Math.floor(p.tiempo / 60)}:${String(p.tiempo % 60).padStart(2, '0')}` : '-'}
                  </span>
                  <span className="col-date">{new Date(p.fecha).toLocaleDateString()}</span>
                </div>
              ))}

              {/* Mensaje cuando no hay partidas jugadas */}
              {partidas.length === 0 && (
                <div className="gaming-table-empty">
                  No has jugado ninguna partida aún.
                </div>
              )}
            </div>
          </section>

          {/* ─── Tarjeta de perfil del usuario ─── */}
          <section className="gaming-section gaming-profile-card">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">👤</span>
                Perfil
              </h2>
            </div>
            <div className="profile-content">
              <div className="profile-info">
                {/* Campo de email */}
                <div className="profile-field">
                  <span className="profile-label">Email</span>
                  <span className="profile-value">{user.email}</span>
                </div>
                {/* Fecha de registro formateada localmente */}
                <div className="profile-field">
                  <span className="profile-label">Miembro desde</span>
                  <span className="profile-value">{user.fecha_registro ? new Date(user.fecha_registro).toLocaleDateString() : '-'}</span>
                </div>
                {/* Badge del rol del usuario */}
                <div className="profile-field">
                  <span className="profile-label">Rol</span>
                  <span className={`gaming-badge ${user.rol}`}>
                    {user.rol === 'admin' ? 'Administrador' : 'Jugador'}
                  </span>
                </div>
              </div>
              {/* Enlace a la página de configuración para editar perfil */}
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
