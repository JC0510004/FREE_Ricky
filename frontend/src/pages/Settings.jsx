import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
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

function Field({ label, value = '', type = 'text' }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
      <span className="fr-label">{label}</span>
      <input className="fr-input" defaultValue={value} type={type} />
    </label>
  )
}

function PrimaryButton({ children }) {
  return (
    <button className="fr-btn-primary" type="button">
      <Check size={14} />{children}
    </button>
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
  const { user, logout } = useAuth()

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
              <Field label="Nombre de usuario" value={user?.username || ''} />
              <Field label="Correo electrónico" value={user?.email || ''} />
              <PrimaryButton>Guardar cambios</PrimaryButton>
            </PanelCard>

            {/* Seguridad */}
            <PanelCard icon={KeyRound} title="Seguridad" subtitle="Protege tu cuenta">
              <Field label="Contraseña actual" type="password" />
              <Field label="Nueva contraseña" type="password" />
              <Field label="Confirmar nueva contraseña" type="password" />
              <PrimaryButton>Cambiar contraseña</PrimaryButton>
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