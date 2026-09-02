import { useState, useCallback, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import ErrorMessage from '../components/ErrorMessage'

// ─── Función auxiliar para evaluar la fortaleza de la contraseña ───
// Asigna un puntaje según múltiples criterios: longitud, mayúsculas, minúsculas,
// números y caracteres especiales. Retorna el puntaje, una etiqueta descriptiva y un color.
function getPasswordStrength(password) {
  let score = 0
  if (password.length >= 8) score++       // Longitud mínima aceptable
  if (password.length >= 12) score++      // Longitud ideal para mayor seguridad
  if (/[A-Z]/.test(password)) score++     // Tiene al menos una mayúscula
  if (/[a-z]/.test(password)) score++     // Tiene al menos una minúscula
  if (/[0-9]/.test(password)) score++     // Tiene al menos un número
  if (/[!@#$%^&*(),.?":{}|<>_-]/.test(password)) score++  // Tiene un carácter especial
  if (score <= 2) return { score, label: 'Débil', color: '#ef4444' }   // Rojo para débil
  if (score <= 4) return { score, label: 'Media', color: '#eab308' }   // Amarillo para media
  return { score, label: 'Fuerte', color: '#22c55e' }                   // Verde para fuerte
}

export default function Register() {
  // ─── Hook de navegación para redirigir al login después del registro ───
  const navigate = useNavigate()

  // ─── Función de registro extraída del contexto de autenticación ───
  const { register, login } = useAuth()

  // ─── Estado del formulario con todos los campos de registro ───
  const [formData, setFormData] = useState({
    username: '', email: '', password: '', confirmPassword: '',
  })

  // ─── Estado de errores de validación por campo ───
  const [errors, setErrors] = useState({})

  // ─── Estado de carga para deshabilitar el formulario durante la petición ───
  const [isLoading, setIsLoading] = useState(false)

  // ─── Estados para alternar visibilidad de contraseñas ───
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // ─── Cálculo memoizado de la fortaleza de la contraseña ───
  // useMemo evita recalcular en cada render; solo se recalcula cuando cambia la contraseña.
  const passwordStrength = useMemo(() => getPasswordStrength(formData.password), [formData.password])

  // ─── Manejador genérico de cambios en los inputs ───
  const handleChange = useCallback((e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }, [])

  // ─── Manejador de envío del formulario de registro ───
  // Valida todos los campos, envía la petición al backend y maneja errores del servidor.
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    setErrors({})  // Limpia errores previos

    // ─── Validación del nombre de usuario ───
    const newErrors = {}
    if (!formData.username.trim()) newErrors.username = 'El usuario es requerido'
    else if (formData.username.trim().length < 3) newErrors.username = 'Mínimo 3 caracteres'
    else if (!/^[a-zA-Z0-9_]+$/.test(formData.username.trim())) newErrors.username = 'Solo letras, números y _'

    // ─── Validación del correo electrónico ───
    if (!formData.email.trim()) newErrors.email = 'El correo es requerido'
    else     if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.email.trim())) newErrors.email = 'Debe ser un correo electrónico válido'

    // ─── Validación de la contraseña ───
    if (!formData.password) newErrors.password = 'La contraseña es requerida'
    else if (formData.password.length < 8) newErrors.password = 'Mínimo 8 caracteres'
    else if (!/[A-Z]/.test(formData.password)) newErrors.password = 'Debe tener una mayúscula'
    else if (!/[a-z]/.test(formData.password)) newErrors.password = 'Debe tener una minúscula'
    else if (!/[0-9]/.test(formData.password)) newErrors.password = 'Debe tener un número'
    else if (!/[!@#$%^&*(),.?":{}|<>_-]/.test(formData.password)) newErrors.password = 'Debe tener un carácter especial'

    // ─── Validación de confirmación de contraseña ───
    if (!formData.confirmPassword) newErrors.confirmPassword = 'Confirma tu contraseña'
    else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'No coinciden'

    // Si hay errores de validación, los muestra y aborta el envío
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setIsLoading(true)
    try {
      // Envía los datos al endpoint de registro del backend
      await register({
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        confirm_password: formData.confirmPassword,
      })
      // Registro exitoso: inicia sesión automáticamente y redirige a la Landing Page
      await login(formData.username.trim(), formData.password)
      navigate('/')  // Redirige a la Landing Page
    } catch (err) {
      // ─── Manejo de errores del servidor ───
      // El backend puede retornar errores por campo específico
      const serverErrors = err?.response?.data?.errores
      if (serverErrors) {
        const mapped = {}
        for (const [key, messages] of Object.entries(serverErrors)) {
          // Mapea las claves del backend a las claves del formulario del frontend
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
  }, [formData, register, login, navigate])

  // ─── Lista de requisitos de contraseña con estado de cumplimiento ───
  // Se usa para mostrar los indicadores visuales de fortaleza en tiempo real.
  const requirements = [
    { label: 'Al menos 8 caracteres', met: formData.password.length >= 8 },
    { label: 'Una mayúscula', met: /[A-Z]/.test(formData.password) },
    { label: 'Una minúscula', met: /[a-z]/.test(formData.password) },
    { label: 'Un número', met: /[0-9]/.test(formData.password) },
    { label: 'Un carácter especial', met: /[!@#$%^&*(),.?":{}|<>_-]/.test(formData.password) },
  ]

  return (
    <div className="auth-page">
      <div className="auth-container">

        {/* ─── Tarjeta del formulario de registro ─── */}
        <div className="auth-card">
          <Link to="/" className="auth-logo">SALT BORN</Link>
          <h1 className="auth-title">Crear Cuenta</h1>
          <p className="auth-subtitle">Completa los datos para registrarte</p>

          {/* ─── Formulario de registro ─── */}
          <form onSubmit={handleSubmit} className="auth-form" noValidate>

            {/* Campo de nombre de usuario */}
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

            {/* Campo de correo electrónico */}
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

            {/* Campo de contraseña con indicadores de fortaleza */}
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
                {/* Botón para alternar visibilidad de la contraseña */}
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

              {/* ─── Indicadores visuales de fortaleza (solo si hay contraseña) ─── */}
              {formData.password && (
                <>
                  {/* Barra de fortaleza con 6 segmentos de color dinámico */}
                  <div className="auth-strength-bar">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div
                        key={i}
                        className="auth-strength-segment"
                        style={{
                          // Cada segmento se pinta según el puntaje de fortaleza
                          background: i <= passwordStrength.score ? passwordStrength.color : 'rgba(255,255,255,0.1)',
                        }}
                      />
                    ))}
                  </div>
                  {/* Etiqueta de texto de la fortaleza */}
                  <span className="auth-strength-label" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </span>

                  {/* Lista de requisitos con indicador de cumplimiento */}
                  <div className="auth-requirements">
                    {requirements.map((req) => (
                      <div key={req.label} className="auth-requirement">
                        {/* Icono de check o cross según si se cumple el requisito */}
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

            {/* Campo de confirmación de contraseña */}
            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirmar Contraseña</label>
              <div className="auth-password-wrapper">
                <input
                  id="confirmPassword" name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword} onChange={handleChange}
                  placeholder="••••••••"
                  autoComplete="new-password" disabled={isLoading}
                />
                {/* Botón para alternar visibilidad de la confirmación */}
                <button
                  type="button" className="auth-password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex={-1}
                  aria-label={showConfirmPassword ? 'Ocultar' : 'Mostrar'}
                >
                  <span className="material-symbols-outlined">
                    {showConfirmPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {errors.confirmPassword && <span className="auth-error">{errors.confirmPassword}</span>}
            </div>

            <ErrorMessage message={errors.general} />

            {/* Botón de envío con texto dinámico según el estado de carga */}
            <button type="submit" className="auth-submit" disabled={isLoading}>
              {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </button>
          </form>

          {/* ─── Enlace a login ─── */}
          <p className="auth-footer-text">
            ¿Ya tienes una cuenta? <Link to="/login">Iniciar Sesión</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
