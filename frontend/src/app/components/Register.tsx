import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { UserPlus, Eye, EyeOff, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface FormErrors {
  username?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

function getPasswordStrength(password: string): PasswordStrength {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) score++;

  if (score <= 2) return { score, label: 'Débil', color: 'bg-red-500' };
  if (score <= 4) return { score, label: 'Media', color: 'bg-yellow-500' };
  return { score, label: 'Fuerte', color: 'bg-green-500' };
}

export function Register() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const passwordStrength = useMemo(() => getPasswordStrength(formData.password), [formData.password]);

  const validateField = useCallback((name: string, value: string, allData?: typeof formData): string | undefined => {
    const sanitized = value.replace(/[<>]/g, '').trim();
    switch (name) {
      case 'username':
        if (!sanitized) return 'El nombre de usuario es requerido';
        if (sanitized.length < 3) return 'Debe tener al menos 3 caracteres';
        if (sanitized.length > 50) return 'Debe tener máximo 50 caracteres';
        if (!/^[a-zA-Z0-9_]+$/.test(sanitized)) return 'Solo letras, números y guión bajo';
        return undefined;
      case 'email':
        if (!sanitized) return 'El correo electrónico es requerido';
        if (!/^[a-zA-Z0-9._%+-]+@(gmail|hotmail)\.com$/.test(sanitized)) return 'Debe ser un correo @gmail.com o @hotmail.com';
        if (sanitized.length > 254) return 'Correo demasiado largo';
        return undefined;
      case 'password':
        if (!value) return 'La contraseña es requerida';
        if (value.length < 8) return 'Debe tener al menos 8 caracteres';
        if (value.length > 128) return 'Debe tener máximo 128 caracteres';
        if (!/[A-Z]/.test(value)) return 'Debe contener una mayúscula';
        if (!/[a-z]/.test(value)) return 'Debe contener una minúscula';
        if (!/[0-9]/.test(value)) return 'Debe contener un número';
        if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(value)) return 'Debe contener un carácter especial';
        return undefined;
      case 'confirmPassword':
        if (!value) return 'Confirme su contraseña';
        if (value !== (allData?.password || formData.password)) return 'Las contraseñas no coinciden';
        return undefined;
      default:
        return undefined;
    }
  }, [formData.password]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const sanitized = ['username', 'email'].includes(name)
      ? value.replace(/[<>]/g, '').trimStart()
      : value;
    setFormData((prev) => ({ ...prev, [name]: sanitized }));
    if (touched[name]) {
      const error = validateField(name, name === 'confirmPassword' ? sanitized : sanitized);
      setErrors((prev) => ({ ...prev, [name]: error }));
      if (name === 'password' && touched.confirmPassword && formData.confirmPassword) {
        const confirmError = validateField('confirmPassword', formData.confirmPassword);
        setErrors((prev) => ({ ...prev, confirmPassword: confirmError }));
      }
    }
  }, [touched, validateField, formData.confirmPassword]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, name === 'confirmPassword' ? value : value);
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, [validateField]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const usernameError = validateField('username', formData.username);
    const emailError = validateField('email', formData.email);
    const passwordError = validateField('password', formData.password);
    const confirmError = validateField('confirmPassword', formData.confirmPassword);

    const newErrors: FormErrors = {
      username: usernameError,
      email: emailError,
      password: passwordError,
      confirmPassword: confirmError,
    };

    setErrors(newErrors);
    setTouched({ username: true, email: true, password: true, confirmPassword: true });

    if (usernameError || emailError || passwordError || confirmError) {
      return;
    }

    setIsLoading(true);
    try {
      await register({
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        confirm_password: formData.confirmPassword,
      });
      navigate('/login');
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { errores?: Record<string, string[]> } } };
      const serverErrors = apiError?.response?.data?.errores;
      if (serverErrors) {
        const mapped: FormErrors = {};
        for (const [key, messages] of Object.entries(serverErrors)) {
          if (key === 'username') mapped.username = messages[0];
          else if (key === 'email') mapped.email = messages[0];
          else if (key === 'password') mapped.password = messages[0];
          else if (key === 'confirm_password') mapped.confirmPassword = messages[0];
          else mapped.general = messages[0];
        }
        setErrors(mapped);
      } else {
        setErrors({ general: 'Error al registrar. Intente de nuevo.' });
      }
    } finally {
      setIsLoading(false);
    }
  }, [formData, register, navigate, validateField]);

  const strengthBar = useMemo(() => {
    if (!formData.password || !touched.password) return null;
    return (
      <div className="mt-2">
        <div className="flex gap-1 mb-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                i <= passwordStrength.score ? passwordStrength.color : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <p className="text-xs" style={{ color: passwordStrength.color === 'bg-red-500' ? '#ef4444' : passwordStrength.color === 'bg-yellow-500' ? '#eab308' : '#22c55e' }}>
          {passwordStrength.label}
        </p>
      </div>
    );
  }, [formData.password, touched.password, passwordStrength]);

  const requirements = [
    { label: 'Al menos 8 caracteres', met: formData.password.length >= 8 },
    { label: 'Una mayúscula', met: /[A-Z]/.test(formData.password) },
    { label: 'Una minúscula', met: /[a-z]/.test(formData.password) },
    { label: 'Un número', met: /[0-9]/.test(formData.password) },
    { label: 'Un carácter especial', met: /[!@#$%^&*(),.?":{}|<>_\-]/.test(formData.password) },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#9FE0C3] to-[#9FBCE0] rounded-full mb-4">
              <UserPlus className="w-8 h-8 text-white" />
            </div>
            <h1 className="mb-2">Crear Cuenta</h1>
            <p className="text-muted-foreground">Completa los datos para registrarte</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="username" className="block mb-2">Nombre de Usuario</label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-4 py-3 bg-input-background rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.username && touched.username ? 'border-red-500 focus:ring-red-500' : 'border-border'
                }`}
                placeholder="Tu nombre de usuario"
                autoComplete="username"
                disabled={isLoading}
                required
              />
              {errors.username && touched.username && (
                <p className="mt-1 text-red-500 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.username}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block mb-2">Correo Electrónico</label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-4 py-3 bg-input-background rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.email && touched.email ? 'border-red-500 focus:ring-red-500' : 'border-border'
                }`}
                placeholder="tu@email.com"
                autoComplete="email"
                disabled={isLoading}
                required
              />
              {errors.email && touched.email && (
                <p className="mt-1 text-red-500 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.email}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block mb-2">Contraseña</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`w-full px-4 py-3 bg-input-background rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary pr-12 ${
                    errors.password && touched.password ? 'border-red-500 focus:ring-red-500' : 'border-border'
                  }`}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && touched.password && (
                <p className="mt-1 text-red-500 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.password}
                </p>
              )}
              {strengthBar}
              {touched.password && formData.password.length > 0 && (
                <div className="mt-2 space-y-1">
                  {requirements.map((req) => (
                    <div key={req.label} className="flex items-center gap-1.5 text-xs">
                      {req.met ? (
                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                      ) : (
                        <XCircle className="w-3 h-3 text-gray-400" />
                      )}
                      <span className={req.met ? 'text-green-600' : 'text-gray-500'}>{req.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block mb-2">Confirmar Contraseña</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`w-full px-4 py-3 bg-input-background rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.confirmPassword && touched.confirmPassword ? 'border-red-500 focus:ring-red-500' : 'border-border'
                }`}
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isLoading}
                required
              />
              {errors.confirmPassword && touched.confirmPassword && (
                <p className="mt-1 text-red-500 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.confirmPassword}
                </p>
              )}
            </div>

            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-red-600 text-sm">{errors.general}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] text-foreground py-3 rounded-lg hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current" />
                  Creando cuenta...
                </>
              ) : (
                'Crear Cuenta'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              ¿Ya tienes una cuenta?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-[#9FBCE0] hover:underline font-medium"
              >
                Iniciar Sesión
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
