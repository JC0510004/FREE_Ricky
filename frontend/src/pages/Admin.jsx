import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/useAuth'
import API from '../api/axios'
import LoadingDots from '../components/LoadingDots'
import {
  ArrowLeft, BarChart3, Check, Gamepad2, LogOut, Pencil,
  ShieldCheck, Swords, Trash2, Trophy, Users, Zap
} from 'lucide-react'
import '../dashboard.css'

/* ─── Tab: Resumen ──────────────────────────────────────────────── */
function Resumen() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    API.get('/admin/stats/', { signal: ctrl.signal })
      .then(r => setStats(r.data))
      .catch(() => setError('Error al cargar'))
    return () => ctrl.abort()
  }, [])

  if (error) return <div className="fr-error">{error}</div>
  if (!stats) return <div style={{ padding: 40 }}><LoadingDots /></div>

  const metrics = [
    [String(stats.total_usuarios ?? 0), 'Usuarios', Users],
    [String(stats.total_niveles ?? 0), 'Niveles', Gamepad2],
    [String(stats.total_partidas ?? 0), 'Partidas', Swords],
    [String(stats.mejor_puntuacion_global ?? 0), 'Mejor puntuación', Trophy],
    [String(stats.promedio_puntuacion_global ?? 0), 'Promedio global', BarChart3],
    [String(stats.total_muertes_global ?? 0), 'Muertes totales', Zap],
  ]

  return (
    <>
      <div className="fr-grid-3">
        {metrics.map(([value, label, Icon], i) => (
          <article className="fr-card fr-animate" key={label} style={{ animationDelay: `${i * 70}ms` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span className="fr-icon-tile"><Icon size={20} /></span>
              <div>
                <p className="fr-mono" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--fr-primary)' }}>{value}</p>
                <p style={{ fontSize: '.75rem', color: 'var(--fr-muted-fg)' }}>{label}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
      {stats.jugador_mas_activo && (
        <div className="fr-card" style={{ marginTop: '.75rem', transform: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Trophy size={24} style={{ color: 'var(--fr-primary)' }} />
            <div>
              <p style={{ fontSize: '.875rem', fontWeight: 600 }}>{stats.jugador_mas_activo}</p>
              <p style={{ fontSize: '.75rem', color: 'var(--fr-muted-fg)' }}>Jugador más activo</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ─── Tab: Usuarios ─────────────────────────────────────────────── */
function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null) // { tipo: 'ok'|'error', texto }
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ username: '', email: '', rol: '' })

  const load = (signal, cb) => {
    API.get('/usuarios/', { signal })
      .then(r => { setUsuarios(r.data.results || r.data); cb?.() })
      .catch(e => { if (e?.name !== 'CanceledError') setError('Error al cargar') })
  }

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [])

  const clearNotice = () => setNotice(null)

  const startEdit = (u) => { clearNotice(); setEditId(u.id); setForm({ username: u.username, email: u.email, rol: u.rol }) }

  const save = async (id) => {
    try {
      await API.put(`/usuarios/${id}/`, { username: form.username, email: form.email })
      setEditId(null)
      setNotice({ tipo: 'ok', texto: 'Usuario actualizado correctamente' })
      load(null, () => setTimeout(clearNotice, 4000))
    } catch (err) {
      const detail = err?.response?.data
      const msg =
        (detail && typeof detail === 'object' ? Object.values(detail).flat().filter(Boolean).join(' · ')
          : err?.response?.data?.error) || 'Error al actualizar'
      setNotice({ tipo: 'error', texto: msg })
    }
  }

  const del = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return
    try {
      await API.delete(`/usuarios/${id}/`)
      setNotice({ tipo: 'ok', texto: 'Usuario desactivado' })
      load(null, () => setTimeout(clearNotice, 4000))
    } catch {
      setNotice({ tipo: 'error', texto: 'Error al eliminar' })
    }
  }

  return (
    <>
      {error && <div className="fr-error">{error}</div>}
      {notice && (
        <div className={notice.tipo === 'ok' ? 'fr-success' : 'fr-error'} style={{ marginBottom: '1rem' }}>
          {notice.tipo === 'ok' && <Check size={14} />}
          <span>{notice.texto}</span>
        </div>
      )}
      <div className="fr-table-wrap">
        <div className="fr-table-header-row">
          <div className="fr-table-header-text">
            <span className="fr-icon-tile fr-icon-tile-sm"><Users size={16} /></span>
            <div>
              <h2>Usuarios registrados</h2>
              <p>Administra las cuentas y permisos del sistema</p>
            </div>
          </div>
          <span className="fr-badge fr-badge-medium">{usuarios.length} usuarios</span>
        </div>
        <table className="fr-table" style={{ minWidth: 700 }}>
          <thead>
            <tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Registro</th><th className="fr-right">Acciones</th></tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td className="fr-bold">
                  {editId === u.id
                    ? <input className="fr-input" style={{ padding: '.4rem .6rem' }} value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} />
                    : u.username}
                </td>
                <td>
                  {editId === u.id
                    ? <input className="fr-input" style={{ padding: '.4rem .6rem' }} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                    : u.email}
                </td>
                <td>
                  {editId === u.id
                    ? <select className="fr-select" value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                        <option value="jugador">Jugador</option>
                        <option value="admin">Admin</option>
                      </select>
                    : <span className={`fr-badge fr-badge-${u.rol === 'admin' ? 'hard' : 'medium'}`}>{u.rol}</span>}
                </td>
                <td style={{ color: 'var(--fr-muted-fg)' }}>{u.fecha_registro ? new Date(u.fecha_registro).toLocaleDateString() : '-'}</td>
                <td>
                  {editId === u.id ? (
                    <div className="fr-actions">
                      <button className="fr-action-btn" type="button" onClick={() => save(u.id)} title="Guardar"><Check size={16} /></button>
                      <button className="fr-action-btn" type="button" onClick={() => setEditId(null)} title="Cancelar" style={{ fontSize: '1rem' }}>✕</button>
                    </div>
                  ) : (
                    <div className="fr-actions">
                      <button className="fr-action-btn" type="button" onClick={() => startEdit(u)} title="Editar"><Pencil size={16} /></button>
                      <button className="fr-action-btn fr-delete" type="button" onClick={() => del(u.id)} title="Eliminar"><Trash2 size={16} /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!usuarios.length && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--fr-muted-fg)' }}>No hay usuarios registrados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ─── Tab: Niveles ──────────────────────────────────────────────── */
function Niveles() {
  const [niveles, setNiveles] = useState([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newNivel, setNewNivel] = useState({ nombre: '', dificultad: 'facil', tiempo_limite: '' })
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ nombre: '', dificultad: 'facil', tiempo_limite: '' })

  const load = (signal) => {
    API.get('/niveles/', { signal })
      .then(r => setNiveles(r.data.results || r.data))
      .catch(e => { if (e?.name !== 'CanceledError') setError('Error al cargar') })
  }

  useEffect(() => {
    const ctrl = new AbortController()
    load(ctrl.signal)
    return () => ctrl.abort()
  }, [])

  const create = async () => {
    try {
      await API.post('/niveles/', { ...newNivel, tiempo_limite: newNivel.tiempo_limite ? Number(newNivel.tiempo_limite) : null })
      setCreating(false); setNewNivel({ nombre: '', dificultad: 'facil', tiempo_limite: '' }); load()
    } catch { setError('Error al crear') }
  }

  const startEdit = (n) => { setEditId(n.id); setForm({ nombre: n.nombre, dificultad: n.dificultad, tiempo_limite: n.tiempo_limite || '' }) }

  const save = async (id) => {
    try { await API.put(`/niveles/${id}/`, { ...form, tiempo_limite: form.tiempo_limite ? Number(form.tiempo_limite) : null }); setEditId(null); load() }
    catch { setError('Error al actualizar') }
  }

  const del = async (id) => {
    if (!confirm('¿Eliminar este nivel?')) return
    try { await API.delete(`/niveles/${id}/`); load() }
    catch { setError('Error al eliminar') }
  }

  return (
    <>
      {error && <div className="fr-error">{error}</div>}

      {creating ? (
        <div className="fr-create-row">
          <input className="fr-input" placeholder="Nombre del nivel" value={newNivel.nombre} onChange={e => setNewNivel({ ...newNivel, nombre: e.target.value })} />
          <select className="fr-select" value={newNivel.dificultad} onChange={e => setNewNivel({ ...newNivel, dificultad: e.target.value })}>
            <option value="facil">Fácil</option>
            <option value="medio">Medio</option>
            <option value="dificil">Difícil</option>
          </select>
          <input className="fr-input fr-input-sm" placeholder="Tiempo (seg)" type="number" value={newNivel.tiempo_limite} onChange={e => setNewNivel({ ...newNivel, tiempo_limite: e.target.value })} />
          <button className="fr-btn-primary" type="button" style={{ width: 'auto', padding: '.7rem 1.25rem' }} onClick={create}>Crear</button>
          <button className="fr-btn-logout" type="button" onClick={() => setCreating(false)}>Cancelar</button>
        </div>
      ) : (
        <div className="fr-create-row">
          <button className="fr-btn-primary" type="button" style={{ width: 'auto', padding: '.7rem 1.25rem' }} onClick={() => setCreating(true)}>
            <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span>Nuevo nivel
          </button>
          <span className="fr-section-meta">{niveles.length} niveles configurados</span>
        </div>
      )}

      <div className="fr-table-wrap">
        <table className="fr-table" style={{ minWidth: 700 }}>
          <thead>
            <tr><th>Nombre</th><th>Dificultad</th><th>Tiempo</th><th>Creado</th><th className="fr-right">Acciones</th></tr>
          </thead>
          <tbody>
            {niveles.map(n => {
              const tone = n.dificultad === 'dificil' ? 'hard' : n.dificultad === 'medio' ? 'medium' : 'easy'
              return (
                <tr key={n.id}>
                  <td className="fr-bold">
                    {editId === n.id
                      ? <input className="fr-input" style={{ padding: '.4rem .6rem' }} value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                      : n.nombre}
                  </td>
                  <td>
                    {editId === n.id
                      ? <select className="fr-select" value={form.dificultad} onChange={e => setForm({ ...form, dificultad: e.target.value })}>
                          <option value="facil">Fácil</option>
                          <option value="medio">Medio</option>
                          <option value="dificil">Difícil</option>
                        </select>
                      : <span className={`fr-badge fr-badge-${tone}`}>{n.dificultad}</span>}
                  </td>
                  <td className="fr-mono">
                    {editId === n.id
                      ? <input className="fr-input fr-input-sm" type="number" value={form.tiempo_limite} onChange={e => setForm({ ...form, tiempo_limite: e.target.value })} style={{ maxWidth: 80 }} />
                      : n.tiempo_limite ? `${n.tiempo_limite}s` : '-'}
                  </td>
                  <td style={{ color: 'var(--fr-muted-fg)' }}>{new Date(n.fecha_creacion).toLocaleDateString()}</td>
                  <td>
                    {editId === n.id ? (
                      <div className="fr-actions">
                        <button className="fr-action-btn" type="button" onClick={() => save(n.id)} title="Guardar"><Check size={16} /></button>
                        <button className="fr-action-btn" type="button" onClick={() => setEditId(null)} title="Cancelar" style={{ fontSize: '1rem' }}>✕</button>
                      </div>
                    ) : (
                      <div className="fr-actions">
                        <button className="fr-action-btn" type="button" onClick={() => startEdit(n)} title="Editar"><Pencil size={16} /></button>
                        <button className="fr-action-btn fr-delete" type="button" onClick={() => del(n.id)} title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {!niveles.length && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--fr-muted-fg)' }}>No hay niveles creados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ─── Tab: Partidas ─────────────────────────────────────────────── */
function Partidas() {
  const [partidas, setPartidas] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    const ctrl = new AbortController()
    API.get('/admin/partidas/', { signal: ctrl.signal })
      .then(r => setPartidas(r.data.results || r.data))
      .catch(() => setError('Error al cargar'))
    return () => ctrl.abort()
  }, [])

  return (
    <>
      {error && <div className="fr-error">{error}</div>}
      <div className="fr-section-header">
        <div className="fr-section-header-text">
          <p className="fr-eyebrow">Actividad reciente</p>
          <h2 className="fr-section-title">Partidas registradas</h2>
        </div>
        <span className="fr-badge fr-badge-medium">{partidas.length} partidas</span>
      </div>
      <div className="fr-table-wrap">
        <table className="fr-table" style={{ minWidth: 850 }}>
          <thead>
            <tr><th>Jugador</th><th>Nivel</th><th>Pts</th><th>Muertes</th><th>Tiempo</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {partidas.map((p, i) => {
              const tone = p.nivel_dificultad === 'dificil' ? 'hard' : p.nivel_dificultad === 'medio' ? 'medium' : 'easy'
              const toneShort = tone === 'hard' ? 'D' : tone === 'medium' ? 'M' : 'F'
              return (
                <tr key={p.id || `${p.usuario_username}-${i}`}>
                  <td className="fr-bold">{p.usuario_username}</td>
                  <td>
                    {p.nivel_nombre}
                    <span className={`fr-badge fr-badge-${tone} fr-badge-inline`}>{toneShort}</span>
                  </td>
                  <td className="fr-pts-col">{p.puntuacion}</td>
                  <td className="fr-mono">{p.muertes}</td>
                  <td className="fr-mono">{p.tiempo != null ? `${Math.floor(p.tiempo / 60)}:${String(p.tiempo % 60).padStart(2, '0')}` : '-'}</td>
                  <td style={{ color: 'var(--fr-muted-fg)' }}>{new Date(p.fecha).toLocaleDateString()}</td>
                </tr>
              )
            })}
            {!partidas.length && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--fr-muted-fg)' }}>No hay partidas registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}

/* ─── Admin Panel ───────────────────────────────────────────────── */
const TABS = ['Resumen', 'Usuarios', 'Niveles', 'Partidas']

export default function Admin() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, tokenReady, logout } = useAuth()
  const [activeTab, setActiveTab] = useState('Resumen')

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) return navigate('/')
    if (user?.rol !== 'admin') return navigate('/home')
  }, [isLoading, isAuthenticated, user, navigate])

  if (isLoading || !user) return null
  if (!tokenReady) {
    return (
      <div className="fr-dash">
        <main className="fr-main">
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <LoadingDots />
          </div>
        </main>
      </div>
    )
  }

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
            <p className="fr-eyebrow">Administración</p>
            <h1 className="fr-title">Panel de Control</h1>
            <p className="fr-subtitle">Usuarios, niveles y supervisión del sistema</p>
          </div>

          {/* ── Tabs ── */}
          <nav className="fr-tabs" aria-label="Secciones de administración">
            {TABS.map(tab => (
              <button
                key={tab}
                type="button"
                className={`fr-tab${activeTab === tab ? ' fr-tab-active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </nav>

          {/* ── Tab content ── */}
          <div style={{ paddingTop: '1.25rem' }}>
            {activeTab === 'Resumen' && <Resumen />}
            {activeTab === 'Usuarios' && <Usuarios />}
            {activeTab === 'Niveles' && <Niveles />}
            {activeTab === 'Partidas' && <Partidas />}
          </div>

        </div>
      </main>
    </div>
  )
}