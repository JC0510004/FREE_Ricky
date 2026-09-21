import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import API from '../api/axios'

export default function VerificarEmail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  // Estado del flujo: 'verificando' → 'exito' | 'error'
  const [status, setStatus] = useState('verificando')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [correoReenviado, setCorreoReenviado] = useState(false)

  // ─── Verificación automática del token al abrir el enlace ───
  // El enlace del correo apunta a /verificar-email?token=... y este efecto
  // envía el token al backend nada más montar la página. El caso de token
  // ausente se deriva en el render (no se setea estado en el efecto).
  useEffect(() => {
    if (!token) return

    const controller = new AbortController()
    API.post('/verificar-email/', { token }, { signal: controller.signal })
      .then(() => setStatus('exito'))
      .catch(() => {
        setStatus('error')
        setError('El enlace es inválido o ha expirado. Puedes solicitarlo de nuevo.')
      })
    return () => controller.abort()
  }, [token])

  // ─── Reenvío del correo de verificación ───
  // Requiere sesión iniciada (backend honra la cookie/refresh si existe).
  const handleReenviar = async () => {
    setIsLoading(true)
    setError('')
    try {
      await API.post('/verificar-email/reenviar/')
      setCorreoReenviado(true)
    } catch {
      setError('No se pudo reenviar el correo. Intenta más tarde.')
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Un enlace sin token muestra directamente el estado de error ───
  // Se deriva en el render para no setear estado dentro del efecto.
  const errorState = status === 'error' || !token

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>

          {status === 'verificando' && (
            <>
              <span className="spinner" style={{ margin: '16px auto', display: 'block' }} />
              <h1 className="auth-title">Verificando Correo</h1>
              <p className="auth-subtitle">Confirma tu dirección de correo electrónico...</p>
            </>
          )}

          {status === 'exito' && (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#22c55e', marginBottom: 16 }}>
                verified
              </span>
              <h1 className="auth-title">Correo Verificado</h1>
              <p className="auth-subtitle" style={{ marginBottom: 24 }}>
                Tu correo electrónico ha sido confirmado. Ya puedes iniciar sesión.
              </p>
              <button type="button" onClick={() => navigate('/login')} className="auth-submit">
                Iniciar Sesión
              </button>
            </>
          )}

          {errorState && (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#eab308', marginBottom: 16 }}>
                error
              </span>
              <h1 className="auth-title">No se Pudo Verificar</h1>
              <p className="auth-subtitle" style={{ marginBottom: 24 }}>
                {error || 'El enlace no tiene un token válido.'}
              </p>
              {correoReenviado ? (
                <p className="auth-hint" style={{ marginBottom: 24 }}>
                  Correo reenviado. Revisa tu bandeja de entrada.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleReenviar}
                  className="auth-submit"
                  style={{ background: 'rgba(255,255,255,0.1)', marginBottom: 16 }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Enviando...' : 'Reenviar correo de verificación'}
                </button>
              )}
            </>
          )}

          <p className="auth-footer-text">
            <Link to="/login">Volver al inicio de sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}