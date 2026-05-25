import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import API from '../api/axios';

export function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ username: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await API.post('/login/', {
        username: formData.username,
        password: formData.password
      });
      localStorage.setItem('usuario', JSON.stringify(res.data.usuario));
      localStorage.setItem('isAuthenticated', 'true');
      navigate('/home');
    } catch {
      setError('Usuario o contraseña incorrectos');
    }
  };

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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="username" className="block mb-2">
                Usuario
              </label>
              <input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                placeholder="tu_usuario"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block mb-2">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all pr-12"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && <p style={{color: 'red', fontSize: '13px'}}>{error}</p>}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] text-foreground py-3 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
            >
              Iniciar Sesión
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              ¿No tienes una cuenta?{' '}
              <button
                onClick={() => navigate('/register')}
                className="text-[#9FBCE0] hover:underline"
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