import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import API from '../api/axios'
import { useAuth } from '../contexts/useAuth'

export default function VerificarEmail() {
  const navigate = useNavigate()
  const { loginWithResponse } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  // Estado del flujo: 'verificando' → 'exito' | 'error'
  //
  // El enlace verifica directo al abrirse, igual que el de restablecer
  // contraseña: quien lo abre ya demostró posesión del correo, así que no hay
  // un segundo "Sí, soy yo". Los rastreadores antiphishing (Outlook Safe
  // Links, Proofpoint, el antivirus del navegador) hacen GET de la URL sin
  // ejecutar JS, así que nunca disparan el POST de abajo: el token de un solo
  // uso solo se consume cuando el navegador real del usuario monta la página.
  const [status, setStatus] = useState(token ? 'verificando' : 'error')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [correoReenviado, setCorreoReenviado] = useState(false)
  const [emailReenvio, setEmailReenvio] = useState('')
  // El correo a mano solo se pide si hace falta: con el token del enlace en la
  // URL el reenvío identifica la cuenta por el token (mismo clic que en el PC);
  // el campo aparece solo al abrir sin token o si el backend no resolvió.
  const [necesitaCorreo, setNecesitaCorreo] = useState(() => !token)
  // Verificar el email abre sesión (el backend devuelve tokens como el reset):
  // con sesión el botón final lleva a /home, sin ella al login.
  const [sesionAbierta, setSesionAbierta] = useState(false)

  // Dispara la verificación una sola vez, aunque React re-ejecute el efecto
  // (StrictMode en desarrollo) o la página reutilice el mismo token.
  const verificadaRef = useRef(false)

  // ─── Verificación automática al abrir el enlace ───
  // Solo se llama si hay token y una sola vez; nunca en un GET de rastreo.
  useEffect(() => {
    if (!token || verificadaRef.current) return
    verificadaRef.current = true
    const controller = new AbortController()

    API.post('/verificar-email/', { token }, { signal: controller.signal })
      .then((res) => {
        if (controller.signal.aborted) return
        // Auto-login (mismo contrato que /password-reset/confirm/).
        setSesionAbierta(!!loginWithResponse(res.data))
        setStatus('exito')
      })
      .catch((err) => {
        if (controller.signal.aborted || err?.code === 'ERR_CANCELED') return
        setStatus('error')
        // Muestra el motivo real cuando el backend lo da (p. ej. 429 de la
        // cuota compartida de la LAN), en vez del mensaje genérico.
        const data = err?.response?.data
        setError(data?.error || data?.detail || 'El enlace es inválido o ha expirado. Puedes solicitarlo de nuevo.')
      })

    return () => controller.abort()
  }, [token, loginWithResponse])

  // ─── Reenvío del correo de verificación ───
  // El backend acepta el email sin sesión (el enlace se abre en el navegador
  // interno del correo del móvil, donde no hay cookie). Con token en la URL el
  // reenvío se hace solo por el token: nada que teclear. El email del cuerpo es
  // la vía de respaldo cuando el token no resuelve (enlace roto/consumido).
  const handleReenviar = async () => {
    const correo = emailReenvio.trim()
    const body = {}
    if (token) body.token = token
    if (correo) body.email = correo

    if (necesitaCorreo && (!correo || !correo.includes('@'))) {
      setError('Indica tu correo para reenviar el enlace')
      return
    }
    setIsLoading(true)
    setError('')
    try {
      await API.post('/verificar-email/reenviar/', body)
      setCorreoReenviado(true)
    } catch (err) {
      if (err?.response?.status === 400) {
        setNecesitaCorreo(true)
        setError('Indica tu correo para reenviar el enlace')
      } else {
        setError(err?.response?.data?.error || 'No se pudo reenviar el correo. Intenta más tarde.')
      }
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
                {sesionAbierta
                  ? 'Tu correo electrónico ha sido confirmado y tu sesión está abierta.'
                  : 'Tu correo electrónico ha sido confirmado. Ya puedes jugar.'}
              </p>
              {/* Con sesión (auto-login) se entra directo al juego; sin ella, al login */}
              <button type="button" onClick={() => navigate(sesionAbierta ? '/home' : '/login')} className="auth-submit">
                {sesionAbierta ? 'Jugar ahora' : 'Iniciar Sesión'}
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
                <>
                  {necesitaCorreo && (
                    <div className="auth-field" style={{ textAlign: 'left', marginBottom: 16 }}>
                      <label htmlFor="email-reenvio">Tu correo electrónico</label>
                      <input
                        id="email-reenvio"
                        type="email"
                        value={emailReenvio}
                        onChange={(e) => setEmailReenvio(e.target.value)}
                        placeholder="tu@email.com"
                        autoComplete="email"
                        disabled={isLoading}
                      />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleReenviar}
                    className="auth-submit"
                    style={{ background: 'rgba(255,255,255,0.1)', marginTop: 12 }}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Reenviando...' : 'Reenviar correo de verificación'}
                  </button>
                </>
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