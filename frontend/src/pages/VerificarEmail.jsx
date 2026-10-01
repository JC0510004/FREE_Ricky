import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import API from '../api/axios'

export default function VerificarEmail() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  // Estado del flujo: 'confirmar' → 'verificando' → 'exito' | 'error'
  //
  // 'confirmar' es un paso intermedio deliberado, no un descuido: el enlace del
  // correo abre esta página pero NO verifica nada por sí solo, hace falta pulsar
  // el botón. Los clientes de correo y sus sistemas antiphishing (Outlook Safe
  // Links, Proofpoint, el antivirus del navegador) siguen los enlaces en
  // segundo plano para analizarlos, y si se verificara al montar la página
  // consumirían el token de un solo uso sin que nadie hubiera pulsado nada,
  // dejándolo invalidado justo cuando el usuario llega a pulsarlo.
  const [status, setStatus] = useState('confirmar')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [correoReenviado, setCorreoReenviado] = useState(false)

  // ─── Confirmación explícita del token ───
  // Solo se llama al pulsar el botón, nunca al montar el componente.
  const handleConfirmar = async () => {
    setIsLoading(true)
    setError('')
    try {
      await API.post('/verificar-email/', { token })
      setStatus('exito')
    } catch {
      setStatus('error')
      setError('El enlace es inválido o ha expirado. Puedes solicitarlo de nuevo.')
    } finally {
      setIsLoading(false)
    }
  }

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

          {/* Paso intermedio: el enlace se abrió pero nada se ha verificado aún */}
          {status === 'confirmar' && token && (
            <>
              <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#9FE0C3', marginBottom: 16 }}>
                help
              </span>
              <h1 className="auth-title">¿Eres Tú?</h1>
              <p className="auth-subtitle" style={{ marginBottom: 24 }}>
                Pulsa el botón para confirmar que este correo es tuyo. Verificarlo
                es lo que te permite jugar.
              </p>
              <button
                type="button"
                onClick={handleConfirmar}
                className="auth-submit"
                disabled={isLoading}
              >
                {isLoading ? 'Verificando...' : 'Sí, soy yo'}
              </button>
              <p className="auth-hint" style={{ marginTop: '16px' }}>
                ¿No has pedido esto? Cierra esta página: tu cuenta sigue sin verificar.
              </p>
            </>
          )}

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
                Tu correo electrónico ha sido confirmado. Ya puedes jugar.
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