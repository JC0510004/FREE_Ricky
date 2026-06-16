import { useState, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function getPasswordStrength(password) {
  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[a-z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) score++
  if (score <= 2) return { score, label: 'Débil', color: '#ef4444' }
  if (score <= 4) return { score, label: 'Media', color: '#eab308' }
  return { score, label: 'Fuerte', color: '#22c55e' }
}

export default function Register() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', confirmPassword: '',
  })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const passwordStrength = useMemo(() => getPasswordStrength(formData.password), [formData.password])

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    setErrors({})

    const newErrors = {}
    if (!formData.username.trim()) newErrors.username = 'El usuario es requerido'
    else if (formData.username.trim().length < 3) newErrors.username = 'Mínimo 3 caracteres'
    else if (!/^[a-zA-Z0-9_]+$/.test(formData.username.trim())) newErrors.username = 'Solo letras, números y _'

    if (!formData.email.trim()) newErrors.email = 'El correo es requerido'
    else if (!/^[a-zA-Z0-9._%+-]+@(gmail|hotmail)\.com$/.test(formData.email.trim())) newErrors.email = 'Debe ser @gmail.com o @hotmail.com'

    if (!formData.password) newErrors.password = 'La contraseña es requerida'
    else if (formData.password.length < 8) newErrors.password = 'Mínimo 8 caracteres'
    else if (!/[A-Z]/.test(formData.password)) newErrors.password = 'Debe tener una mayúscula'
    else if (!/[a-z]/.test(formData.password)) newErrors.password = 'Debe tener una minúscula'
    else if (!/[0-9]/.test(formData.password)) newErrors.password = 'Debe tener un número'
    else if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(formData.password)) newErrors.password = 'Debe tener un carácter especial'

    if (!formData.confirmPassword) newErrors.confirmPassword = 'Confirma tu contraseña'
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'No coinciden'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)
    try {
      await register({
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        confirm_password: formData.confirmPassword,
      })
      navigate('/login')
    } catch (err) {
      const serverErrors = err?.response?.data?.errores
      if (serverErrors) {
        const mapped = {}
        for (const [key, messages] of Object.entries(serverErrors)) {
          if (key === 'username') mapped.username = messages[0]
          else if (key === 'email') mapped.email = messages[0]
          else if (key === 'password') mapped.password = messages[0]
          else if (key === 'confirm_password') mapped.confirmPassword = messages[0]
          else mapped.general = messages[0]
        }
        setErrors(mapped)
      } else {
        setErrors({ general: 'Error al registrar. Intente de nuevo.' })
      }
    } finally {
      setIsLoading(false)
    }
  }, [formData, register, navigate])

  const requirements = [
    { label: 'Al menos 8 caracteres', met: formData.password.length >= 8 },
    { label: 'Una mayúscula', met: /[A-Z]/.test(formData.password) },
    { label: 'Una minúscula', met: /[a-z]/.test(formData.password) },
    { label: 'Un número', met: /[0-9]/.test(formData.password) },
    { label: 'Un carácter especial', met: /[!@#$%^&*(),.?":{}|<>_\-]/.test(formData.password) },
  ]

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <Link to="/" className="auth-logo">SALT BORN</Link>
          <h1 className="auth-title">Crear Cuenta</h1>
          <p className="auth-subtitle">Completa los datos para registrarte</p>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-field">
              <label htmlFor="username">Nombre de Usuario</label>
              <input
                id="username" name="username" type="text"
                value={formData.username} onChange={handleChange}
                placeholder="Tu nombre de usuario"
                autoComplete="username" disabled={isLoading}
              />
              {errors.username && <span className="auth-error">{errors.username}</span>}
            </div>

            <div className="auth-field">
              <label htmlFor="email">Correo Electrónico</label>
              <input
                id="email" name="email" type="email"
                value={formData.email} onChange={handleChange}
                placeholder="tu@email.com"
                autoComplete="email" disabled={isLoading}
              />
              {errors.email && <span className="auth-error">{errors.email}</span>}
            </div>

            <div className="auth-field">
              <label htmlFor="password">Contraseña</label>
              <div className="auth-password-wrapper">
                <input
                  id="password" name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password} onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="new-password" disabled={isLoading}
                />
                <button
                  type="button" className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {errors.password && <span className="auth-error">{errors.password}</span>}
              {formData.password && (
                <>
                  <div className="auth-strength-bar">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="auth-strength-segment"
                        style={{
                          background: i <= passwordStrength.score ? passwordStrength.color : 'rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </div>
                  <span className="auth-strength-label" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </span>
                  <div className="auth-requirements">
                    {requirements.map((req) => (
                      <div key={req.label} className="auth-requirement">
                        <span className={`material-symbols-outlined ${req.met ? 'req-met' : 'req-unmet'}`}>
                          {req.met ? 'check_circle' : 'cancel'}
                        </span>
                        <span className={req.met ? '' : 'req-unmet-text'}>{req.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirmar Contraseña</label>
              <input
                id="confirmPassword" name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword} onChange={handleChange}
                placeholder="••••••••"
                autoComplete="new-password" disabled={isLoading}
              />
              {errors.confirmPassword && <span className="auth-error">{errors.confirmPassword}</span>}
            </div>

            {errors.general && (
              <div className="auth-general-error">
                <span className="material-symbols-outlined">error</span>
                <span>{errors.general}</span>
              </div>
            )}

            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>
          </form>

          <p className="auth-footer-text">
            ¿Ya tienes una cuenta? <Link to="/login">Iniciar Sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
