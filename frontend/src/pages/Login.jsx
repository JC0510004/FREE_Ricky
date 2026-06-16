import { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [formData, setFormData] = useState({ username: '', password: '' })
  const [errors, setErrors] = useState({})
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    setErrors({})

    if (!formData.username.trim()) {
      setErrors((prev) => ({ ...prev, username: 'El usuario es requerido' }))
      return
    }
    if (!formData.password) {
      setErrors((prev) => ({ ...prev, password: 'La contraseña es requerida' }))
      return
    }

    setIsLoading(true)
    try {
      await login(formData.username.trim(), formData.password)
      navigate('/home')
    } catch (err) {
      const message = err?.response?.data?.error || 'Credenciales incorrectas'
      setErrors({ general: message })
    } finally {
      setIsLoading(false)
    }
  }, [formData, login, navigate])

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-card">
          <Link to="/" className="auth-logo">SALT BORN</Link>
          <h1 className="auth-title">Iniciar Sesión</h1>
          <p className="auth-subtitle">Ingresa tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <div className="auth-field">
              <label htmlFor="username">Usuario o Correo</label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                placeholder="tu_usuario o tu@email.com"
                autoComplete="username"
                disabled={isLoading}
              />
              {errors.username && <span className="auth-error">{errors.username}</span>}
            </div>

            <div className="auth-field">
              <label htmlFor="password">Contraseña</label>
              <div className="auth-password-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
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
            </div>

            {errors.general && (
              <div className="auth-general-error">
                <span className="material-symbols-outlined">error</span>
                <span>{errors.general}</span>
              </div>
            )}

            <div className="auth-forgot">
              <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
            </div>

            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

          <p className="auth-footer-text">
            ¿No tienes una cuenta? <Link to="/register">Regístrate</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
