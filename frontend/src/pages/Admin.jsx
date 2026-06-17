import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import API from '../api/axios'

const TABS = [
  { id: 'resumen', label: 'Resumen', icon: '📊' },
  { id: 'usuarios', label: 'Usuarios', icon: '👥' },
  { id: 'niveles', label: 'Niveles', icon: '🎮' },
  { id: 'partidas', label: 'Partidas', icon: '⚔️' },
]

export default function Admin() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [tab, setTab] = useState('resumen')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate('/')
  }, [isLoading, isAuthenticated, navigate])
  useEffect(() => {
    if (user && user.rol !== 'admin') navigate('/home')
  }, [user, navigate])

  if (isLoading || !user) return null

  return (
    <div className="gaming-dashboard">
      <nav className="gaming-nav">
        <div className="gaming-nav-inner">
          <Link to="/" className="gaming-logo">
            <span className="logo-icon">⬡</span>SALT BORN
          </Link>
          <div className="gaming-nav-links">
            <Link to="/home" className="gaming-nav-link">Inicio</Link>
            <Link to="/admin" className="gaming-nav-link active">Admin</Link>
            <Link to="/settings" className="gaming-nav-link">Configuración</Link>
          </div>
          <div className="gaming-user-area">
            <div className="gaming-user-info">
              <div className="gaming-avatar">{user.username[0].toUpperCase()}</div>
              <div className="gaming-user-text">
                <span className="gaming-username">{user.username}</span>
                <span className="gaming-badge admin">Administrador</span>
              </div>
            </div>
            <button className="gaming-logout-btn" onClick={async () => { await logout(); navigate('/') }}>
              Salir
            </button>
          </div>
        </div>
      </nav>

      <main className="gaming-main">
        <div className="admin-hero">
          <span className="hero-greeting">Administración</span>
          <h1 className="admin-hero-title">Panel de Control</h1>
          <p className="hero-subtitle">Usuarios, niveles y supervisión del sistema</p>
        </div>

        <div className="admin-tabs">
          {TABS.map(t => (
            <button key={t.id} className={`admin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <span className="admin-tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="admin-content">
          {tab === 'resumen' && <Resumen />}
          {tab === 'usuarios' && <Usuarios />}
          {tab === 'niveles' && <Niveles />}
          {tab === 'partidas' && <Partidas />}
        </div>
      </main>
    </div>
  )
}

/* ─── Tabla reutilizable ─── */
function AdminTable({ headers, rows, emptyMsg = 'Sin datos', className = '' }) {
  return (
    <div className={`admin-table ${className}`}>
      <div className="admin-thead">
        {headers.map((h, i) => <span key={i} className="admin-th">{h}</span>)}
      </div>
      {rows.length > 0 ? rows : (
        <div className="admin-empty">{emptyMsg}</div>
      )}
    </div>
  )
}

/* ─── Botones de acción ─── */
function ActionBtns({ editing, onSave, onCancel, onEdit, onDelete }) {
  if (editing) {
    return (
      <div className="admin-actions">
        <button className="admin-btn save" onClick={onSave} title="Guardar"><span className="material-symbols-outlined">check</span></button>
        <button className="admin-btn cancel" onClick={onCancel} title="Cancelar"><span className="material-symbols-outlined">close</span></button>
      </div>
    )
  }
  return (
    <div className="admin-actions">
      <button className="admin-btn edit" onClick={onEdit} title="Editar"><span className="material-symbols-outlined">edit</span></button>
      <button className="admin-btn delete" onClick={onDelete} title="Eliminar"><span className="material-symbols-outlined">delete</span></button>
    </div>
  )
}

/* ─── RESUMEN ─── */
function Resumen() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    API.get('/admin/stats/').then(r => setStats(r.data)).catch(() => setError('Error al cargar'))
  }, [])

  if (error) return <Msg type="error" text={error} />
  if (!stats) return <Loader />

  return (
    <div className="admin-resumen">
      <div className="stat-card">
        <span className="stat-icon">👥</span>
        <div>
          <span className="stat-value">{stats.total_usuarios}</span>
          <span className="stat-label">Usuarios registrados</span>
        </div>
      </div>
      <div className="stat-card">
        <span className="stat-icon">🎮</span>
        <div>
          <span className="stat-value">{stats.total_niveles}</span>
          <span className="stat-label">Niveles creados</span>
        </div>
      </div>
      <div className="stat-card">
        <span className="stat-icon">⚔️</span>
        <div>
          <span className="stat-value">{stats.total_partidas}</span>
          <span className="stat-label">Partidas jugadas</span>
        </div>
      </div>
      <div className="stat-card">
        <span className="stat-icon">⭐</span>
        <div>
          <span className="stat-value">{stats.mejor_puntuacion_global}</span>
          <span className="stat-label">Mejor puntuación</span>
        </div>
      </div>
      <div className="stat-card">
        <span className="stat-icon">📈</span>
        <div>
          <span className="stat-value">{stats.promedio_puntuacion_global}</span>
          <span className="stat-label">Promedio global</span>
        </div>
      </div>
      <div className="stat-card">
        <span className="stat-icon">💀</span>
        <div>
          <span className="stat-value">{stats.total_muertes_global}</span>
          <span className="stat-label">Muertes totales</span>
        </div>
      </div>
      {stats.jugador_mas_activo && (
        <div className="stat-card wide">
          <span className="stat-icon">🏆</span>
          <div>
            <span className="stat-value" style={{ fontSize: 20 }}>{stats.jugador_mas_activo}</span>
            <span className="stat-label">Jugador más activo</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── USUARIOS ─── */
function Usuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [error, setError] = useState('')
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ username: '', email: '', rol: '' })

  useEffect(() => { fetch() }, [])
  const fetch = async () => {
    try {
      const res = await API.get('/usuarios/')
      setUsuarios(res.data)
    } catch { setError('Error al cargar') }
  }

  const startEdit = (u) => { setEditId(u.id); setForm({ username: u.username, email: u.email, rol: u.rol }) }
  const save = async (id) => {
    try { await API.put(`/usuarios/${id}/`, form); setEditId(null); fetch() }
    catch { setError('Error al actualizar') }
  }
  const del = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return
    try { await API.delete(`/usuarios/${id}/`); fetch() }
    catch { setError('Error al eliminar') }
  }

  return (
    <>
      {error && <Msg type="error" text={error} />}
      <AdminTable
        headers={['Usuario', 'Email', 'Rol', 'Registro', '']}
        rows={usuarios.map(u => (
          <div key={u.id} className="admin-tr">
            <span className="admin-td bold">
              {editId === u.id ? <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="inp" /> : u.username}
            </span>
            <span className="admin-td">
              {editId === u.id ? <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="inp" /> : u.email}
            </span>
            <span className="admin-td">
              {editId === u.id ? (
                <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} className="sel">
                  <option value="jugador">Jugador</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className={`gaming-badge ${u.rol}`}>{u.rol}</span>
              )}
            </span>
            <span className="admin-td date">{new Date(u.fecha_registro).toLocaleDateString()}</span>
            <span className="admin-td actions">
              <ActionBtns
                editing={editId === u.id}
                onSave={() => save(u.id)}
                onCancel={() => setEditId(null)}
                onEdit={() => startEdit(u)}
                onDelete={() => del(u.id)}
              />
            </span>
          </div>
        ))}
        emptyMsg="No hay usuarios registrados"
      />
    </>
  )
}

/* ─── NIVELES ─── */
function Niveles() {
  const [niveles, setNiveles] = useState([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newNivel, setNewNivel] = useState({ nombre: '', dificultad: 'facil', tiempo_limite: '' })
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({ nombre: '', dificultad: 'facil', tiempo_limite: '' })

  useEffect(() => { fetch() }, [])
  const fetch = async () => {
    try { const res = await API.get('/niveles/'); setNiveles(res.data) }
    catch { setError('Error al cargar') }
  }

  const create = async () => {
    try {
      await API.post('/niveles/', { ...newNivel, tiempo_limite: newNivel.tiempo_limite ? Number(newNivel.tiempo_limite) : null })
      setCreating(false); setNewNivel({ nombre: '', dificultad: 'facil', tiempo_limite: '' }); fetch()
    } catch { setError('Error al crear') }
  }

  const startEdit = (n) => { setEditId(n.id); setForm({ nombre: n.nombre, dificultad: n.dificultad, tiempo_limite: n.tiempo_limite || '' }) }
  const save = async (id) => {
    try { await API.put(`/niveles/${id}/`, { ...form, tiempo_limite: form.tiempo_limite ? Number(form.tiempo_limite) : null }); setEditId(null); fetch() }
    catch { setError('Error al actualizar') }
  }
  const del = async (id) => {
    if (!confirm('¿Eliminar este nivel?')) return
    try { await API.delete(`/niveles/${id}/`); fetch() }
    catch { setError('Error al eliminar') }
  }

  const Badge = ({ d }) => {
    const map = { facil: 'F', medio: 'M', dificil: 'D' }
    return <span className={`mini-badge ${map[d]}`} style={{ fontSize: 10, padding: '2px 10px', width: 'auto' }}>{d}</span>
  }

  return (
    <>
      {error && <Msg type="error" text={error} />}

      {creating ? (
        <div className="admin-create-card">
          <h3 className="create-title">Nuevo nivel</h3>
          <div className="create-fields">
            <input placeholder="Nombre del nivel" value={newNivel.nombre} onChange={e => setNewNivel({ ...newNivel, nombre: e.target.value })} className="inp" />
            <select value={newNivel.dificultad} onChange={e => setNewNivel({ ...newNivel, dificultad: e.target.value })} className="sel">
              <option value="facil">Fácil</option>
              <option value="medio">Medio</option>
              <option value="dificil">Difícil</option>
            </select>
            <input placeholder="Tiempo límite (seg)" type="number" value={newNivel.tiempo_limite} onChange={e => setNewNivel({ ...newNivel, tiempo_limite: e.target.value })} className="inp" style={{ maxWidth: 160 }} />
          </div>
          <div className="create-actions">
            <button className="btn primary" onClick={create}>Crear nivel</button>
            <button className="btn ghost" onClick={() => setCreating(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button className="btn primary" onClick={() => setCreating(true)} style={{ marginBottom: 20 }}>+ Nuevo nivel</button>
      )}

      <AdminTable
        headers={['Nombre', 'Dificultad', 'Tiempo', 'Creado', '']}
        rows={niveles.map(n => (
          <div key={n.id} className="admin-tr">
            <span className="admin-td bold">
              {editId === n.id ? <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="inp" /> : n.nombre}
            </span>
            <span className="admin-td">
              {editId === n.id ? (
                <select value={form.dificultad} onChange={e => setForm({ ...form, dificultad: e.target.value })} className="sel">
                  <option value="facil">Fácil</option>
                  <option value="medio">Medio</option>
                  <option value="dificil">Difícil</option>
                </select>
              ) : <Badge d={n.dificultad} />}
            </span>
            <span className="admin-td mono">
              {editId === n.id ? (
                <input type="number" value={form.tiempo_limite} onChange={e => setForm({ ...form, tiempo_limite: e.target.value })} className="inp" style={{ maxWidth: 80 }} />
              ) : n.tiempo_limite ? `${n.tiempo_limite}s` : '-'}
            </span>
            <span className="admin-td date">{new Date(n.fecha_creacion).toLocaleDateString()}</span>
            <span className="admin-td actions">
              <ActionBtns
                editing={editId === n.id}
                onSave={() => save(n.id)}
                onCancel={() => setEditId(null)}
                onEdit={() => startEdit(n)}
                onDelete={() => del(n.id)}
              />
            </span>
          </div>
        ))}
        emptyMsg="No hay niveles creados"
      />
    </>
  )
}

/* ─── PARTIDAS ─── */
function Partidas() {
  const [partidas, setPartidas] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    API.get('/admin/partidas/').then(r => setPartidas(r.data)).catch(() => setError('Error al cargar'))
  }, [])

  return (
    <>
      {error && <Msg type="error" text={error} />}
      <AdminTable className="partidas"
        headers={['Jugador', 'Nivel', 'Pts', '💀', 'Tiempo', 'Fecha']}
        rows={partidas.map(p => (
          <div key={p.id} className="admin-tr">
            <span className="admin-td bold">{p.usuario_username}</span>
            <span className="admin-td" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {p.nivel_nombre}
              <span className={`mini-badge ${p.nivel_dificultad[0].toUpperCase()}`}>{p.nivel_dificultad[0].toUpperCase()}</span>
            </span>
            <span className="admin-td mono" style={{ color: '#ffb68c', fontWeight: 600 }}>{p.puntuacion}</span>
            <span className="admin-td mono">{p.muertes}</span>
            <span className="admin-td mono">{p.tiempo ? `${Math.floor(p.tiempo / 60)}:${String(p.tiempo % 60).padStart(2, '0')}` : '-'}</span>
            <span className="admin-td date">{new Date(p.fecha).toLocaleDateString()}</span>
          </div>
        ))}
        emptyMsg="No hay partidas registradas"
      />
    </>
  )
}

/* ─── Helpers pequeños ─── */
function Loader() {
  return <div className="loading-dots" style={{ padding: 40 }}><div className="dot" /><div className="dot" /><div className="dot" /></div>
}
function Msg({ type, text }) {
  return <div className={`auth-general-${type}`} style={{ marginBottom: 16 }}><span className="material-symbols-outlined">{type === 'error' ? 'error' : 'info'}</span><span>{text}</span></div>
}
