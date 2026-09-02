import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import API from '../api/axios'
import {
  ArrowLeft, Check, Gamepad2, KeyRound, LogOut, ShieldCheck, UserRound
} from 'lucide-react'
import '../dashboard.css'

function PanelCard({ icon: Icon, title, subtitle, children, wide = false }) {
  return (
    <article className={`fr-card${wide ? ' fr-card-wide' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1.25rem' }}>
        <span className="fr-icon-tile"><Icon size={16} /></span>
        <div>
          <h3 style={{ fontWeight: 600 }}>{title}</h3>
          <p style={{ fontSize: '.75rem', color: 'var(--fr-muted-fg)' }}>{subtitle}</p>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{children}</div>
    </article>
  )
}

function Label({ children }) {
  return (
    <span className="fr-label">{children}</span>
  )
}

function InfoRow({ label, value, accent = false }) {
  return (
    <div className="fr-info-row">
      <span className="fr-info-label">{label}</span>
      {accent
        ? <span className="fr-badge fr-badge-hard">{value}</span>
        : <span style={{ fontSize: '.875rem' }}>{value}</span>}
    </div>
  )
}

export default function Settings() {
  const { user, updateUser, logout } = useAuth()

  // ─── Estado del formulario de perfil ───
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null) // { tipo: 'ok'|'error', texto }

  // ─── Estado del formulario de contraseña ───
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passMsg, setPassMsg] = useState(null)

  // Refresca los valores del perfil cuando cambia el usuario del contexto
  useEffect(() => {
    setUsername(user?.username || '')
    setEmail(user?.email || '')
  }, [user?.username, user?.email])

  // ─── Guardar cambios de perfil (nombre y correo) ───
  const handleSaveProfile = useCallback(async (e) => {
    e.preventDefault()
    setProfileMsg(null)
    if (!username.trim() || !email.trim()) {
      setProfileMsg({ tipo: 'error', texto: 'Completa el nombre de usuario y el correo' })
      return
    }
    setSavingProfile(true)
    try {
      const { data } = await API.put(`/usuarios/${user.id}/`, { username: username.trim(), email: email.trim() })
      updateUser({ username: data.usuario?.username ?? username.trim(), email: data.usuario?.email ?? email.trim() })
      setUsername(data.usuario?.username ?? username.trim())
      setEmail(data.usuario?.email ?? email.trim())
      setProfileMsg({ tipo: 'ok', texto: 'Perfil actualizado correctamente' })
    } catch (err) {
      const detail = err?.response?.data
      const msg =
        (detail && typeof detail === 'object' ? Object.values(detail).flat().filter(Boolean).join(' · ')
          : err?.response?.data?.error) || 'Error al actualizar el perfil'
      setProfileMsg({ tipo: 'error', texto: msg })
    } finally {
      setSavingProfile(false)
    }
  }, [username, email, user?.id, updateUser])

  // ─── Cambiar contraseña ───
  const handleChangePassword = useCallback(async (e) => {
    e.preventDefault()
    setPassMsg(null)
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPassMsg({ tipo: 'error', texto: 'Completa todos los campos de contraseña' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPassMsg({ tipo: 'error', texto: 'Las contraseñas no coinciden' })
      return
    }
    setSavingPassword(true)
    try {
      await API.post('/cambiar-password/', {
        old_password: oldPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setOldPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPassMsg({ tipo: 'ok', texto: 'Contraseña actualizada correctamente' })
    } catch (err) {
      const detail = err?.response?.data
      const msg =
        (detail && typeof detail === 'object' ? Object.values(detail).flat().filter(Boolean).join(' · ')
          : err?.response?.data?.error) || 'Error al cambiar la contraseña'
      setPassMsg({ tipo: 'error', texto: msg })
    } finally {
      setSavingPassword(false)
    }
  }, [oldPassword, newPassword, confirmPassword])

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
            <p className="fr-eyebrow">Configuración</p>
            <h1 className="fr-title">Ajustes de cuenta</h1>
            <p className="fr-subtitle">Gestiona tu perfil y seguridad</p>
          </div>

          {/* ── Settings grid ── */}
          <div className="fr-grid-settings">

            {/* Perfil */}
            <PanelCard icon={UserRound} title="Perfil" subtitle="Actualiza tu información personal">
              <form onSubmit={handleSaveProfile} noValidate>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <Label>Nombre de usuario</Label>
                    <input className="fr-input" value={username} onChange={e => setUsername(e.target.value)} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <Label>Correo electrónico</Label>
                    <input className="fr-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  </label>

                  {profileMsg && (
                    <div className={profileMsg.tipo === 'ok' ? 'fr-success' : 'fr-error'}>
                      {profileMsg.tipo === 'ok' && <Check size={14} />}
                      <span>{profileMsg.texto}</span>
                    </div>
                  )}

                  <button className="fr-btn-primary" type="submit" disabled={savingProfile}>
                    <Check size={14} />{savingProfile ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            </PanelCard>

            {/* Seguridad */}
            <PanelCard icon={KeyRound} title="Seguridad" subtitle="Protege tu cuenta">
              <form onSubmit={handleChangePassword} noValidate>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <Label>Contraseña actual</Label>
                    <input className="fr-input" type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} autoComplete="current-password" />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <Label>Nueva contraseña</Label>
                    <input className="fr-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <Label>Confirmar nueva contraseña</Label>
                    <input className="fr-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" />
                  </label>

                  {passMsg && (
                    <div className={passMsg.tipo === 'ok' ? 'fr-success' : 'fr-error'}>
                      {passMsg.tipo === 'ok' && <Check size={14} />}
                      <span>{passMsg.texto}</span>
                    </div>
                  )}

                  <button className="fr-btn-primary" type="submit" disabled={savingPassword}>
                    <Check size={14} />{savingPassword ? 'Cambiando...' : 'Cambiar contraseña'}
                  </button>
                </div>
              </form>
            </PanelCard>

            {/* Cuenta - full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <PanelCard icon={ShieldCheck} title="Cuenta" subtitle="Estado y permisos" wide>
                <InfoRow label="Rol" value={user?.rol === 'admin' ? 'Administrador' : 'Jugador'} accent />
                <InfoRow label="Miembro desde" value={
                  user?.fecha_registro
                    ? new Date(user.fecha_registro).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
                    : '-'
                } />
                <InfoRow label="Email verificado" value={user?.is_verified ? 'Sí' : 'No'} />
                {user?.last_login && (
                  <InfoRow label="Último acceso" value={
                    new Date(user.last_login).toLocaleDateString('es-ES', {
                      year: 'numeric', month: 'long', day: 'numeric',
                      hour: '2-digit', minute: '2-digit'
                    })
                  } />
                )}
              </PanelCard>
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}
