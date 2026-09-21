import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import useFetch from '../hooks/useFetch'
import {
  ArrowLeft, BarChart3, Clock3, Gamepad2, LogOut,
  Medal, Play, Swords, Trophy, Zap
} from 'lucide-react'
import '../dashboard.css'

// ─── Utilidades de formato ─────────────────────────────────────────
// Formatea segundos como "2h 13m" o "4m" para mostrar el tiempo total jugado.
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0m'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.round((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

// Formatea números con separador de miles (12,840).
function formatNumber(value) {
  if (value === null || value === undefined) return '0'
  return Number(value).toLocaleString('es-ES')
}

// Mapea la dificultad del backend a la etiqueta y el tono del badge CSS.
const DIFICULTAD = {
  facil: { label: 'Fácil', tone: 'easy' },
  medio: { label: 'Medio', tone: 'medium' },
  dificil: { label: 'Difícil', tone: 'hard' },
}
const DIFICULTAD_ICON = [Trophy, Swords, Gamepad2, Zap]

export default function Home() {
  const { user, logout } = useAuth()

  // ─── Datos desde la API real ────────────────────────────────────
  // El backend expone estadísticas, niveles, ranking y partidas del usuario.
  const { data: stats, loading: loadingStats, error: statsError } = useFetch('/estadisticas/')
  const { data: niveles, loading: loadingNiveles, error: nivelesError } = useFetch('/niveles/')
  const { data: rankingData, loading: loadingRanking, error: rankingError } = useFetch('/ranking/')
  const { data: partidasData, loading: loadingPartidas, error: partidasError } = useFetch('/partidas/')

  // Si alguna de las peticiones falló (401, 500, red...), lo mostramos en
  // lugar de inventar estados "vacíos" que confunden al usuario.
  const fetchError = statsError || nivelesError || rankingError || partidasError

  // ─── Extracción segura de datos paginados ───────────────────────
  const nivelesList = niveles?.results || niveles || []
  const partidas = partidasData?.results || partidasData || []

  // Niveles que el usuario ya completó (tiene al menos una partida registrada).
  const nivelIdsJugados = new Set(partidas.map((p) => p.nivel))

  // Tarjetas de estadísticas construidas con los datos reales.
  const statsCards = [
    {
      label: 'Partidas jugadas',
      value: statsError ? '—' : loadingStats ? '...' : formatNumber(stats?.total_partidas),
      detail: 'En la arena',
      Icon: Gamepad2,
    },
    {
      label: 'Mejor score',
      value: statsError ? '—' : loadingStats ? '...' : formatNumber(stats?.mejor_puntuacion),
      detail: 'Récord personal',
      Icon: Trophy,
    },
    {
      label: 'Promedio',
      value: statsError ? '—' : loadingStats ? '...' : formatNumber(stats?.promedio_puntuacion),
      detail: 'Por partida',
      Icon: BarChart3,
    },
    {
      label: 'Tiempo total',
      value: statsError ? '—' : loadingStats ? '...' : formatDuration(stats?.tiempo_total),
      detail: 'En la arena',
      Icon: Clock3,
    },
  ]

  const usuarioEsAdmin = user?.rol === 'admin'

  return (
    <div className="fr-dash">
      <main className="fr-main">

        {/* ── Header ── */}
        <header className="fr-header">
          <Link className="fr-btn-back" to="/">
            <ArrowLeft size={16} />Volver al inicio
          </Link>
          <div className="fr-header-brand">
            <span className="fr-brand-mark"><Gamepad2 size={16} /></span>
            <span>FREE_RICKY</span>
          </div>
          <button className="fr-btn-logout" type="button" onClick={() => logout()}>
            <LogOut size={16} />
            <span className="fr-btn-logout-text">Cerrar sesión</span>
          </button>
        </header>

        <div className="fr-container" style={{ paddingTop: '2.5rem', paddingBottom: '2.5rem' }}>

          {/* ── Hero ── */}
          <div className="fr-hero">
            <p className="fr-eyebrow">Panel de jugador</p>
            <h1 className="fr-title">{user?.username || 'Jugador'}</h1>
            <p className="fr-subtitle">Listo para superar tu próximo récord?</p>
          </div>

          {/* ── Error de carga ── */}
          {fetchError && (
            <div className="fr-error" style={{ marginBottom: '1.25rem' }}>
              No se pudieron cargar los datos. Verifica tu conexión e inténtalo de nuevo.
            </div>
          )}

          {/* ── Stats ── */}
          <div className="fr-grid-2">
            {statsCards.map(({ label, value, detail, Icon }, i) => (
              <article className="fr-card fr-animate" key={label} style={{ animationDelay: `${i * 90}ms` }}>
                <div className="fr-card-header">
                  <span className="fr-icon-tile"><Icon size={16} /></span>
                  <span className="fr-stat-number">0{i + 1}</span>
                </div>
                <p className="fr-stat-num">{value}</p>
                <p className="fr-stat-label">{label}</p>
                <p className="fr-stat-detail">{detail}</p>
              </article>
            ))}
          </div>

          <div className="fr-grid-sidebar" style={{ marginTop: '2.5rem' }}>
            <div className="fr-col-stack">

              {/* ── Niveles ── */}
              <section>
                <div className="fr-section-header">
                  <div className="fr-section-header-text">
                    <p className="fr-eyebrow">Explora la arena</p>
                    <h2 className="fr-section-title">Niveles</h2>
                  </div>
                  <span className="fr-section-meta">
                    {loadingNiveles ? 'Cargando...' : `${nivelesList.length} disponibles`}
                  </span>
                </div>
                <div className="fr-grid-levels">
                  {nivelesList.map((nivel, i) => {
                    const dif = DIFICULTAD[nivel.dificultad] || { label: nivel.dificultad, tone: 'hard' }
                    const Icon = DIFICULTAD_ICON[i % DIFICULTAD_ICON.length]
                    const completado = nivelIdsJugados.has(nivel.id)
                    return (
                      <article className="fr-card" key={nivel.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                          <span className="fr-icon-tile fr-icon-tile-play" style={{ transition: 'all .3s' }}><Icon size={20} /></span>
                          <span className={`fr-badge fr-badge-${dif.tone}`}>{dif.label}</span>
                        </div>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{nivel.nombre}</h3>
                        <p style={{ fontSize: '.75rem', color: 'var(--fr-muted-fg)', marginTop: '.25rem' }}>
                          {completado ? 'Completado' : 'Nuevo desafío'}
                        </p>
                        <button
                          className="fr-btn-primary"
                          type="button"
                          style={{ marginTop: '1.25rem' }}
                          disabled
                          title="Próximamente disponible"
                        >
                          <Play size={14} fill="currentColor" />Próximamente
                        </button>
                      </article>
                    )
                  })}
                  {!loadingNiveles && !nivelesError && nivelesList.length === 0 && (
                    <div className="fr-empty-state" style={{ gridColumn: '1 / -1' }}>
                      <Gamepad2 size={28} style={{ opacity: .7, color: 'var(--fr-primary)' }} />
                      <p style={{ marginTop: '.75rem', fontWeight: 500 }}>No hay niveles disponibles</p>
                    </div>
                  )}
                </div>
              </section>

              {/* ── Ranking ── */}
              <section>
                <div className="fr-section-header">
                  <div className="fr-section-header-text">
                    <p className="fr-eyebrow">La competición</p>
                    <h2 className="fr-section-title">Ranking Global</h2>
                  </div>
                </div>
                <div className="fr-table-wrap">
                  <table className="fr-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Jugador</th><th>Puntos</th><th>Partidas</th><th>Promedio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(loadingRanking ? [] : rankingData || []).map((entry, i) => {
const esYo = entry.username === user?.username
                          return (
                            <tr key={entry.username} className={esYo ? 'fr-current-row' : ''}>
                            <td>{i === 0 ? <Medal size={16} style={{ color: 'var(--fr-primary)' }} /> : i + 1}</td>
                            <td className="fr-bold">
                              {entry.username}
                              {esYo && <span className="fr-badge fr-badge-hard fr-badge-inline">TÚ</span>}
                            </td>
                            <td className="fr-mono">{formatNumber(entry.mejor_puntuacion)}</td>
                            <td>{entry.total_partidas}</td>
                            <td className="fr-mono" style={{ color: 'var(--fr-primary)' }}>
                              {entry.promedio_puntuacion != null ? formatNumber(entry.promedio_puntuacion) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                      {!loadingRanking && !rankingError && (rankingData || []).length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fr-muted-fg)' }}>
                            Aún no hay jugadores en el ranking
                          </td>
                        </tr>
                      )}
                      {loadingRanking && (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--fr-muted-fg)' }}>
                            Cargando ranking...
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ── Últimas partidas ── */}
              <section>
                <div className="fr-section-header">
                  <div className="fr-section-header-text">
                    <p className="fr-eyebrow">Tu historial</p>
                    <h2 className="fr-section-title">Últimas Partidas</h2>
                  </div>
                </div>
                {loadingPartidas ? (
                  <div className="fr-empty-state">
                    <Clock3 size={28} style={{ opacity: .7, color: 'var(--fr-primary)' }} />
                    <p style={{ marginTop: '.75rem', fontWeight: 500 }}>Cargando historial...</p>
                  </div>
                ) : partidasError ? (
                  <div className="fr-empty-state">
                    <Clock3 size={28} style={{ opacity: .7, color: 'var(--fr-primary)' }} />
                    <p style={{ marginTop: '.75rem', fontWeight: 500 }}>No se pudo cargar tu historial</p>
                  </div>
                ) : partidas.length === 0 ? (
                  <div className="fr-empty-state">
                    <Clock3 size={28} style={{ opacity: .7, color: 'var(--fr-primary)' }} />
                    <p style={{ marginTop: '.75rem', fontWeight: 500 }}>No has jugado ninguna partida aún</p>
                    <p style={{ marginTop: '.25rem', fontSize: '.75rem', color: 'var(--fr-muted-fg)' }}>Completa un nivel para ver tu actividad aquí</p>
                  </div>
                ) : (
                  <div className="fr-table-wrap">
                    <table className="fr-table">
                      <thead>
                        <tr>
                          <th>Nivel</th><th>Puntaje</th><th>Muertes</th><th>Tiempo</th><th>Fecha</th>
                        </tr>
                      </thead>
                      <tbody>
                        {partidas.slice(0, 5).map((p) => (
                          <tr key={p.id}>
                            <td className="fr-bold">{p.nivel_nombre}</td>
                            <td className="fr-mono" style={{ color: 'var(--fr-primary)' }}>{formatNumber(p.puntuacion)}</td>
                            <td>{p.muertes}</td>
                            <td>{formatDuration(p.tiempo)}</td>
                            <td style={{ color: 'var(--fr-muted-fg)' }}>
                              {new Date(p.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            {/* ── Perfil sidebar ── */}
            <aside>
              <div className="fr-profile-card">
                <div className="fr-profile-header">
                  <div className="fr-avatar">{(user?.username || 'J').charAt(0).toUpperCase()}</div>
                  <div>
                    <p style={{ fontWeight: 600 }}>Perfil</p>
                    <p style={{ fontSize: '.75rem', color: 'var(--fr-muted-fg)' }}>Cuenta personal</p>
                  </div>
                </div>
                <div className="fr-profile-body">
                  <div>
                    <p className="fr-label">Email</p>
                    <p className="fr-profile-value" style={{ wordBreak: 'break-all' }}>{user?.email || '—'}</p>
                  </div>
                  {user?.fecha_registro && (
                    <div>
                      <p className="fr-label">Miembro desde</p>
                      <p className="fr-profile-value">
                        {new Date(user.fecha_registro).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="fr-label">Rol</p>
                    <span className={`fr-badge ${usuarioEsAdmin ? 'fr-badge-hard' : 'fr-badge-easy'}`} style={{ marginTop: '.5rem' }}>
                      {usuarioEsAdmin ? 'Administrador' : 'Jugador'}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>

        </div>
      </main>
    </div>
  )
}