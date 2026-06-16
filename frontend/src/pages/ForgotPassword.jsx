import { useState, useCallback, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import API from '../api/axios'

export default function ForgotPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const urlToken = searchParams.get('token') || ''

  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('form')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (!urlToken) return
    setToken(urlToken)
    API.get(`/password-reset/verificar/?token=${urlToken}`)
      .then((res) => {
        if (res.data?.confirmado) {
          setStep('reset')
        } else {
          setStep('not-confirmed')
        }
      })
      .catch(() => {})
  }, [])

  const handleSubmitEmail = useCallback(async (e) => {
    e.preventDefault()
    setError('')

    const sanitized = email.replace(/[<>]/g, '').trim()
    if (!sanitized) { setError('El correo es requerido'); return }
    if (!/^[a-zA-Z0-9._%+-]+@(gmail|hotmail)\.com$/.test(sanitized)) {
      setError('Debe ser @gmail.com o @hotmail.com')
      return
    }

    setIsLoading(true)
    try {
      const res = await API.post('/password-reset/', { email: sanitized.toLowerCase() })
      if (res.data?.reset_url) {
        const match = res.data.reset_url.match(/token=([^&]+)/)
        if (match) setToken(match[1])
      }
      setStep('sent')
    } catch {
      setError('Error al procesar la solicitud')
    } finally {
      setIsLoading(false)
    }
  }, [email])

  const handleCheckConfirm = useCallback(async () => {
    const t = token || urlToken
    if (!t) { setError('Token inválido'); return }
    setError('')
    try {
      const res = await API.get(`/password-reset/verificar/?token=${t}`)
      if (res.data?.confirmado) {
        setStep('reset')
      } else {
        setStep('not-confirmed')
      }
    } catch {
      setError('Error al verificar identidad')
    }
  }, [token, urlToken])

  const handleResetPassword = useCallback(async (e) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) { setError('Mínimo 8 caracteres'); return }
    if (!/[A-Z]/.test(password)) { setError('Debe tener una mayúscula'); return }
    if (!/[a-z]/.test(password)) { setError('Debe tener una minúscula'); return }
    if (!/[0-9]/.test(password)) { setError('Debe tener un número'); return }
    if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) { setError('Debe tener un carácter especial'); return }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return }

    const t = token || urlToken
    if (!t) { setError('Token inválido'); return }

    setIsLoading(true)
    try {
      await API.post('/password-reset/confirm/', {
        token: t,
        password,
        confirm_password: confirmPassword,
      })
      setStep('success')
    } catch (err) {
      const data = err?.response?.data
      if (data?.errores) setError(Object.values(data.errores).flat().join('. '))
      else if (data?.error) setError(data.error)
      else setError('Error al restablecer la contraseña')
    } finally {
      setIsLoading(false)
    }
  }, [token, urlToken, password, confirmPassword])

  if (step === 'success') {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#22c55e', marginBottom: 16 }}>check_circle</span>
            <h1 className="auth-title">Contraseña Restablecida</h1>
            <p className="auth-subtitle" style={{ marginBottom: 32 }}>Tu contraseña ha sido actualizada correctamente.</p>
            <button onClick={() => navigate('/login')} className="auth-submit">Iniciar Sesión</button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'sent') {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#22c55e', marginBottom: 16 }}>mail</span>
            <h1 className="auth-title">Correo Enviado</h1>
            <p className="auth-subtitle" style={{ marginBottom: 24 }}>
              Revisa tu correo y haz clic en <strong>"Sí, soy yo"</strong>. Luego presiona "Continuar" aquí.
            </p>

            {error && (
              <div className="auth-general-error" style={{ marginBottom: 16 }}>
                <span className="material-symbols-outlined">error</span>
                <span>{error}</span>
              </div>
            )}

            <button onClick={handleCheckConfirm} className="auth-submit" style={{ marginBottom: 12 }}>
              Continuar
            </button>

            <button onClick={() => navigate('/login')} className="auth-submit" style={{ background: 'rgba(255,255,255,0.1)' }}>
              Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'not-confirmed') {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-card" style={{ textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#eab308', marginBottom: 16 }}>pending</span>
            <h1 className="auth-title">Identidad No Confirmada</h1>
            <p className="auth-subtitle" style={{ marginBottom: 24 }}>
              Aún no has confirmado tu identidad. Revisa tu correo y haz clic en "Sí, soy yo", luego presiona "Continuar".
            </p>

            <button onClick={handleCheckConfirm} className="auth-submit" style={{ marginBottom: 12 }}>
              Verificar de nuevo
            </button>

            <button onClick={() => { setStep('form'); setToken(''); setEmail(''); }} className="auth-submit" style={{ background: 'rgba(255,255,255,0.1)' }}>
              Reenviar correo
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <Link to="/" className="auth-logo">SALT BORN</Link>
          <h1 className="auth-title">Restablecer Contraseña</h1>
          <p className="auth-subtitle">Ingresa tu correo para recibir el enlace</p>

          {step === 'reset' ? (
            <form onSubmit={handleResetPassword} className="auth-form" noValidate>
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
                  <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                  </button>
                </div>
              </div>

              <div className="auth-field">
                <label htmlFor="confirmPassword">Confirmar Contraseña</label>
                <input
                  id="confirmPassword" type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="auth-general-error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={isLoading}>
                {isLoading ? 'Restableciendo...' : 'Restablecer Contraseña'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmitEmail} className="auth-form" noValidate>
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

              {error && (
                <div className="auth-general-error">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={isLoading}>
                {isLoading ? 'Enviando...' : 'Enviar Enlace'}
              </button>
            </form>
          )}

          <p className="auth-footer-text">
            <Link to="/login">Volver al inicio de sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
