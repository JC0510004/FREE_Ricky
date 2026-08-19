import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import API from '../api/axios'

export default function Settings() {
  // ─── Hook de navegación para redirigir al login si no hay sesión ───
  const navigate = useNavigate()

  // ─── Datos y funciones del contexto de autenticación ───
  const { user, isAuthenticated, isLoading, updateUser } = useAuth()

  // ─── Estado del formulario de perfil ───
  const [profile, setProfile] = useState({ username: '', email: '' })
  const [saving, setSaving] = useState(false)     // Estado de carga al guardar perfil
  const [saved, setSaved] = useState('')           // Mensaje de éxito al guardar
  const [error, setError] = useState('')           // Mensaje de error al guardar

  // ─── Estado del formulario de contraseña ───
  const [pwd, setPwd] = useState({ old: '', new: '', confirm: '' })
  const [changingPwd, setChangingPwd] = useState(false)  // Estado de carga al cambiar contraseña
  const [pwdSaved, setPwdSaved] = useState('')            // Mensaje de éxito al cambiar
  const [pwdError, setPwdError] = useState('')            // Mensaje de error al cambiar

  // ─── Redirección si no está autenticado ───
  // Protege la ruta: si el usuario cierra sesión desde otra pestaña, se redirige.
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/')
    }
  }, [isLoading, isAuthenticated, navigate])

  // ─── Sincroniza el formulario de perfil con los datos del usuario ───
  // Se ejecuta cuando el objeto user cambia (login, actualización, etc.)
  useEffect(() => {
    if (user) {
      setProfile({ username: user.username, email: user.email })
    }
  }, [user])

  // ─── Manejador de actualización de perfil ───
  // Envía los cambios de username y email al backend y actualiza el contexto local.
  const handleProfile = async (e) => {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError('')
    setSaved('')
    try {
      const res = await API.put(`/usuarios/${user.id}/`, {
        username: profile.username,
        email: profile.email,
      })
      // Actualiza el contexto de autenticación con los datos devueltos por el backend
      if (res.data?.usuario) {
        updateUser(res.data.usuario)
      } else {
        updateUser({ username: profile.username, email: profile.email })
      }
      setSaved('Cambios guardados correctamente')
    } catch (err) {
      const data = err?.response?.data
      if (data?.username) setError(Array.isArray(data.username) ? data.username[0] : data.username)
      else if (data?.email) setError(Array.isArray(data.email) ? data.email[0] : data.email)
      else if (data?.error) setError(data.error)
      else setError('Error al guardar los cambios')
    } finally {
      setSaving(false)
    }
  }

  // ─── Manejador de cambio de contraseña ───
  // Valida y envía la nueva contraseña al backend.
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
      // Limpia el formulario tras el cambio exitoso
      setPwd({ old: '', new: '', confirm: '' })
      setPwdSaved('Contraseña actualizada correctamente')
    } catch (err) {
      setPwdError(err.response?.data?.error || 'Error al cambiar la contraseña')
    } finally {
      setChangingPwd(false)
    }
  }

  // ─── Guardias de renderizado ───
  if (isLoading) return null
  if (!user) return null

  return (
    <div className="gaming-dashboard">

      {/* ─── Contenido principal ─── */}
      <main className="gaming-main">

        {/* ─── Hero section con título de la página ─── */}
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

        {/* ─── Grid de secciones de configuración ─── */}
        <div className="settings-grid">

          {/* ─── Sección 1: Edición de perfil ─── */}
          <section className="settings-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">👤</span>
                Perfil
              </h2>
            </div>
            {/* Formulario de edición de perfil */}
            <form onSubmit={handleProfile} className="settings-form">
              {/* Campo de nombre de usuario */}
              <div className="auth-field">
                <label htmlFor="username">Nombre de Usuario</label>
                <input
                  id="username" type="text"
                  value={profile.username}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value.replace(/[<>]/g, '') })}
                  disabled={saving}
                />
              </div>

              {/* Campo de correo electrónico */}
              <div className="auth-field">
                <label htmlFor="email">Correo Electrónico</label>
                <input
                  id="email" type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  disabled={saving}
                />
              </div>

              {/* Mensaje de error si falla la actualización */}
              {error && (
                <div className="auth-general-error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Mensaje de éxito tras guardar correctamente */}
              {saved && (
                <div className="auth-success">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>{saved}</span>
                </div>
              )}

              {/* Botón de guardar con texto dinámico según el estado de carga */}
              <button type="submit" className="auth-submit" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </form>
          </section>

          {/* ─── Sección 2: Cambio de contraseña ─── */}
          <section className="settings-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">🔒</span>
                Seguridad
              </h2>
            </div>
            {/* Formulario de cambio de contraseña */}
            <form onSubmit={handlePassword} className="settings-form">
              {/* Campo de contraseña actual */}
              <div className="auth-field">
                <label htmlFor="old-password">Contraseña Actual</label>
                <input
                  id="old-password" type="password"
                  value={pwd.old}
                  onChange={(e) => setPwd({ ...pwd, old: e.target.value })}
                  disabled={changingPwd}
                />
              </div>

              {/* Campo de nueva contraseña */}
              <div className="auth-field">
                <label htmlFor="new-password">Nueva Contraseña</label>
                <input
                  id="new-password" type="password"
                  value={pwd.new}
                  onChange={(e) => setPwd({ ...pwd, new: e.target.value })}
                  disabled={changingPwd}
                />
              </div>

              {/* Campo de confirmación de la nueva contraseña */}
              <div className="auth-field">
                <label htmlFor="confirm-password">Confirmar Nueva Contraseña</label>
                <input
                  id="confirm-password" type="password"
                  value={pwd.confirm}
                  onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
                  disabled={changingPwd}
                />
              </div>

              {/* Mensaje de error si falla el cambio */}
              {pwdError && (
                <div className="auth-general-error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{pwdError}</span>
                </div>
              )}

              {/* Mensaje de éxito tras cambiar correctamente */}
              {pwdSaved && (
                <div className="auth-success">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span>{pwdSaved}</span>
                </div>
              )}

              {/* Botón de cambio con texto dinámico */}
              <button type="submit" className="auth-submit" disabled={changingPwd}>
                {changingPwd ? 'Cambiando...' : 'Cambiar Contraseña'}
              </button>
            </form>
          </section>

          {/* ─── Sección 3: Información de la cuenta (solo lectura) ─── */}
          <section className="settings-section settings-info-section">
            <div className="section-header">
              <h2 className="section-title">
                <span className="section-icon">📋</span>
                Cuenta
              </h2>
            </div>
            <div className="settings-info">
              {/* Fila: Rol del usuario */}
              <div className="settings-info-row">
                <span className="settings-info-label">Rol</span>
                <span className={`gaming-badge ${user.rol}`}>
                  {user.rol === 'admin' ? 'Administrador' : 'Jugador'}
                </span>
              </div>
              {/* Fila: Fecha de registro formateada en español */}
              <div className="settings-info-row">
                <span className="settings-info-label">Miembro desde</span>
                <span className="settings-info-value">
                  {user.fecha_registro ? new Date(user.fecha_registro).toLocaleDateString('es-ES', {
                    year: 'numeric', month: 'long', day: 'numeric'
                  }) : '-'}
                </span>
              </div>
              {/* Fila: Estado de verificación del email */}
              <div className="settings-info-row">
                <span className="settings-info-label">Email verificado</span>
                <span className={`settings-info-value ${user.is_verified ? 'verified' : 'unverified'}`}>
                  {user.is_verified ? 'Sí' : 'No'}
                </span>
              </div>
              {/* Fila: Último acceso (solo si hay registro de último login) */}
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
