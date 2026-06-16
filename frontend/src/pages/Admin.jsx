import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import API from '../api/axios'

export default function Admin() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [usuarios, setUsuarios] = useState([])
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editData, setEditData] = useState({ username: '', email: '', rol: '' })

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isLoading, isAuthenticated, navigate])

  useEffect(() => {
    if (user && user.rol !== 'admin') {
      navigate('/home')
    }
  }, [user, navigate])

  useEffect(() => {
    fetchUsuarios()
  }, [])

  const fetchUsuarios = async () => {
    try {
      const res = await API.get('/usuarios/')
      setUsuarios(res.data)
    } catch {
      setError('Error al cargar usuarios')
    }
  }

  const handleEdit = (usuario) => {
    setEditingId(usuario.id)
    setEditData({ username: usuario.username, email: usuario.email, rol: usuario.rol })
  }

  const handleSave = async (id) => {
    try {
      await API.put(`/usuarios/${id}/`, editData)
      setEditingId(null)
      fetchUsuarios()
    } catch {
      setError('Error al actualizar')
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return
    try {
      await API.delete(`/usuarios/${id}/`)
      fetchUsuarios()
    } catch {
      setError('Error al eliminar')
    }
  }

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
        <div className="gaming-hero" style={{ paddingBottom: 40 }}>
          <div className="hero-glow" />
          <div className="hero-content">
            <div className="hero-text">
              <span className="hero-greeting">Administración</span>
              <h1 className="hero-title">Panel de Control</h1>
              <p className="hero-subtitle">Gestiona todos los usuarios del sistema</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="auth-general-error" style={{ marginBottom: '1rem' }}>
            <span className="material-symbols-outlined">error</span>
            <span>{error}</span>
          </div>
        )}

        <div className="gaming-section" style={{ padding: '0 32px' }}>
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Registro</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    {editingId === u.id ? (
                      <input
                        value={editData.username}
                        onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                        className="admin-edit-input"
                      />
                    ) : (
                      <span className="admin-cell-bold">{u.username}</span>
                    )}
                  </td>
                  <td>
                    {editingId === u.id ? (
                      <input
                        value={editData.email}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        className="admin-edit-input"
                      />
                    ) : (
                      u.email
                    )}
                  </td>
                  <td>
                    {editingId === u.id ? (
                      <select
                        value={editData.rol}
                        onChange={(e) => setEditData({ ...editData, rol: e.target.value })}
                        className="admin-edit-select"
                      >
                        <option value="jugador">Jugador</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className={`admin-role-badge ${u.rol}`}>{u.rol}</span>
                    )}
                  </td>
                  <td className="admin-cell-date">{new Date(u.fecha_registro).toLocaleDateString()}</td>
                  <td>
                    <div className="admin-actions">
                      {editingId === u.id ? (
                        <>
                          <button className="admin-btn admin-btn-save" onClick={() => handleSave(u.id)}>
                            <span className="material-symbols-outlined">check</span>
                          </button>
                          <button className="admin-btn admin-btn-cancel" onClick={() => setEditingId(null)}>
                            <span className="material-symbols-outlined">close</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="admin-btn admin-btn-edit" onClick={() => handleEdit(u)}>
                            <span className="material-symbols-outlined">edit</span>
                          </button>
                          <button className="admin-btn admin-btn-delete" onClick={() => handleDelete(u.id)}>
                            <span className="material-symbols-outlined">delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      </main>
    </div>
  )
}
