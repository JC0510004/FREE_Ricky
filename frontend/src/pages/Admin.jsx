import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import API from '../api/axios'

// ─── Definición de las pestañas del panel de administración ───
// Cada pestaña tiene un id para el control de estado, una etiqueta visible y un icono.
const TABS = [
  { id: 'resumen', label: 'Resumen', icon: '📊' },    // Resumen general del sistema
  { id: 'usuarios', label: 'Usuarios', icon: '👥' },   // Gestión de usuarios
  { id: 'niveles', label: 'Niveles', icon: '🎮' },     // Gestión de niveles del juego
  { id: 'partidas', label: 'Partidas', icon: '⚔️' },   // Historial de todas las partidas
]

// ─── Mapa de abreviaturas para badges de dificultad ───
// Mapea cada nivel de dificultad a su inicial para el badge compacto.
const BADGE_MAP = { facil: 'F', medio: 'M', dificil: 'D' }

// ─── Componente Badge para mostrar dificultad ───
// Renderiza un badge pequeño con el nombre de la dificultad.
function Badge({ d }) {
  return <span className={`mini-badge ${BADGE_MAP[d] || ''}`} style={{ fontSize: 12, padding: '2px 10px', width: 'auto' }}>{d || '?'}</span>
}

export default function Admin() {
  // ─── Hook de navegación ───
  const navigate = useNavigate()

  // ─── Datos del contexto de autenticación ───
  const { user, isAuthenticated, isLoading, logout } = useAuth()

  // ─── Estado de la pestaña activa (por defecto: resumen) ───
  const [tab, setTab] = useState('resumen')

  // ─── Protección de ruta: solo administradores ───
  // Si no está autenticado, redirige al login. Si no es admin, redirige al home.
  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) return navigate('/')
    if (user?.rol !== 'admin') return navigate('/')
  }, [isLoading, isAuthenticated, user, navigate])

  // ─── Guardia de renderizado ───
  if (isLoading || !user) return null

  return (
    <div className="gaming-dashboard">

      {/* ─── Contenido principal del admin ─── */}
      <main className="gaming-main">

        {/* ─── Botón volver al inicio ─── */}
        <Link to="/" className="back-to-landing">
          <span className="material-symbols-outlined">arrow_back</span>
          Volver al inicio
        </Link>

        {/* ─── Hero section con título del panel ─── */}
        <div className="admin-hero">
          <span className="hero-greeting">Administración</span>
          <h1 className="admin-hero-title">Panel de Control</h1>
          <p className="hero-subtitle">Usuarios, niveles y supervisión del sistema</p>
        </div>

        {/* ─── Pestañas de navegación del admin ─── */}
        <div className="admin-tabs">
          {TABS.map(t => (
            <button type="button" key={t.id} className={`admin-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              <span className="admin-tab-icon">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ─── Contenido dinámico según la pestaña seleccionada ─── */}
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

// ─── Tabla reutilizable para el panel de administración ───
// Recibe un array de encabezados y un array de filas (elementos JSX) para renderizar.
function AdminTable({ headers, rows, emptyMsg = 'Sin datos', className = '' }) {
  return (
    <div className={`admin-table ${className}`}>
      {/* Cabecera de la tabla */}
      <div className="admin-thead">
        {headers.map((h) => <span key={h} className="admin-th">{h}</span>)}
      </div>
      {/* Filas de datos o mensaje vacío si no hay datos */}
      {rows.length > 0 ? rows : (
        <div className="admin-empty">{emptyMsg}</div>
      )}
    </div>
  )
}

// ─── Botones de acción reutilizables (editar, guardar, cancelar, eliminar) ───
// Cambia entre modo edición y modo visualización según el prop `editing`.
function ActionBtns({ editing, onSave, onCancel, onEdit, onDelete }) {
  if (editing) {
    // Modo edición: muestra botones de guardar y cancelar
    return (
      <div className="admin-actions">
        <button type="button" className="admin-btn save" onClick={onSave} title="Guardar"><span className="material-symbols-outlined">check</span></button>
        <button type="button" className="admin-btn cancel" onClick={onCancel} title="Cancelar"><span className="material-symbols-outlined">close</span></button>
      </div>
    )
  }
  // Modo visualización: muestra botones de editar y eliminar
  return (
    <div className="admin-actions">
      <button type="button" className="admin-btn edit" onClick={onEdit} title="Editar"><span className="material-symbols-outlined">edit</span></button>
      <button type="button" className="admin-btn delete" onClick={onDelete} title="Eliminar"><span className="material-symbols-outlined">delete</span></button>
    </div>
  )
}

// ─── Pestaña de Resumen: muestra estadísticas generales del sistema ───
function Resumen() {
  const [stats, setStats] = useState(null)   // Datos de estadísticas del admin
  const [error, setError] = useState('')     // Mensaje de error si falla la carga

  // Carga las estadísticas al montar el componente con AbortController
  useEffect(() => {
    const controller = new AbortController()
    API.get('/admin/stats/', { signal: controller.signal }).then(r => setStats(r.data)).catch(() => setError('Error al cargar'))
    return () => controller.abort()  // Cancela la petición si el componente se desmonta
  }, [])

  if (error) return <Msg type="error" text={error} />
  if (!stats) return <Loader />  // Muestra loader mientras se cargan los datos

  return (
    <div className="admin-resumen">
      {/* Tarjeta: Total de usuarios registrados */}
      <div className="stat-card">
        <span className="stat-icon">👥</span>
        <div>
          <span className="stat-value">{stats.total_usuarios}</span>
          <span className="stat-label">Usuarios registrados</span>
        </div>
      </div>
      {/* Tarjeta: Total de niveles creados */}
      <div className="stat-card">
        <span className="stat-icon">🎮</span>
        <div>
          <span className="stat-value">{stats.total_niveles}</span>
          <span className="stat-label">Niveles creados</span>
        </div>
      </div>
      {/* Tarjeta: Total de partidas jugadas */}
      <div className="stat-card">
        <span className="stat-icon">⚔️</span>
        <div>
          <span className="stat-value">{stats.total_partidas}</span>
          <span className="stat-label">Partidas jugadas</span>
        </div>
      </div>
      {/* Tarjeta: Mejor puntuación global */}
      <div className="stat-card">
        <span className="stat-icon">⭐</span>
        <div>
          <span className="stat-value">{stats.mejor_puntuacion_global}</span>
          <span className="stat-label">Mejor puntuación</span>
        </div>
      </div>
      {/* Tarjeta: Promedio de puntuación global */}
      <div className="stat-card">
        <span className="stat-icon">📈</span>
        <div>
          <span className="stat-value">{stats.promedio_puntuacion_global}</span>
          <span className="stat-label">Promedio global</span>
        </div>
      </div>
      {/* Tarjeta: Total de muertes en el sistema */}
      <div className="stat-card">
        <span className="stat-icon">💀</span>
        <div>
          <span className="stat-value">{stats.total_muertes_global}</span>
          <span className="stat-label">Muertes totales</span>
        </div>
      </div>
      {/* Tarjeta destacada: Jugador más activo (solo si existe) */}
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

// ─── Pestaña de Usuarios: CRUD completo de usuarios ───
function Usuarios() {
  const [usuarios, setUsuarios] = useState([])   // Lista de usuarios cargados
  const [error, setError] = useState('')         // Mensaje de error
  const [editId, setEditId] = useState(null)     // ID del usuario que se está editando (null = ninguno)
  const [form, setForm] = useState({ username: '', email: '', rol: '' })  // Datos del formulario de edición

  // ─── Carga la lista de usuarios desde el backend ───
  const fetchData = async () => {
    try {
      const res = await API.get('/usuarios/')
      setUsuarios(res.data.results || res.data)  // Maneja tanto paginación como array directo
    } catch { setError('Error al cargar') }
  }

  // Carga los datos al montar el componente
  useEffect(() => { fetchData() }, [])

  // ─── Activa el modo edición para un usuario ───
  const startEdit = (u) => { setEditId(u.id); setForm({ username: u.username, email: u.email, rol: u.rol }) }

  // ─── Guarda los cambios de edición en el backend ───
  const save = async (id) => {
    try { await API.put(`/usuarios/${id}/`, form); setEditId(null); fetchData() }  // Cierra edición y recarga
    catch { setError('Error al actualizar') }
  }

  // ─── Elimina un usuario tras confirmación ───
  const del = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return  // Confirmación de seguridad
    try { await API.delete(`/usuarios/${id}/`); fetchData() }
    catch { setError('Error al eliminar') }
  }

  return (
    <>
      {error && <Msg type="error" text={error} />}
      <AdminTable
        headers={['Usuario', 'Email', 'Rol', 'Registro', '']}
        rows={usuarios.map(u => (
          <div key={u.id} className="admin-tr">
            {/* Columna de nombre de usuario (editable o solo lectura) */}
            <span className="admin-td bold">
              {editId === u.id ? <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} className="inp" /> : u.username}
            </span>
            {/* Columna de email (editable o solo lectura) */}
            <span className="admin-td">
              {editId === u.id ? <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="inp" /> : u.email}
            </span>
            {/* Columna de rol (select editable o badge de solo lectura) */}
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
            {/* Columna de fecha de registro formateada */}
            <span className="admin-td date">{u.fecha_registro ? new Date(u.fecha_registro).toLocaleDateString() : '-'}</span>
            {/* Columna de acciones: editar/guardar/cancelar/eliminar */}
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

// ─── Pestaña de Niveles: CRUD completo de niveles del juego ───
function Niveles() {
  const [niveles, setNiveles] = useState([])     // Lista de niveles cargados
  const [error, setError] = useState('')         // Mensaje de error
  const [creating, setCreating] = useState(false) // Modo creación activo/desactivado
  const [newNivel, setNewNivel] = useState({ nombre: '', dificultad: 'facil', tiempo_limite: '' })  // Formulario para nuevo nivel
  const [editId, setEditId] = useState(null)     // ID del nivel que se está editando
  const [form, setForm] = useState({ nombre: '', dificultad: 'facil', tiempo_limite: '' })  // Formulario de edición

  // ─── Carga la lista de niveles desde el backend ───
  const fetchData = async () => {
    try { const res = await API.get('/niveles/'); setNiveles(res.data.results || res.data) }
    catch { setError('Error al cargar') }
  }

  useEffect(() => { fetchData() }, [])

  // ─── Crea un nuevo nivel en el backend ───
  // Convierte tiempo_limite a número o null si está vacío.
  const create = async () => {
    try {
      await API.post('/niveles/', { ...newNivel, tiempo_limite: newNivel.tiempo_limite ? Number(newNivel.tiempo_limite) : null })
      setCreating(false); setNewNivel({ nombre: '', dificultad: 'facil', tiempo_limite: '' }); fetchData()
    } catch { setError('Error al crear') }
  }

  // ─── Activa modo edición para un nivel existente ───
  const startEdit = (n) => { setEditId(n.id); setForm({ nombre: n.nombre, dificultad: n.dificultad, tiempo_limite: n.tiempo_limite || '' }) }

  // ─── Guarda los cambios de edición ───
  const save = async (id) => {
    try { await API.put(`/niveles/${id}/`, { ...form, tiempo_limite: form.tiempo_limite ? Number(form.tiempo_limite) : null }); setEditId(null); fetchData() }
    catch { setError('Error al actualizar') }
  }

  // ─── Elimina un nivel tras confirmación ───
  const del = async (id) => {
    if (!confirm('¿Eliminar este nivel?')) return
    try { await API.delete(`/niveles/${id}/`); fetchData() }
    catch { setError('Error al eliminar') }
  }

  return (
    <>
      {error && <Msg type="error" text={error} />}

      {/* ─── Formulario de creación de nivel (solo visible en modo creación) ─── */}
      {creating ? (
        <div className="admin-create-card">
          <h3 className="create-title">Nuevo nivel</h3>
          <div className="create-fields">
            {/* Input del nombre del nivel */}
            <input placeholder="Nombre del nivel" value={newNivel.nombre} onChange={e => setNewNivel({ ...newNivel, nombre: e.target.value })} className="inp" />
            {/* Select de dificultad con opciones predefinidas */}
            <select value={newNivel.dificultad} onChange={e => setNewNivel({ ...newNivel, dificultad: e.target.value })} className="sel" aria-label="Dificultad">
              <option value="facil">Fácil</option>
              <option value="medio">Medio</option>
              <option value="dificil">Difícil</option>
            </select>
            {/* Input numérico para el tiempo límite en segundos */}
            <input placeholder="Tiempo límite (seg)" type="number" value={newNivel.tiempo_limite} onChange={e => setNewNivel({ ...newNivel, tiempo_limite: e.target.value })} className="inp" style={{ maxWidth: 160 }} />
          </div>
          <div className="create-actions">
            <button type="button" className="btn primary" onClick={create}>Crear nivel</button>
            <button type="button" className="btn ghost" onClick={() => setCreating(false)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn primary" onClick={() => setCreating(true)} style={{ marginBottom: 20 }}>+ Nuevo nivel</button>
      )}

      {/* ─── Tabla de niveles existentes ─── */}
      <AdminTable
        headers={['Nombre', 'Dificultad', 'Tiempo', 'Creado', '']}
        rows={niveles.map(n => (
          <div key={n.id} className="admin-tr">
            {/* Columna de nombre (editable o solo lectura) */}
            <span className="admin-td bold">
              {editId === n.id ? <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} className="inp" /> : n.nombre}
            </span>
            {/* Columna de dificultad (select o badge) */}
            <span className="admin-td">
              {editId === n.id ? (
                <select value={form.dificultad} onChange={e => setForm({ ...form, dificultad: e.target.value })} className="sel">
                  <option value="facil">Fácil</option>
                  <option value="medio">Medio</option>
                  <option value="dificil">Difícil</option>
                </select>
              ) : <Badge d={n.dificultad} />}
            </span>
            {/* Columna de tiempo límite (editable o con formato de segundos) */}
            <span className="admin-td mono">
              {editId === n.id ? (
                <input type="number" value={form.tiempo_limite} onChange={e => setForm({ ...form, tiempo_limite: e.target.value })} className="inp" style={{ maxWidth: 80 }} />
              ) : n.tiempo_limite ? `${n.tiempo_limite}s` : '-'}
            </span>
            {/* Columna de fecha de creación */}
            <span className="admin-td date">{new Date(n.fecha_creacion).toLocaleDateString()}</span>
            {/* Columna de acciones */}
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

// ─── Pestaña de Partidas: listado de todas las partidas del sistema ───
function Partidas() {
  const [partidas, setPartidas] = useState([])  // Lista de partidas cargadas
  const [error, setError] = useState('')        // Mensaje de error

  // Carga las partidas del admin al montar el componente
  useEffect(() => {
    const controller = new AbortController()
    API.get('/admin/partidas/', { signal: controller.signal }).then(r => setPartidas(r.data.results || r.data)).catch(() => setError('Error al cargar'))
    return () => controller.abort()
  }, [])

  return (
    <>
      {error && <Msg type="error" text={error} />}
      {/* Tabla de partidas con todas las columnas relevantes */}
      <AdminTable className="partidas"
        headers={['Jugador', 'Nivel', 'Pts', '💀', 'Tiempo', 'Fecha']}
        rows={partidas.map(p => (
          <div key={p.id} className="admin-tr">
            {/* Nombre del jugador que realizó la partida */}
            <span className="admin-td bold">{p.usuario_username}</span>
            {/* Nombre del nivel con badge de dificultad */}
            <span className="admin-td" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {p.nivel_nombre}
              <span className={`mini-badge ${p.nivel_dificultad?.[0]?.toUpperCase() || '?'}`}>{p.nivel_dificultad?.[0]?.toUpperCase() || '?'}</span>
            </span>
            {/* Puntuación con estilo destacado */}
            <span className="admin-td mono" style={{ color: '#ffb68c', fontWeight: 600 }}>{p.puntuacion}</span>
            {/* Cantidad de muertes */}
            <span className="admin-td mono">{p.muertes}</span>
            {/* Tiempo formateado a MM:SS */}
            <span className="admin-td mono">{p.tiempo ? `${Math.floor(p.tiempo / 60)}:${String(p.tiempo % 60).padStart(2, '0')}` : '-'}</span>
            {/* Fecha de la partida */}
            <span className="admin-td date">{new Date(p.fecha).toLocaleDateString()}</span>
          </div>
        ))}
        emptyMsg="No hay partidas registradas"
      />
    </>
  )
}

// ─── Componente de carga (loader animado) ───
// Se muestra mientras se están cargando datos del backend.
function Loader() {
  return <div className="loading-dots" style={{ padding: 40 }}><div className="dot" /><div className="dot" /><div className="dot" /></div>
}

// ─── Componente de mensaje (éxito o error) ───
// Renderiza un banner con icono y texto según el tipo proporcionado.
function Msg({ type, text }) {
  return <div className={`auth-general-${type}`} style={{ marginBottom: 16 }}><span className="material-symbols-outlined">{type === 'error' ? 'error' : 'info'}</span><span>{text}</span></div>
}
