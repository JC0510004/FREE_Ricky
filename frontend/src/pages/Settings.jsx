import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import API from '../api/axios'

export default function Settings() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [formData, setFormData] = useState({ username: '', email: '' })
  const [error, setError] = useState('')
  const [isSaved, setIsSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login')
    }
  }, [isLoading, isAuthenticated, navigate])

  useEffect(() => {
    if (user) {
      setFormData({ username: user.username, email: user.email })
    }
  }, [user])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')
    try {
      await API.put(`/usuarios/${user.id}/`, {
        username: formData.username,
        email: formData.email,
      })
      const stored = localStorage.getItem('usuario')
      if (stored) {
        const updated = { ...JSON.parse(stored), username: formData.username, email: formData.email }
        localStorage.setItem('usuario', JSON.stringify(updated))
      }
      setIsSaved(true)
      setTimeout(() => setIsSaved(false), 3000)
    } catch {
      setError('Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return null
  if (!user) return null

  return (
    <div className="auth-page">
      <nav className="dashboard-nav">
        <div className="dashboard-nav-inner">
          <Link to="/" className="dashboard-logo">SALT BORN</Link>
          <div className="dashboard-nav-links">
            <Link to="/home" className="dashboard-nav-link">Inicio</Link>
            {user.rol === 'admin' && (
              <Link to="/admin" className="dashboard-nav-link">Admin</Link>
            )}
            <Link to="/settings" className="dashboard-nav-link active">Configuración</Link>
          </div>
          <div className="dashboard-user-area">
            <span className="dashboard-username">{user.username}</span>
            <span className={`dashboard-role ${user.rol}`}>{user.rol === 'admin' ? 'Admin' : 'Jugador'}</span>
            <button className="dashboard-logout-btn" onClick={() => { logout(); navigate('/') }}>
              Cerrar Sesión
            </button>
          </div>
        </div>
      </nav>

      <main className="dashboard-main">
        <div className="dashboard-welcome">
          <h1>Configuración</h1>
          <p>Gestiona tu información personal</p>
        </div>

        <div className="settings-card">
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="username">Nombre de Usuario</label>
              <input
                id="username" type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.replace(/[<>]/g, '') })}
                disabled={saving}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="email">Correo Electrónico</label>
              <input
                id="email" type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                disabled={saving}
              />
            </div>

            {error && (
              <div className="auth-general-error">
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Cambios'}
            </button>

            {isSaved && (
              <div className="auth-success">
                <span className="material-symbols-outlined">check_circle</span>
                <span>Cambios guardados correctamente</span>
              </div>
            )}
          </form>
        </div>
      </main>
    </div>
  )
}
