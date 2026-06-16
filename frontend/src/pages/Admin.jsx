import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import API from '../api/axios'

const tabs = [
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
    if (!isLoading && !isAuthenticated) { navigate('/') }
  }, [isLoading, isAuthenticated, navigate])
  useEffect(() => {
    if (user && user.rol !== 'admin') { navigate('/home') }
  }, [user, navigate])

  if (isLoading) return null
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
        <div className="gaming-hero" style={{ paddingBottom: 24 }}>
          <div className="hero-glow" />
          <div className="hero-content" style={{ alignItems: 'flex-start' }}>
            <div className="hero-text">
              <span className="hero-greeting">Administración</span>
              <h1 className="hero-title">Panel de Control</h1>
              <p className="hero-subtitle">Gestiona usuarios, niveles y supervisa el sistema</p>
            </div>
          </div>
        </div>

        <div className="admin-tabs">
          {tabs.map(t => (
            <button key={t.id} className={`admin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <span className="admin-tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        <div className="gaming-section" style={{ padding: '0 32px' }}>
          {tab === 'resumen' && <ResumenTab />}
          {tab === 'usuarios' && <UsuariosTab />}
          {tab === 'niveles' && <NivelesTab />}
          {tab === 'partidas' && <PartidasTab />}
        </div>
      </main>
    </div>
  )
}

function ResumenTab() {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    API.get('/admin/stats/').then(r => setStats(r.data)).catch(() => setError('Error al cargar'))
  }, [])

  if (error) return <div className="auth-general-error"><span className="material-symbols-outlined">error</span><span>{error}</span></div>
  if (!stats) return <div className="loading-dots" style={{ padding: 40 }}><div className="dot" /><div className="dot" /><div className="dot" /></div>

  return (
    <div className="admin-stats-grid">
      <div className="admin-stat-card">
        <span className="admin-stat-icon">👥</span>
        <span className="admin-stat-value">{stats.total_usuarios}</span>
        <span className="admin-stat-label">Usuarios</span>
      </div>
      <div className="admin-stat-card">
        <span className="admin-stat-icon">🎮</span>
        <span className="admin-stat-value">{stats.total_niveles}</span>
        <span className="admin-stat-label">Niveles</span>
      </div>
      <div className="admin-stat-card">
        <span className="admin-stat-icon">⚔️</span>
        <span className="admin-stat-value">{stats.total_partidas}</span>
        <span className="admin-stat-label">Partidas</span>
      </div>
      <div className="admin-stat-card">
        <span className="admin-stat-icon">⭐</span>
        <span className="admin-stat-value">{stats.mejor_puntuacion_global}</span>
        <span className="admin-stat-label">Mejor Punt.</span>
      </div>
      <div className="admin-stat-card">
        <span className="admin-stat-icon">📈</span>
        <span className="admin-stat-value">{stats.promedio_puntuacion_global}</span>
        <span className="admin-stat-label">Promedio Global</span>
      </div>
      <div className="admin-stat-card">
        <span className="admin-stat-icon">💀</span>
        <span className="admin-stat-value">{stats.total_muertes_global}</span>
        <span className="admin-stat-label">Muertes</span>
      </div>
      {stats.jugador_mas_activo && (
        <div className="admin-stat-card admin-stat-wide">
          <span className="admin-stat-icon">🏆</span>
          <div className="admin-stat-text">
            <span className="admin-stat-value" style={{ fontSize: 18 }}>{stats.jugador_mas_activo}</span>
            <span className="admin-stat-label">Jugador más activo</span>
          </div>
        </div>
      )}
    </div>
  )
}

function UsuariosTab() {
  const [usuarios, setUsuarios] = useState([])
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({ username: '', email: '', rol: '' })

  useEffect(() => { fetchUsuarios() }, [])

  const fetchUsuarios = async () => {
    try {
      const res = await API.get('/usuarios/')
      setUsuarios(res.data)
    } catch { setError('Error al cargar usuarios') }
  }

  const handleEdit = (u) => {
    setEditingId(u.id)
    setEditData({ username: u.username, email: u.email, rol: u.rol })
  }

  const handleSave = async (id) => {
    try {
      await API.put(`/usuarios/${id}/`, editData)
      setEditingId(null)
      fetchUsuarios()
    } catch { setError('Error al actualizar') }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return
    try {
      await API.delete(`/usuarios/${id}/`)
      fetchUsuarios()
    } catch { setError('Error al eliminar') }
  }

  return (
    <>
      {error && <div className="auth-general-error" style={{ marginBottom: 16 }}><span className="material-symbols-outlined">error</span><span>{error}</span></div>}
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <span className="admin-th" style={{ flex: 2 }}>Usuario</span>
          <span className="admin-th" style={{ flex: 3 }}>Email</span>
          <span className="admin-th" style={{ flex: 1 }}>Rol</span>
          <span className="admin-th" style={{ flex: 1.5 }}>Registro</span>
          <span className="admin-th" style={{ flex: 1 }}>Acciones</span>
        </div>
        {usuarios.map(u => (
          <div key={u.id} className="admin-table-row">
            <span style={{ flex: 2, fontWeight: 600, color: '#fff' }}>
              {editingId === u.id ? (
                <input value={editData.username} onChange={e => setEditData({ ...editData, username: e.target.value })} className="admin-input" />
              ) : u.username}
            </span>
            <span style={{ flex: 3 }}>
              {editingId === u.id ? (
                <input value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} className="admin-input" />
              ) : u.email}
            </span>
            <span style={{ flex: 1 }}>
              {editingId === u.id ? (
                <select value={editData.rol} onChange={e => setEditData({ ...editData, rol: e.target.value })} className="admin-select">
                  <option value="jugador">Jugador</option>
                  <option value="admin">Admin</option>
                </select>
              ) : (
                <span className={`gaming-badge ${u.rol}`}>{u.rol}</span>
              )}
            </span>
            <span style={{ flex: 1.5, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              {new Date(u.fecha_registro).toLocaleDateString()}
            </span>
            <span style={{ flex: 1, display: 'flex', gap: 8 }}>
              {editingId === u.id ? (
                <>
                  <button className="admin-icon-btn save" onClick={() => handleSave(u.id)} title="Guardar">
                    <span className="material-symbols-outlined">check</span>
                  </button>
                  <button className="admin-icon-btn cancel" onClick={() => setEditingId(null)} title="Cancelar">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </>
              ) : (
                <>
                  <button className="admin-icon-btn edit" onClick={() => handleEdit(u)} title="Editar">
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button className="admin-icon-btn delete" onClick={() => handleDelete(u.id)} title="Eliminar">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

function NivelesTab() {
  const [niveles, setNiveles] = useState([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [newNivel, setNewNivel] = useState({ nombre: '', dificultad: 'facil', tiempo_limite: '' })
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({ nombre: '', dificultad: 'facil', tiempo_limite: '' })

  useEffect(() => { fetchNiveles() }, [])

  const fetchNiveles = async () => {
    try {
      const res = await API.get('/niveles/')
      setNiveles(res.data)
    } catch { setError('Error al cargar niveles') }
  }

  const handleCreate = async () => {
    try {
      await API.post('/niveles/', { ...newNivel, tiempo_limite: newNivel.tiempo_limite ? Number(newNivel.tiempo_limite) : null })
      setCreating(false)
      setNewNivel({ nombre: '', dificultad: 'facil', tiempo_limite: '' })
      fetchNiveles()
    } catch { setError('Error al crear nivel') }
  }

  const handleEdit = (n) => {
    setEditingId(n.id)
    setEditData({ nombre: n.nombre, dificultad: n.dificultad, tiempo_limite: n.tiempo_limite || '' })
  }

  const handleSave = async (id) => {
    try {
      await API.put(`/niveles/${id}/`, { ...editData, tiempo_limite: editData.tiempo_limite ? Number(editData.tiempo_limite) : null })
      setEditingId(null)
      fetchNiveles()
    } catch { setError('Error al actualizar') }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este nivel?')) return
    try {
      await API.delete(`/niveles/${id}/`)
      fetchNiveles()
    } catch { setError('Error al eliminar') }
  }

  return (
    <>
      {error && <div className="auth-general-error" style={{ marginBottom: 16 }}><span className="material-symbols-outlined">error</span><span>{error}</span></div>}

      <div style={{ marginBottom: 20 }}>
        {!creating ? (
          <button className="admin-create-btn" onClick={() => setCreating(true)}>
            + Nuevo Nivel
          </button>
        ) : (
          <div className="admin-create-form">
            <input placeholder="Nombre" value={newNivel.nombre} onChange={e => setNewNivel({ ...newNivel, nombre: e.target.value })} className="admin-input" />
            <select value={newNivel.dificultad} onChange={e => setNewNivel({ ...newNivel, dificultad: e.target.value })} className="admin-select">
              <option value="facil">Fácil</option>
              <option value="medio">Medio</option>
              <option value="dificil">Difícil</option>
            </select>
            <input placeholder="Tiempo límite (seg)" type="number" value={newNivel.tiempo_limite} onChange={e => setNewNivel({ ...newNivel, tiempo_limite: e.target.value })} className="admin-input" style={{ maxWidth: 140 }} />
            <button className="admin-create-btn primary" onClick={handleCreate}>Crear</button>
            <button className="admin-create-btn" style={{ background: 'transparent', color: 'rgba(255,255,255,0.5)' }} onClick={() => setCreating(false)}>Cancelar</button>
          </div>
        )}
      </div>

      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <span className="admin-th" style={{ flex: 2 }}>Nombre</span>
          <span className="admin-th" style={{ flex: 1 }}>Dificultad</span>
          <span className="admin-th" style={{ flex: 1 }}>Tiempo Límite</span>
          <span className="admin-th" style={{ flex: 1.5 }}>Creado</span>
          <span className="admin-th" style={{ flex: 1 }}>Acciones</span>
        </div>
        {niveles.map(n => (
          <div key={n.id} className="admin-table-row">
            <span style={{ flex: 2, fontWeight: 600, color: '#fff' }}>
              {editingId === n.id ? (
                <input value={editData.nombre} onChange={e => setEditData({ ...editData, nombre: e.target.value })} className="admin-input" />
              ) : n.nombre}
            </span>
            <span style={{ flex: 1 }}>
              {editingId === n.id ? (
                <select value={editData.dificultad} onChange={e => setEditData({ ...editData, dificultad: e.target.value })} className="admin-select">
                  <option value="facil">Fácil</option>
                  <option value="medio">Medio</option>
                  <option value="dificil">Difícil</option>
                </select>
              ) : (
                <span className={`mini-badge ${n.dificultad[0].toUpperCase()}`} style={{ fontSize: 10, width: 'auto', padding: '2px 10px' }}>
                  {n.dificultad}
                </span>
              )}
            </span>
            <span style={{ flex: 1, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(255,255,255,0.5)' }}>
              {editingId === n.id ? (
                <input type="number" value={editData.tiempo_limite} onChange={e => setEditData({ ...editData, tiempo_limite: e.target.value })} className="admin-input" style={{ maxWidth: 100 }} />
              ) : n.tiempo_limite ? `${n.tiempo_limite}s` : '-'}
            </span>
            <span style={{ flex: 1.5, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
              {new Date(n.fecha_creacion).toLocaleDateString()}
            </span>
            <span style={{ flex: 1, display: 'flex', gap: 8 }}>
              {editingId === n.id ? (
                <>
                  <button className="admin-icon-btn save" onClick={() => handleSave(n.id)} title="Guardar">
                    <span className="material-symbols-outlined">check</span>
                  </button>
                  <button className="admin-icon-btn cancel" onClick={() => setEditingId(null)} title="Cancelar">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </>
              ) : (
                <>
                  <button className="admin-icon-btn edit" onClick={() => handleEdit(n)} title="Editar">
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button className="admin-icon-btn delete" onClick={() => handleDelete(n.id)} title="Eliminar">
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

function PartidasTab() {
  const [partidas, setPartidas] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    API.get('/admin/partidas/').then(r => setPartidas(r.data)).catch(() => setError('Error al cargar'))
  }, [])

  return (
    <>
      {error && <div className="auth-general-error" style={{ marginBottom: 16 }}><span className="material-symbols-outlined">error</span><span>{error}</span></div>}
      <div className="admin-table-wrap">
        <div className="admin-table-header">
          <span className="admin-th" style={{ flex: 1.5 }}>Jugador</span>
          <span className="admin-th" style={{ flex: 1.5 }}>Nivel</span>
          <span className="admin-th" style={{ flex: 0.8 }}>Pts</span>
          <span className="admin-th" style={{ flex: 0.8 }}>💀</span>
          <span className="admin-th" style={{ flex: 0.8 }}>Tiempo</span>
          <span className="admin-th" style={{ flex: 1 }}>Fecha</span>
        </div>
        {partidas.map(p => (
          <div key={p.id} className="admin-table-row">
            <span style={{ flex: 1.5, fontWeight: 600, color: '#fff' }}>{p.usuario_username}</span>
            <span style={{ flex: 1.5, display: 'flex', gap: 8, alignItems: 'center' }}>
              {p.nivel_nombre}
              <span className={`mini-badge ${p.nivel_dificultad[0].toUpperCase()}`}>{p.nivel_dificultad[0].toUpperCase()}</span>
            </span>
            <span style={{ flex: 0.8, fontFamily: "'JetBrains Mono', monospace", color: '#ffb68c', fontWeight: 600 }}>{p.puntuacion}</span>
            <span style={{ flex: 0.8, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(255,255,255,0.5)' }}>{p.muertes}</span>
            <span style={{ flex: 0.8, fontFamily: "'JetBrains Mono', monospace", color: 'rgba(255,255,255,0.5)' }}>
              {p.tiempo ? `${Math.floor(p.tiempo / 60)}:${String(p.tiempo % 60).padStart(2, '0')}` : '-'}
            </span>
            <span style={{ flex: 1, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{new Date(p.fecha).toLocaleDateString()}</span>
          </div>
        ))}
        {partidas.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>No hay partidas registradas</div>
        )}
      </div>
    </>
  )
}
