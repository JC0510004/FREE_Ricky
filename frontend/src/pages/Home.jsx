import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/useAuth'
import {
  ArrowLeft, BarChart3, Clock3, Gamepad2, LogOut,
  Medal, Play, ShieldCheck, Swords, Trophy, Zap
} from 'lucide-react'
import '../dashboard.css'

const stats = [
  ['Partidas jugadas', '24', '+4 este mes', Gamepad2],
  ['Mejor score', '842', 'Récord personal', Trophy],
  ['Promedio', '392.5', 'Por partida', BarChart3],
  ['Tiempo total', '08h 42m', 'En la arena', Clock3],
]

const levels = [
  ['La Cima', 'Difícil', 'hard', Trophy],
  ['La Mazmorra', 'Difícil', 'hard', Swords],
  ['Introducción', 'Fácil', 'easy', Gamepad2],
  ['El Bosque', 'Medio', 'medium', Zap],
]

const ranking = [
  ['NEXUS_07', '12,840', '34', '377.6'],
  ['PixelKnight', '11,560', '29', '398.6'],
  ['ADMIN123', '9,420', '24', '392.5'],
  ['LunaByte', '8,975', '27', '332.4'],
  ['GameMaster', '8,310', '22', '377.7'],
]

export default function Home() {
  const { user, logout } = useAuth()
  const [active, setActive] = useState('')

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

          {/* ── Stats ── */}
          <div className="fr-grid-2">
            {stats.map(([label, value, detail, Icon], i) => (
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
                  <span className="fr-section-meta">4 disponibles</span>
                </div>
                <div className="fr-grid-levels">
                  {levels.map(([name, difficulty, tone, Icon]) => (
                    <article className="fr-card" key={name}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                        <span className="fr-icon-tile fr-icon-tile-play" style={{ transition: 'all .3s' }}><Icon size={20} /></span>
                        <span className={`fr-badge fr-badge-${tone}`}>{difficulty}</span>
                      </div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{name}</h3>
                      <p style={{ fontSize: '.75rem', color: 'var(--fr-muted-fg)', marginTop: '.25rem' }}>
                        {name === 'Introducción' ? 'Completado' : 'Nuevo desafío'}
                      </p>
                      <button className="fr-btn-primary" type="button" style={{ marginTop: '1.25rem' }} onClick={() => setActive(name)}>
                        <Play size={14} fill="currentColor" />{active === name ? 'Cargando...' : 'Jugar'}
                      </button>
                    </article>
                  ))}
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
                      {ranking.map(([name, points, games, average], i) => (
                        <tr key={name} className={name === 'ADMIN123' ? 'fr-current-row' : ''}>
                          <td>{i === 0 ? <Medal size={16} style={{ color: 'var(--fr-primary)' }} /> : i + 1}</td>
                          <td className="fr-bold">
                            {name}
                            {name === 'ADMIN123' && <span className="fr-badge fr-badge-hard fr-badge-inline">TÚ</span>}
                          </td>
                          <td className="fr-mono">{points}</td>
                          <td>{games}</td>
                          <td className="fr-mono" style={{ color: 'var(--fr-primary)' }}>{average}</td>
                        </tr>
                      ))}
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
                <div className="fr-empty-state">
                  <Clock3 size={28} style={{ opacity: .7, color: 'var(--fr-primary)' }} />
                  <p style={{ marginTop: '.75rem', fontWeight: 500 }}>No has jugado ninguna partida aún</p>
                  <p style={{ marginTop: '.25rem', fontSize: '.75rem', color: 'var(--fr-muted-fg)' }}>Completa un nivel para ver tu actividad aquí</p>
                </div>
              </section>
            </div>

            {/* ── Perfil sidebar ── */}
            <aside>
              <div className="fr-profile-card">
                <div className="fr-profile-header">
                  <div className="fr-avatar">A</div>
                  <div>
                    <p style={{ fontWeight: 600 }}>Perfil</p>
                    <p style={{ fontSize: '.75rem', color: 'var(--fr-muted-fg)' }}>Cuenta personal</p>
                  </div>
                </div>
                <div className="fr-profile-body">
                  <div>
                    <p className="fr-label">Email</p>
                    <p className="fr-profile-value" style={{ wordBreak: 'break-all' }}>admin@freericky.com</p>
                  </div>
                  <div>
                    <p className="fr-label">Miembro desde</p>
                    <p className="fr-profile-value">12 de enero, 2024</p>
                  </div>
                  <div>
                    <p className="fr-label">Rol</p>
                    <span className="fr-badge fr-badge-hard" style={{ marginTop: '.5rem' }}>Administrador</span>
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