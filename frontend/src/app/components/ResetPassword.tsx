import { useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { KeyRound, Eye, EyeOff, AlertCircle, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';
import API from '../api/axios';

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

export function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<'confirm' | 'form'>('confirm');

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const requirements = [
    { label: 'Al menos 8 caracteres', met: password.length >= 8 },
    { label: 'Una mayúscula', met: /[A-Z]/.test(password) },
    { label: 'Una minúscula', met: /[a-z]/.test(password) },
    { label: 'Un número', met: /[0-9]/.test(password) },
    { label: 'Un carácter especial', met: /[!@#$%^&*(),.?":{}|<>_\-]/.test(password) },
  ];

  const validate = useCallback((): string | null => {
    if (!token) return 'Token de recuperación inválido';
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (!/[A-Z]/.test(password)) return 'Debe contener una mayúscula';
    if (!/[a-z]/.test(password)) return 'Debe contener una minúscula';
    if (!/[0-9]/.test(password)) return 'Debe contener un número';
    if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) return 'Debe contener un carácter especial';
    if (password !== confirmPassword) return 'Las contraseñas no coinciden';
    return null;
  }, [token, password, confirmPassword]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    try {
      await API.post('/password-reset/confirm/', {
        token,
        password,
        confirm_password: confirmPassword,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { errores?: Record<string, string[]>; error?: string } } };
      const data = apiError?.response?.data;
      if (data?.errores) {
        setError(Object.values(data.errores).flat().join('. '));
      } else if (data?.error) {
        setError(data.error);
      } else {
        setError('Error al restablecer la contraseña');
      }
    } finally {
      setIsLoading(false);
    }
  }, [token, password, confirmPassword, validate]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="mb-2">Enlace Inválido</h1>
            <p className="text-muted-foreground mb-6">
              El enlace de recuperación no es válido o ha expirado.
            </p>
            <button
              onClick={() => navigate('/forgot-password')}
              className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] py-3 rounded-lg hover:opacity-90 transition-all"
            >
              Solicitar Nuevo Enlace
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <KeyRound className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="mb-2">Contraseña Restablecida</h1>
            <p className="text-muted-foreground mb-6">
              Tu contraseña ha sido actualizada correctamente. Ahora puedes iniciar sesión.
            </p>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] py-3 rounded-lg hover:opacity-90 transition-all"
            >
              Iniciar Sesión
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'confirm') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <ShieldCheck className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="mb-2">Identidad Confirmada</h1>
            <p className="text-muted-foreground mb-2">
              Gracias por confirmar tu identidad.
            </p>
            <p className="text-muted-foreground mb-6">
              Ahora puedes continuar para restablecer tu contraseña.
            </p>
            <button
              onClick={() => setStep('form')}
              className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] py-3 rounded-lg hover:opacity-90 transition-all shadow-lg"
            >
              Continuar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#9FE0C3] to-[#9FBCE0] rounded-full mb-4">
              <KeyRound className="w-8 h-8 text-white" />
            </div>
            <h1 className="mb-2">Nueva Contraseña</h1>
            <p className="text-muted-foreground">Ingresa tu nueva contraseña</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="password" className="block mb-2">Nueva Contraseña</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-input-background rounded-lg border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary pr-12"
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
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block mb-2">Confirmar Contraseña</label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-input-background rounded-lg border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="••••••••"
                autoComplete="new-password"
                disabled={isLoading}
                required
              />
            </div>

            {password.length > 0 && (
              <div className="space-y-1">
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

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] py-3 rounded-lg hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current" />
                  Restableciendo...
                </>
              ) : (
                'Restablecer Contraseña'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}