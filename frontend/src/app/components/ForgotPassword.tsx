import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Mail, AlertCircle, ArrowLeft, CheckCircle2, KeyRound, Eye, EyeOff, XCircle, Loader2 } from 'lucide-react';
import API from '../api/axios';

export function ForgotPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlToken = searchParams.get('token') || '';

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [step, setStep] = useState<'form' | 'sent' | 'not-confirmed' | 'reset' | 'success'>('form');
  const [checking, setChecking] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const requirements = [
    { label: 'Al menos 8 caracteres', met: password.length >= 8 },
    { label: 'Una mayúscula', met: /[A-Z]/.test(password) },
    { label: 'Una minúscula', met: /[a-z]/.test(password) },
    { label: 'Un número', met: /[0-9]/.test(password) },
    { label: 'Un carácter especial', met: /[!@#$%^&*(),.?":{}|<>_\-]/.test(password) },
  ];

  useEffect(() => {
    if (!urlToken) return;
    setToken(urlToken);
    setStep('sent');
    API.get(`/password-reset/verificar/?token=${urlToken}`)
      .then(res => {
        if (res.data?.confirmado) {
          setStep('reset');
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmitEmail = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const sanitized = email.replace(/[<>]/g, '').trim();
    if (!sanitized) { setError('El correo es requerido'); return; }
    if (!/^[a-zA-Z0-9._%+-]+@(gmail|hotmail)\.com$/.test(sanitized)) {
      setError('Debe ser un correo @gmail.com o @hotmail.com');
      return;
    }

    setIsLoading(true);
    try {
      const res = await API.post('/password-reset/', { email: sanitized.toLowerCase() });
      if (res.data?.reset_url) {
        const match = res.data.reset_url.match(/token=([^&]+)/);
        if (match) setToken(match[1]);
      }
      setStep('sent');
    } catch {
      setError('Error al procesar la solicitud');
    } finally {
      setIsLoading(false);
    }
  }, [email]);

  const handleContinuar = useCallback(async () => {
    const t = token || urlToken;
    if (!t) { setError('Token inválido'); return; }
    setChecking(true);
    setError('');
    try {
      const res = await API.get(`/password-reset/verificar/?token=${t}`);
      if (res.data?.confirmado) {
        setStep('reset');
      } else {
        setStep('not-confirmed');
      }
    } catch {
      setError('Error al verificar identidad');
    } finally {
      setChecking(false);
    }
  }, [token, urlToken]);

  const handleReintentar = useCallback(() => {
    setStep('form');
    setToken('');
    setEmail('');
    setError('');
    setConfirmado(false);
    navigate('/forgot-password', { replace: true });
  }, [navigate]);

  const handleResetPassword = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return; }
    if (!/[A-Z]/.test(password)) { setError('Debe contener una mayúscula'); return; }
    if (!/[a-z]/.test(password)) { setError('Debe contener una minúscula'); return; }
    if (!/[0-9]/.test(password)) { setError('Debe contener un número'); return; }
    if (!/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)) { setError('Debe contener un carácter especial'); return; }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden'); return; }

    const t = token || urlToken;
    if (!t) { setError('Token inválido'); return; }

    setIsLoading(true);
    try {
      await API.post('/password-reset/confirm/', {
        token: t,
        password,
        confirm_password: confirmPassword,
      });
      setStep('success');
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { errores?: Record<string, string[]>; error?: string } } };
      const data = apiError?.response?.data;
      if (data?.errores) setError(Object.values(data.errores).flat().join('. '));
      else if (data?.error) setError(data.error);
      else setError('Error al restablecer la contraseña');
    } finally {
      setIsLoading(false);
    }
  }, [token, urlToken, password, confirmPassword]);

  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <KeyRound className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="mb-2">Contraseña Restablecida</h1>
            <p className="text-muted-foreground mb-6">Tu contraseña ha sido actualizada correctamente.</p>
            <button onClick={() => navigate('/login')} className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] py-3 rounded-lg hover:opacity-90 transition-all">Iniciar Sesión</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'sent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="mb-2">Correo Enviado</h1>
              <p className="text-muted-foreground mb-6">Revisa tu correo y haz clic en "Sí, soy yo". Luego presiona "Continuar" aquí.</p>
            </div>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {checking ? (
              <div className="flex items-center justify-center gap-2 py-3 mb-4">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Verificando...</span>
              </div>
            ) : (
              <button onClick={handleContinuar} className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] py-3 rounded-lg hover:opacity-90 transition-all shadow-lg mb-4">
                Continuar
              </button>
            )}

            <button onClick={() => navigate('/login')} className="w-full bg-gray-100 text-gray-700 py-3 rounded-lg hover:bg-gray-200 transition-all">Volver al inicio de sesión</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'not-confirmed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="mb-2">IDENTIDAD NO CONFIRMADA</h1>
            <p className="text-muted-foreground mb-6">Debes confirmar tu identidad desde tu correo electrónico antes de continuar.</p>

            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            {checking ? (
              <div className="flex items-center justify-center gap-2 py-3">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Verificando...</span>
              </div>
            ) : (
              <button onClick={handleContinuar} className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] py-3 rounded-lg hover:opacity-90 transition-all shadow-lg">
                Verificar de nuevo
              </button>
            )}

            <button onClick={handleReintentar} className="w-full mt-3 text-center text-sm text-[#9FBCE0] hover:underline">Volver a intentar</button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'reset') {
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

            <form onSubmit={handleResetPassword} className="space-y-5" noValidate>
              <div>
                <label htmlFor="password" className="block mb-2">Nueva Contraseña</label>
                <div className="relative">
                  <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-3 bg-input-background rounded-lg border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary pr-12" placeholder="••••••••" autoComplete="new-password" disabled={isLoading} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block mb-2">Confirmar Contraseña</label>
                <input id="confirmPassword" type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-3 bg-input-background rounded-lg border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary" placeholder="••••••••" autoComplete="new-password" disabled={isLoading} required />
              </div>

              {password.length > 0 && (
                <div className="space-y-1">
                  {requirements.map((req) => (
                    <div key={req.label} className="flex items-center gap-1.5 text-xs">
                      {req.met ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <XCircle className="w-3 h-3 text-gray-400" />}
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

              <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] py-3 rounded-lg hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {isLoading ? <><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current" /> Restableciendo...</> : 'Restablecer Contraseña'}
              </button>
            </form>
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
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="mb-2">Recuperar Contraseña</h1>
            <p className="text-muted-foreground">Ingresa tu correo y te enviaremos un mensaje de confirmación.</p>
          </div>

          <form onSubmit={handleSubmitEmail} className="space-y-6" noValidate>
            <div>
              <label htmlFor="email" className="block mb-2">Correo Electrónico</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-3 bg-input-background rounded-lg border border-border transition-all focus:outline-none focus:ring-2 focus:ring-primary" placeholder="tu_correo@gmail.com" autoComplete="email" disabled={isLoading} required />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            )}

            <button type="submit" disabled={isLoading} className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] py-3 rounded-lg hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isLoading ? <><div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-current" /> Enviando...</> : 'Enviar'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={() => navigate('/login')} className="inline-flex items-center gap-1 text-[#9FBCE0] hover:underline font-medium">
              <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}