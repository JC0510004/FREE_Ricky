import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import API from '../api/axios'
import ErrorMessage from '../components/ErrorMessage'
import { useAuth } from '../contexts/useAuth'

export default function ForgotPassword() {
  // ─── Hook de navegación ───
  const navigate = useNavigate()

  // ─── Sesión: tras restablecer, el backend emite credenciales ───
  const { loginWithResponse } = useAuth()

  // ─── Parámetros de la URL ───
  // Extrae el token de recuperación desde los query params de la URL.
  const [searchParams] = useSearchParams()
  const urlToken = searchParams.get('token') || ''

  // ─── Estado del formulario de email ───
  const [email, setEmail] = useState('')

  // ─── Referencia mutable para el token ───
  // useRef se usa porque el token llega por la URL cuando el usuario abre
  // el enlace del correo, y no necesita causar re-render cuando cambia.
  const tokenRef = useRef('')

  // ─── Estado de carga y errores ───
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  // ─── Control del flujo paso a paso ───
  // 'cargando' (solo con token en la URL) -> 'reset' -> 'success'
  // Sin token: 'form' -> 'sent'. 'link-invalido' si el enlace no sirve.
  const [step, setStep] = useState(urlToken ? 'cargando' : 'form')

  // ¿El backend emitió sesión al restablecer? (define el botón del final)
  const [sesionIniciada, setSesionIniciada] = useState(false)

  // ─── Estado del formulario de nueva contraseña ───
  const [codigo, setCodigo] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // ─── Efecto inicial: el enlace del correo abre directo el formulario ───
  // Al cargar con token se confirma la identidad automáticamente
  // (POST /password-reset/confirmar/): el usuario ya demostró posesión del
  // correo al hacer clic, así que no se le vuelve a preguntar "¿Eres tú?".
  // Si la confirmación falla (token caducado o ya invalidado), se comprueba
  // el estado por si el token estaba confirmado de antes: solo entonces se
  // muestra el paso de enlace no válido.
  useEffect(() => {
    const controller = new AbortController()
    if (!urlToken) return () => controller.abort()

    tokenRef.current = urlToken
    API.post('/password-reset/confirmar/', { token: urlToken }, { signal: controller.signal })
      .then(() => setStep('reset'))
      .catch((err) => {
        // Desmontaje (cambio de ruta): no tocar estado ni reintentar.
        if (controller.signal.aborted || err?.code === 'ERR_CANCELED') return
        API.get(`/password-reset/verificar/?token=${urlToken}`, { signal: controller.signal })
          .then((res) => {
            if (res.data?.confirmado) setStep('reset')
            else {
              setError('El enlace no es válido o ha expirado. Solicita uno nuevo.')
              setStep('link-invalido')
            }
          })
          .catch(() => {
            if (controller.signal.aborted) return
            setError('El enlace no es válido o ha expirado. Solicita uno nuevo.')
            setStep('link-invalido')
          })
      })
    return () => controller.abort()
  }, [urlToken])

  // ─── Paso 1: Envío del correo de recuperación ───
  // Valida el correo y lo envía al backend. El token de recuperación se
  // envía SOLO por correo (en el enlace "Sí, soy yo"), por lo que la
  // respuesta del backend no trae token alguno.
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
      await API.post('/password-reset/', { email: sanitized.toLowerCase() })
      setStep('sent')  // Avanza al paso de "correo enviado"
    } catch (err) {
      const data = err?.response?.data
      setError(data?.errores?.email?.[0] || data?.error || data?.detail || 'Error al procesar la solicitud')
    } finally {
      setIsLoading(false)
    }
  }, [email])

  // ─── Paso final: restablecimiento de contraseña ───
  // Valida el código de 6 dígitos (recibido por email) y la nueva contraseña,
  // y los envía al backend junto con el token. El código se valida primero
  // de forma independiente para dar feedback inmediato antes de la contraseña.
  const handleResetPassword = useCallback(async (e) => {
    e.preventDefault()
    setError('')

    // ─── Validación del código de verificación ───
    if (!/^\d{6}$/.test(codigo)) { setError('El código debe ser de 6 dígitos'); return }

    // ─── Validación de contraseña ───
    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }
    if (!/[A-Z]/.test(password)) { setError('Debe tener una mayúscula'); return }
    if (!/[a-z]/.test(password)) { setError('Debe tener una minúscula'); return }
    if (!/[0-9]/.test(password)) { setError('Debe tener un número'); return }
    if (!/[!@#$%^&*(),.?":{}|<>_-]/.test(password)) { setError('Debe tener un carácter especial'); return }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }

    const t = tokenRef.current || urlToken
    if (!t) { setError('Token inválido'); return }

    setIsLoading(true)
    try {
      // Primer paso: validar el código del email con el token.
      const verificado = await API.post('/password-reset/verificar-codigo/', { token: t, codigo })
      if (!verificado.data?.valido) {
        setError('Código de verificación inválido')
        return
      }
      // Segundo paso: fijar la nueva contraseña (el backend revalida el código).
      // La respuesta trae usuario + access_token: la sesión se abre sola.
      const res = await API.post('/password-reset/confirm/', {
        token: t,
        codigo,
        password,
        confirm_password: confirmPassword,
      })
      setSesionIniciada(!!loginWithResponse(res.data))
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
  }, [urlToken, password, confirmPassword, codigo, loginWithResponse])

  // ─── Renderizado condicional según el paso actual del flujo ───

  // Paso: el enlace abrió la página y se está confirmando el token
  if (step === 'cargando') {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <span className="spinner" style={{ margin: '16px auto', display: 'block' }} />
            <h1 className="auth-title">Abriendo tu enlace</h1>
            <p className="auth-subtitle">Un momento, estamos preparando el formulario...</p>
          </div>
        </div>
      </div>
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
            <p className="auth-subtitle" style={{ marginBottom: 32 }}>
              {sesionIniciada
                ? 'Tu contraseña ha sido actualizada y tu sesión está abierta.'
                : 'Tu contraseña ha sido actualizada correctamente.'}
            </p>
            {/* Con sesión abierta se entra directo al juego; sin ella, al login */}
            <button
              type="button"
              onClick={() => navigate(sesionIniciada ? '/home' : '/login')}
              className="auth-submit"
            >
              {sesionIniciada ? 'Jugar ahora' : 'Iniciar Sesión'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Paso: correo enviado, esperando que el usuario abra el enlace
  if (step === 'sent') {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#22c55e', marginBottom: 16 }}>mail</span>
            <h1 className="auth-title">Correo Enviado</h1>
            <p className="auth-subtitle" style={{ marginBottom: 24 }}>
              Revisa tu correo: haz clic en <strong>"Restablecer mi contraseña"</strong>, anota el <strong>código de 6 dígitos</strong> y pon tu nueva contraseña en la página que se abre.
            </p>

            {/* Botón para volver al login */}
            <button type="button" onClick={() => navigate('/login')} className="auth-submit" style={{ background: 'rgba(255,255,255,0.1)' }}>
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Paso: el enlace no sirve (expirado, ya usado o incorrecto)
  if (step === 'link-invalido') {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#eab308', marginBottom: 16 }}>error</span>
            <h1 className="auth-title">Enlace No Válido</h1>
            <p className="auth-subtitle" style={{ marginBottom: 24 }}>{error}</p>

            <button type="button" onClick={() => { setStep('form'); tokenRef.current = ''; setEmail(''); setError(''); }} className="auth-submit" style={{ background: 'rgba(255,255,255,0.1)' }}>
              Solicitar un enlace nuevo
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
              {/* Campo del código de verificación de 6 dígitos */}
              <div className="auth-field">
                <label htmlFor="codigo">Código de Verificación</label>
                <input
                  id="codigo" inputMode="numeric" maxLength={6}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  autoComplete="one-time-code"
                  disabled={isLoading}
                />
                <small className="auth-hint">Revisa tu correo: el código de 6 dígitos viene junto al enlace.</small>
              </div>

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
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar' : 'Mostrar'}>
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
                  <button type="button" className="auth-password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? 'Ocultar' : 'Mostrar'}>
                    <span className="material-symbols-outlined">{showConfirmPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <ErrorMessage message={error} />

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

              <ErrorMessage message={error} />

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
