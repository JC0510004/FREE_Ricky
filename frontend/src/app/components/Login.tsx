import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface FormErrors {
  username?: string;
  password?: string;
  general?: string;
}

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [attempts, setAttempts] = useState(0);

  const validateField = useCallback((name: string, value: string): string | undefined => {
    const sanitized = value.replace(/[<>]/g, '').trim();
    switch (name) {
      case 'username':
        if (!sanitized) return 'El usuario es requerido';
        if (sanitized.length < 3) return 'El usuario debe tener al menos 3 caracteres';
        if (sanitized.length > 50) return 'El usuario debe tener máximo 50 caracteres';
        if (!/^[a-zA-Z0-9_]+$/.test(sanitized)) return 'Solo letras, números y guión bajo';
        return undefined;
      case 'password':
        if (!value) return 'La contraseña es requerida';
        if (value.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
        return undefined;
      default:
        return undefined;
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const sanitized = name === 'username' ? value.replace(/[<>]/g, '').trim() : value;
    setFormData((prev) => ({ ...prev, [name]: sanitized }));
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: validateField(name, value) }));
    }
  }, [errors, validateField]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const usernameError = validateField('username', formData.username);
    const passwordError = validateField('password', formData.password);

    if (usernameError || passwordError) {
      setErrors({ username: usernameError, password: passwordError });
      return;
    }

    setIsLoading(true);
    try {
      await login(formData.username.trim(), formData.password);
      navigate('/home');
    } catch (err: unknown) {
      setAttempts((prev) => prev + 1);
      const apiError = err as { response?: { data?: { error?: string } } };
      const message = apiError?.response?.data?.error || 'Credenciales incorrectas';
      setErrors({ general: message });
    } finally {
      setIsLoading(false);
    }
  }, [formData, login, navigate, validateField]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#9FE0C3] to-[#9FBCE0] rounded-full mb-4">
              <LogIn className="w-8 h-8 text-white" />
            </div>
            <h1 className="mb-2">Iniciar Sesión</h1>
            <p className="text-muted-foreground">Ingresa tus credenciales para continuar</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div>
              <label htmlFor="username" className="block mb-2">
                Usuario o Correo Electrónico
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={formData.username}
                onChange={handleChange}
                onBlur={() => setErrors((prev) => ({ ...prev, username: validateField('username', formData.username) }))}
                className={`w-full px-4 py-3 bg-input-background rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors.username ? 'border-red-500 focus:ring-red-500' : 'border-border'
                }`}
                placeholder="tu_usuario o tu@email.com"
                autoComplete="username"
                disabled={isLoading}
                required
              />
              {errors.username && (
                <p className="mt-1 text-red-500 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.username}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  onBlur={() => setErrors((prev) => ({ ...prev, password: validateField('password', formData.password) }))}
                  className={`w-full px-4 py-3 bg-input-background rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-primary pr-12 ${
                    errors.password ? 'border-red-500 focus:ring-red-500' : 'border-border'
                  }`}
                  placeholder="••••••••"
                  autoComplete="current-password"
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
              {errors.password && (
                <p className="mt-1 text-red-500 text-xs flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.password}
                </p>
              )}
            </div>

            {errors.general && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-red-600 text-sm">{errors.general}</p>
              </div>
            )}

            <div className="text-right -mt-4">
              <button
                type="button"
                onClick={() => navigate('/forgot-password')}
                className="text-sm text-[#9FBCE0] hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            {attempts >= 3 && (
              <p className="text-amber-600 text-xs text-center">
                Múltiples intentos fallidos. Su cuenta será bloqueada temporalmente después de 5 intentos.
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] text-foreground py-3 rounded-lg hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current" />
                  Verificando...
                </>
              ) : (
                'Iniciar Sesión'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              ¿No tienes una cuenta?{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-[#9FBCE0] hover:underline font-medium"
              >
                Regístrate
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
