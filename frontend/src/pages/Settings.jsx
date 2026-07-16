import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import API from '../api/axios'

export default function Settings() {
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading, logout } = useAuth()
  const [profile, setProfile] = useState({ username: '', email: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')

  const [pwd, setPwd] = useState({ old: '', new: '', confirm: '' })
  const [changingPwd, setChangingPwd] = useState(false)
  const [pwdSaved, setPwdSaved] = useState('')
  const [pwdError, setPwdError] = useState('')

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isLoading, isAuthenticated, navigate])

  useEffect(() => {
    if (user) {
      setProfile({ username: user.username, email: user.email })
    }
  }, [user])

  const handleProfile = async (e) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')
    setSaved('')
    try {
      await API.put(`/usuarios/${user.id}/`, {
        username: profile.username,
        email: profile.email,
      })
      const stored = localStorage.getItem('usuario:v1')
      if (stored) {
        const updated = { ...JSON.parse(stored), username: profile.username, email: profile.email }
        localStorage.setItem('usuario:v1', JSON.stringify(updated))
      }
      setSaved('Cambios guardados correctamente')
    } catch {
      setError('Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  const handlePassword = async (e) => {
    e.preventDefault()
    setChangingPwd(true)
    setPwdError('')
    setPwdSaved('')
    try {
      await API.post('/cambiar-password/', {
        old_password: pwd.old,
        new_password: pwd.new,
        confirm_password: pwd.confirm,
      })
      setPwd({ old: '', new: '', confirm: '' })
      setPwdSaved('Contraseña actualizada correctamente')
    } catch (err) {
      setPwdError(err.response?.data?.error || 'Error al cambiar la contraseña')
    } finally {
      setChangingPwd(false)
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
            {user.rol === 'admin' && (
              <Link to="/admin" className="gaming-nav-link">Admin</Link>
            )}
            <Link to="/settings" className="gaming-nav-link active">Configuración</Link>
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
            <button type="button" className="gaming-logout-btn" onClick={async () => { await logout(); navigate('/') }}>
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
              <span className="hero-greeting">Configuración</span>
              <h1 className="hero-title">Ajustes de Cuenta</h1>
              <p className="hero-subtitle">Gestiona tu perfil y seguridad</p>
            </div>
          </div>
        </div>

        <div className="settings-grid">
          <section className="settings-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">👤</span>
                Perfil
              </h2>
            </div>
            <form onSubmit={handleProfile} className="settings-form">
              <div className="auth-field">
                <label htmlFor="username">Nombre de Usuario</label>
                <input
                  id="username" type="text"
                  value={profile.username}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value.replace(/[<>]/g, '') })}
                  disabled={saving}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="email">Correo Electrónico</label>
                <input
                  id="email" type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  disabled={saving}
                />
              </div>

              {error && (
                <div className="auth-general-error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              )}

              {saved && (
                <div className="auth-success">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>{saved}</span>
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </section>

          <section className="settings-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">🔒</span>
                Seguridad
              </h2>
            </div>
            <form onSubmit={handlePassword} className="settings-form">
              <div className="auth-field">
                <label htmlFor="old-password">Contraseña Actual</label>
                <input
                  id="old-password" type="password"
                  value={pwd.old}
                  onChange={(e) => setPwd({ ...pwd, old: e.target.value })}
                  disabled={changingPwd}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="new-password">Nueva Contraseña</label>
                <input
                  id="new-password" type="password"
                  value={pwd.new}
                  onChange={(e) => setPwd({ ...pwd, new: e.target.value })}
                  disabled={changingPwd}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="confirm-password">Confirmar Nueva Contraseña</label>
                <input
                  id="confirm-password" type="password"
                  value={pwd.confirm}
                  onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                  disabled={changingPwd}
                />
              </div>

              {pwdError && (
                <div className="auth-general-error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{pwdError}</span>
                </div>
              )}

              {pwdSaved && (
                <div className="auth-success">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>{pwdSaved}</span>
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={changingPwd}>
                {changingPwd ? 'Cambiando...' : 'Cambiar Contraseña'}
              </button>
            </form>
          </section>

          <section className="settings-section settings-info-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">📋</span>
                Cuenta
              </h2>
            </div>
            <div className="settings-info">
              <div className="settings-info-row">
                <span className="settings-info-label">Rol</span>
                <span className={`gaming-badge ${user.rol}`}>
                  {user.rol === 'admin' ? 'Administrador' : 'Jugador'}
                </span>
              </div>
              <div className="settings-info-row">
                <span className="settings-info-label">Miembro desde</span>
                <span className="settings-info-value">
                  {new Date(user.fecha_registro).toLocaleDateString('es-ES', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  })}
                </span>
              </div>
              <div className="settings-info-row">
                <span className="settings-info-label">Email verificado</span>
                <span className={`settings-info-value ${user.is_verified ? 'verified' : 'unverified'}`}>
                  {user.is_verified ? 'Sí' : 'No'}
                </span>
              </div>
              {user.last_login && (
                <div className="settings-info-row">
                  <span className="settings-info-label">Último acceso</span>
                  <span className="settings-info-value">
                    {new Date(user.last_login).toLocaleDateString('es-ES', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })}
                  </span>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
