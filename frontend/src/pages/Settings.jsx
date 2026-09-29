import { useState, useCallback, useEffect, useRef, memo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import API from '../api/axios'
import {
  ArrowLeft, Check, Gamepad2, KeyRound, LogOut, ShieldCheck, UserRound
} from 'lucide-react'
import LoadingDots from '../components/LoadingDots'
import { extractApiError } from '../utils/format'
import '../dashboard.css'

// ─── ICONOS DECORATIVOS ────────────────────────────────────────────────
// Todos los iconos de esta página acompañan a un texto que ya describe la
// acción ("Guardar cambios", "Cerrar sesión"...). Sin ocultarlos, el lector
// de pantalla anuncia el nombre del icono y el del texto: el mismo concepto
// dos veces. aria-hidden los saca del árbol de accesibilidad; focusable=false
// impide que el SVG entre en el orden de tabulación en navegadores viejos.
function Icono({ as: Icon, size = 16, ...rest }) {
  return <Icon size={size} aria-hidden="true" focusable="false" {...rest} />
}

function PanelCard({ icon: Icon, title, subtitle, children, wide = false }) {
  return (
    <article className={`fr-card${wide ? ' fr-card-wide' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1.25rem' }}>
        <span className="fr-icon-tile"><Icono as={Icon} /></span>
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

// ─── ESTADO DE CARGA DEL PERFIL ────────────────────────────────────────
// role="status" para que un lector de pantalla anuncie la espera en lugar de
// leer un formulario vacío que el usuario podría guardar por error.
function PerfilCargando() {
  return (
    <div className="fr-dash">
      <main className="fr-main">
        <div className="fr-container" style={{ paddingTop: '4rem' }}>
          <div role="status" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <p className="fr-subtitle">Cargando tu perfil...</p>
            <LoadingDots />
          </div>
        </div>
      </main>
    </div>
  )
}

// Memoización: InfoRow/Label reciben solo props primitivas (label, value, accent).
// Al escribir en los formularios de perfil/contraseña, Settings re-renderiza
// frecuentemente; memo evita re-renderizar las filas de la tarjeta "Cuenta"
// cuyos valores no han cambiado.
const MemoInfoRow = memo(InfoRow)
const MemoLabel = memo(Label)

// Ids de los mensajes de error del formulario de perfil. Son constantes y
// únicos en la página: los inputs los referencian con aria-describedby para
// que el lector de pantalla lea el motivo del rechazo junto al campo.
const PERFIL_ERROR_ID = 'perfil-error'
const USERNAME_ID = 'perfil-username'
const EMAIL_ID = 'perfil-email'

export default function Settings() {
  const { user, updateUser, logout } = useAuth()

  // ─── Estado del formulario de perfil ───
  // Se inicializa con el usuario del contexto en lugar de cadena vacía.
  // Antes arrancaba en '' y la precarga vivía en un bloque `prevProfileId`
  // que se comparaba contra el id ya presente: la condición era falsa en el
  // primer render, el bloque no corría nunca, y el formulario aparecía vacío.
  // Con los campos vacíos, guardar enviaba blanco y el backend terminaba
  // borrando el perfil.
  const [username, setUsername] = useState(user?.username ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null) // { tipo: 'ok'|'error', texto }

  // Marca los campos que el usuario ya ha tocado. Mientras no haya edits, la
  // respuesta autoritativa del backend puede rellenar el formulario; si ya
  // los ha tocado, sobrescribir su escritura sería un bug visible.
  const profileDirty = useRef(false)

  // ─── Estado del formulario de contraseña ───
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passMsg, setPassMsg] = useState(null)

  // ─── Carga del perfil real ───
  // El contexto puede estar desactualizado (se hidrata de localStorage) o
  // incompleto. GET /usuarios/<id>/ es la fuente de verdad: precarga el
  // formulario con los datos reales y sincroniza el contexto con la respuesta
  // para que Navbar/ProtectedRoute no sigan viendo el perfil viejo.
  useEffect(() => {
    if (!user?.id) return
    const ctrl = new AbortController()
    API.get(`/usuarios/${user.id}/`, { signal: ctrl.signal })
      .then(({ data }) => {
        if (!data) return
        if (!profileDirty.current) {
          setUsername(data.username ?? '')
          setEmail(data.email ?? '')
        }
        updateUser({
          username: data.username,
          email: data.email,
          rol: data.rol,
          fecha_registro: data.fecha_registro,
          is_verified: data.is_verified,
          last_login: data.last_login,
        })
      })
      .catch((err) => {
        if (err?.name === 'CanceledError') return
        setProfileMsg({ tipo: 'error', texto: extractApiError(err?.response?.data, 'No se ha podido cargar tu perfil') })
      })
    return () => ctrl.abort()
  }, [user?.id, updateUser])

  const onUsernameChange = useCallback((e) => {
    profileDirty.current = true
    setUsername(e.target.value)
  }, [])

  const onEmailChange = useCallback((e) => {
    profileDirty.current = true
    setEmail(e.target.value)
  }, [])

  // ─── Guardar cambios de perfil (nombre y correo) ───
  const handleSaveProfile = useCallback(async (e) => {
    e.preventDefault()
    setProfileMsg(null)
    // Guarda de seguridad: sin esto, un formulario en blanco (o con solo
    // espacios) se envía al backend y termina vaciando el perfil.
    if (!username.trim() || !email.trim()) {
      setProfileMsg({ tipo: 'error', texto: 'Completa el nombre de usuario y el correo' })
      return
    }
    setSavingProfile(true)
    try {
      const { data } = await API.put(`/usuarios/${user.id}/`, { username: username.trim(), email: email.trim() })
      const guardado = data.usuario ?? {}
      updateUser({ username: guardado.username ?? username.trim(), email: guardado.email ?? email.trim() })
      // El servidor manda: reflejamos exactamente lo que guardó, no lo escrito.
      setUsername(guardado.username ?? username.trim())
      setEmail(guardado.email ?? email.trim())
      profileDirty.current = false
      setProfileMsg({ tipo: 'ok', texto: 'Perfil actualizado correctamente' })
    } catch (err) {
      setProfileMsg({ tipo: 'error', texto: extractApiError(err?.response?.data, 'Error al actualizar el perfil') })
    } finally {
      setSavingProfile(false)
    }
  }, [username, email, user, updateUser])

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
      setPassMsg({ tipo: 'error', texto: extractApiError(err?.response?.data, 'Error al cambiar la contraseña') })
    } finally {
      setSavingPassword(false)
    }
  }, [oldPassword, newPassword, confirmPassword])

  // ─── Estado de carga ───
  // Sin usuario en el contexto todavía no hay nada fiable que preformar:
  // pintar los inputs vacíos invitaba a guardar un perfil en blanco.
  if (!user?.id) return <PerfilCargando />

  const perfilError = profileMsg?.tipo === 'error' ? profileMsg.texto : null

  return (
    <div className="fr-dash">
      <main className="fr-main">

        {/* ── Header ── */}
        <header className="fr-header">
          <Link className="fr-btn-back" to="/">
            <Icono as={ArrowLeft} />Volver al inicio
          </Link>
          <div className="fr-header-brand">
            <span className="fr-brand-mark"><Icono as={Gamepad2} /></span>
            <span>FREE_RICKY</span>
          </div>
          <button className="fr-btn-logout" type="button" onClick={() => logout()}>
            <Icono as={LogOut} />
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
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }} htmlFor={USERNAME_ID}>
                    <MemoLabel>Nombre de usuario</MemoLabel>
                    <input
                      className="fr-input"
                      id={USERNAME_ID}
                      name="username"
                      required
                      minLength={3}
                      autoComplete="username"
                      value={username}
                      onChange={onUsernameChange}
                      aria-invalid={perfilError ? 'true' : undefined}
                      aria-describedby={perfilError ? PERFIL_ERROR_ID : undefined}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }} htmlFor={EMAIL_ID}>
                    <MemoLabel>Correo electrónico</MemoLabel>
                    <input
                      className="fr-input"
                      id={EMAIL_ID}
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={onEmailChange}
                      aria-invalid={perfilError ? 'true' : undefined}
                      aria-describedby={perfilError ? PERFIL_ERROR_ID : undefined}
                    />
                  </label>

                  {profileMsg && (
                    <div
                      id={PERFIL_ERROR_ID}
                      className={profileMsg.tipo === 'ok' ? 'fr-success' : 'fr-error'}
                      role={profileMsg.tipo === 'ok' ? 'status' : 'alert'}
                    >
                      {profileMsg.tipo === 'ok' && <Icono as={Check} size={14} />}
                      <span>{profileMsg.texto}</span>
                    </div>
                  )}

                  <button className="fr-btn-primary" type="submit" disabled={savingProfile}>
                    <Icono as={Check} size={14} />{savingProfile ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            </PanelCard>

            {/* Seguridad */}
            <PanelCard icon={KeyRound} title="Seguridad" subtitle="Protege tu cuenta">
              <form onSubmit={handleChangePassword} noValidate>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <MemoLabel>Contraseña actual</MemoLabel>
                    <input className="fr-input" type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} autoComplete="current-password" required />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <MemoLabel>Nueva contraseña</MemoLabel>
                    <input className="fr-input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
                    <MemoLabel>Confirmar nueva contraseña</MemoLabel>
                    <input className="fr-input" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" required minLength={8} />
                  </label>

                  {passMsg && (
                    <div
                      className={passMsg.tipo === 'ok' ? 'fr-success' : 'fr-error'}
                      role={passMsg.tipo === 'ok' ? 'status' : 'alert'}
                    >
                      {passMsg.tipo === 'ok' && <Icono as={Check} size={14} />}
                      <span>{passMsg.texto}</span>
                    </div>
                  )}

                  <button className="fr-btn-primary" type="submit" disabled={savingPassword}>
                    <Icono as={Check} size={14} />{savingPassword ? 'Cambiando...' : 'Cambiar contraseña'}
                  </button>
                </div>
              </form>
            </PanelCard>

            {/* Cuenta - full width */}
            <div style={{ gridColumn: '1 / -1' }}>
              <PanelCard icon={ShieldCheck} title="Cuenta" subtitle="Estado y permisos" wide>
                <MemoInfoRow label="Rol" value={user?.rol === 'admin' ? 'Administrador' : 'Jugador'} accent />
                <MemoInfoRow label="Miembro desde" value={
                  user?.fecha_registro
                    ? new Date(user.fecha_registro).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
                    : '-'
                } />
                <MemoInfoRow label="Email verificado" value={user?.is_verified ? 'Sí' : 'No'} />
                {user?.last_login && (
                  <MemoInfoRow label="Último acceso" value={
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
