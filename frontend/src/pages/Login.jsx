import { useState, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import ErrorMessage from '../components/ErrorMessage'

export default function Login() {
  // ─── Hook de navegación para redirigir después del login ───
  const navigate = useNavigate()

  // ─── Función de login extraída del contexto de autenticación ───
  const { login } = useAuth()

  // ─── Estado del formulario ───
  const [formData, setFormData] = useState({ username: '', password: '' })

  // ─── Estado de errores de validación (campo por campo) ───
  const [errors, setErrors] = useState({})

  // ─── Estado de carga para deshabilitar el formulario durante la petición ───
  const [isLoading, setIsLoading] = useState(false)

  // ─── Control de visibilidad de la contraseña ───
  const [showPassword, setShowPassword] = useState(false)

  // ─── Manejador genérico de cambios en los inputs ───
  // Actualiza el campo correspondiente del formulario de forma inmutable.
  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  // ─── Manejador de envío del formulario ───
  // Valida los campos, realiza la petición de login y redirige al dashboard.
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()           // Previene el reload de la página
    setErrors({})                // Limpia errores previos

    // Validación: el usuario no puede estar vacío
    if (!formData.username.trim()) {
      setErrors((prev) => ({ ...prev, username: 'El usuario es requerido' }))
      return
    }
    // Validación: la contraseña no puede estar vacía
    if (!formData.password) {
      setErrors((prev) => ({ ...prev, password: 'La contraseña es requerida' }))
      return
    }

    setIsLoading(true)
    try {
      // Llama a la función de login del contexto de autenticación
      await login(formData.username.trim(), formData.password)
      navigate('/')              // Redirige a la Landing Page tras login exitoso
    } catch (err) {
      // Extrae el mensaje de error del backend o usa un mensaje genérico
      const message = err?.response?.data?.error || 'Credenciales incorrectas'
      setErrors({ general: message })
    } finally {
      setIsLoading(false)       // Siempre desactiva el estado de carga
    }
  }, [formData, login, navigate])

  return (
    <div className="auth-page">
      <div className="auth-container">

        {/* ─── Tarjeta del formulario de login ─── */}
        <div className="auth-card">

          {/* Logo con enlace a la página principal */}
          <Link to="/" className="auth-logo">SALT BORN</Link>
          <h1 className="auth-title">Iniciar Sesión</h1>
          <p className="auth-subtitle">Ingresa tus credenciales para continuar</p>

          {/* ─── Formulario de login ─── */}
          {/* noValidate desactiva la validación HTML nativa para usar validación JS */}
          <form onSubmit={handleSubmit} className="auth-form" noValidate>

            {/* Campo de usuario o correo electrónico */}
            <div className="auth-field">
              <label htmlFor="username">Usuario o Correo</label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                placeholder="tu_usuario o tu@email.com"
                autoComplete="username"     // Sugiere autocompletado del navegador
                disabled={isLoading}        // Deshabilita durante la carga
              />
              {/* Mensaje de error de validación para este campo */}
              {errors.username && <span className="auth-error">{errors.username}</span>}
            </div>

            {/* Campo de contraseña con botón de visibilidad */}
            <div className="auth-field">
              <label htmlFor="password">Contraseña</label>
              <div className="auth-password-wrapper">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}  // Alterna entre texto visible y puntos
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
                {/* Botón para alternar visibilidad de la contraseña */}
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}              // Excluido del tab order para accesibilidad
                  aria-label={showPassword ? 'Ocultar' : 'Mostrar'}
                >
                  <span className="material-symbols-outlined">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {/* Mensaje de error de validación para la contraseña */}
              {errors.password && <span className="auth-error">{errors.password}</span>}
            </div>

            <ErrorMessage message={errors.general} />

            {/* Enlace a recuperación de contraseña */}
            <div className="auth-forgot">
              <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
            </div>

            {/* Botón de envío con texto dinámico según el estado de carga */}
            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </form>

          {/* ─── Enlace a registro ─── */}
          <p className="auth-footer-text">
            ¿No tienes una cuenta? <Link to="/register">Regístrate</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
