import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import API from '../api/axios'

// ─── Componente de transición post-confirmación ───
// Se muestra cuando el usuario acaba de confirmar su identidad desde el correo.
// Muestra una cuenta regresiva antes de redirigir al formulario de nueva contraseña.
function JustConfirmed({ onReady }) {
  // Estado de la cuenta regresiva (inicia en 3 segundos)
  const [countdown, setCountdown] = useState(3)

  // ─── Timer de cuenta regresiva ───
  // Decrementa cada segundo y ejecuta onReady cuando llega a 0.
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer)  // Detiene el timer cuando termina
          onReady()             // Notifica al padre que puede cambiar de paso
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)  // Limpia el timer al desmontar
  }, [onReady])

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          {/* Icono de éxito grande */}
          <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#22c55e', marginBottom: 16 }}>check_circle</span>
          <h1 className="auth-title">Identidad Confirmada</h1>
          <p className="auth-subtitle">Redirigiendo al formulario de contraseña...</p>
        </div>
      </div>
    </div>
  )
}

export default function ForgotPassword() {
  // ─── Hook de navegación ───
  const navigate = useNavigate()

  // ─── Parámetros de la URL ───
  // Extrae el token de recuperación desde los query params de la URL.
  const [searchParams] = useSearchParams()
  const urlToken = searchParams.get('token') || ''

  // ─── Estado del formulario de email ───
  const [email, setEmail] = useState('')

  // ─── Referencia mutable para el token ───
  // useRef se usa porque el token puede venir de la URL o de la respuesta del backend,
  // y no necesita causar re-render cuando cambia.
  const tokenRef = useRef('')

  // ─── Estado de carga y errores ───
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // ─── Control del flujo paso a paso ───
  // 'form' -> 'sent' -> 'not-confirmed'/'just-confirmed' -> 'reset' -> 'success'
  const [step, setStep] = useState('form')

  // ─── Estado del formulario de nueva contraseña ───
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // ─── Efecto inicial: verificar token si viene en la URL ───
  // Cuando el usuario abre el enlace desde el correo, se verifica el token automáticamente.
  useEffect(() => {
    if (urlToken) {
      tokenRef.current = urlToken   // Almacena el token en la referencia mutable
      setError('')
      const isConfirmed = searchParams.get('confirmed') === '1'
      // Verifica con el backend si el token es válido y si la identidad está confirmada
      API.get(`/password-reset/verificar/?token=${urlToken}`)
        .then((res) => {
          if (res.data?.confirmado) {
            // Si está confirmado y viene del correo, muestra pantalla de transición
            if (isConfirmed) {
              setStep('just-confirmed')
            } else {
              setStep('reset')  // Ya confirmado, va directo al formulario
            }
          } else {
            setStep('not-confirmed')  // Token válido pero identidad no confirmada
          }
        })
        .catch(() => {})
    }
  }, [urlToken])

  // ─── Paso 1: Envío del correo de recuperación ───
  // Valida el correo, lo envía al backend y guarda el token de la respuesta.
  const handleSubmitEmail = useCallback(async (e) => {
    e.preventDefault()
    setError('')

    // Sanitiza el correo eliminando caracteres potencialmente peligrosos
    const sanitized = email.replace(/[<>]/g, '').trim()
    if (!sanitized) { setError('El correo es requerido'); return }
    // Validación de formato de correo con regex
    if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(sanitized)) {
      setError('Debe ser un correo electrónico válido')
      return
    }

    setIsLoading(true)
    try {
      const res = await API.post('/password-reset/', { email: sanitized.toLowerCase() })
      // Guarda el token retornado por el backend (para uso futuro)
      if (res.data?.token) tokenRef.current = res.data.token
      setStep('sent')  // Avanza al paso de "correo enviado"
    } catch {
      setError('Error al procesar la solicitud')
    } finally {
      setIsLoading(false)
    }
  }, [email])

  // ─── Verificación manual de confirmación ───
  // Permite al usuario verificar manualmente si su identidad fue confirmada.
  const handleCheckConfirm = useCallback(async () => {
    const t = tokenRef.current || urlToken
    if (!t) { setError('Token inválido'); return }
    setError('')
    try {
      const res = await API.get(`/password-reset/verificar/?token=${t}`)
      if (res.data?.confirmado) {
        setStep('reset')      // Confirmado: avanza al formulario de contraseña
      } else {
        setStep('not-confirmed')  // No confirmado: muestra mensaje de espera
      }
    } catch {
      setError('Error al verificar identidad')
    }
  }, [urlToken])

  // ─── Paso final: restablecimiento de contraseña ───
  // Valida la nueva contraseña y la envía al backend junto con el token.
  const handleResetPassword = useCallback(async (e) => {
    e.preventDefault()
    setError('')

    // ─── Validación de contraseña ───
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }
    if (!/[A-Z]/.test(password)) { setError('Debe tener una mayúscula'); return }
    if (!/[a-z]/.test(password)) { setError('Debe tener una minúscula'); return }
    if (!/[0-9]/.test(password)) { setError('Debe tener un número'); return }
    if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) { setError('Debe tener un carácter especial'); return }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }

    const t = tokenRef.current || urlToken
    if (!t) { setError('Token inválido'); return }

    setIsLoading(true)
    try {
      await API.post('/password-reset/confirm/', {
        token: t,
        password,
        confirm_password: confirmPassword,
      })
      setStep('success')  // Avanza al paso de éxito
    } catch (err) {
      // ─── Manejo de errores del backend ───
      const data = err?.response?.data
      if (data?.errores) setError(Object.values(data.errores).flat().join('. '))  // Errores por campo
      else if (data?.error) setError(data.error)   // Error general del backend
      else setError('Error al restablecer la contraseña')
    } finally {
      setIsLoading(false)
    }
  }, [urlToken, password, confirmPassword])

  // ─── Renderizado condicional según el paso actual del flujo ───

  // Paso: identidad recién confirmada, muestra cuenta regresiva
  if (step === 'just-confirmed') {
    return (
      <JustConfirmed onReady={() => setStep('reset')} />
    )
  }

  // Paso: contraseña restablecida exitosamente
  if (step === 'success') {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#22c55e', marginBottom: 16 }}>check_circle</span>
            <h1 className="auth-title">Contraseña Restablecida</h1>
            <p className="auth-subtitle" style={{ marginBottom: 32 }}>Tu contraseña ha sido actualizada correctamente.</p>
            {/* Botón para ir al login */}
            <button type="button" onClick={() => navigate('/login')} className="auth-submit">Iniciar Sesión</button>
          </div>
        </div>
      </div>
    )
  }

  // Paso: correo enviado, esperando confirmación del usuario
  if (step === 'sent') {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#22c55e', marginBottom: 16 }}>mail</span>
            <h1 className="auth-title">Correo Enviado</h1>
            <p className="auth-subtitle" style={{ marginBottom: 24 }}>
              Revisa tu correo y haz clic en <strong>"Sí, soy yo"</strong>. Serás redirigido automáticamente para restablecer tu contraseña.
            </p>

            {/* Botón para verificar manualmente si la identidad fue confirmada */}
            <button type="button" onClick={() => {
              const t = tokenRef.current
              if (t) {
                // Consulta al backend si el token ya fue confirmado
                API.get(`/password-reset/verificar/?token=${t}`)
                  .then((res) => {
                    if (res.data?.confirmado) {
                      setStep('reset')  // Confirmado: avanza al formulario
                    } else {
                      setError('Aún no se ha confirmado tu identidad. Revisa tu correo.')
                    }
                  })
                  .catch(() => {
                    setError('Error al verificar. Intenta de nuevo.')
                  })
              } else {
                setError('No se encontró el token. Solicita un nuevo enlace.')
              }
            }} className="auth-submit" style={{ marginBottom: 12 }}>
              Ya confirmé mi correo
            </button>

            {/* Botón para volver al login */}
            <button type="button" onClick={() => navigate('/login')} className="auth-submit" style={{ background: 'rgba(255,255,255,0.1)' }}>
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Paso: identidad no confirmada aún
  if (step === 'not-confirmed') {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#eab308', marginBottom: 16 }}>pending</span>
            <h1 className="auth-title">Identidad No Confirmada</h1>
            <p className="auth-subtitle" style={{ marginBottom: 24 }}>
              Aún no has confirmado tu identidad. Revisa tu correo y haz clic en "Sí, soy yo".
            </p>

            {/* Botón para reenviar el correo de recuperación */}
            <button type="button" onClick={() => { setStep('form'); tokenRef.current = ''; setEmail(''); setError(''); }} className="auth-submit" style={{ background: 'rgba(255,255,255,0.1)' }}>
              Reenviar correo
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── Paso por defecto: formulario de email o formulario de contraseña ───
  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <Link to="/" className="auth-logo">SALT BORN</Link>
          <h1 className="auth-title">Restablecer Contraseña</h1>
          <p className="auth-subtitle">Ingresa tu correo para recibir el enlace</p>

          {step === 'reset' ? (
            <form onSubmit={handleResetPassword} className="auth-form" noValidate>
              {/* Campo de nueva contraseña */}
              <div className="auth-field">
                <label htmlFor="password">Nueva Contraseña</label>
                <div className="auth-password-wrapper">
                  <input
                    id="password" type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  {/* Botón de visibilidad de contraseña */}
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {/* Campo de confirmación de contraseña */}
              <div className="auth-field">
                <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                <div className="auth-password-wrapper">
                  <input
                    id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                  {/* Botón de visibilidad de confirmación */}
                  <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1}>
                    <span className="material-symbols-outlined">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              {/* Mensaje de error de validación */}
              {error && (
                <div className="auth-general-error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Botón de restablecimiento con texto dinámico */}
              <button type="submit" className="auth-submit" disabled={isLoading}>
                {isLoading ? 'Restableciendo...' : 'Restablecer Contraseña'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitEmail} className="auth-form" noValidate>
              {/* Campo de correo electrónico */}
              <div className="auth-field">
                <label htmlFor="email">Correo Electrónico</label>
                <input
                  id="email" type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>

              {/* Mensaje de error */}
              {error && (
                <div className="auth-general-error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Botón de envío con texto dinámico */}
              <button type="submit" className="auth-submit" disabled={isLoading}>
                {isLoading ? 'Enviando...' : 'Enviar Enlace'}
              </button>
            </form>
          )}

          {/* ─── Enlace para volver al login ─── */}
          <p className="auth-footer-text">
            <Link to="/login">Volver al inicio de sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
