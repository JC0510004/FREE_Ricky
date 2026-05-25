import { useState } from 'react';
import { useNavigate } from 'react-router';
import { UserPlus, Eye, EyeOff } from 'lucide-react';
import API from '../api/axios';

export function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    try {
      await API.post('/register/', {
        username: formData.name,
        email: formData.email,
        password: formData.password
      });
      navigate('/login');
    } catch {
      setError('Error al registrarse, el usuario ya existe');
    }
  };

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

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="block mb-2">Nombre de Usuario</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                placeholder="Tu nombre"
                required
              />
            </div>

            <div>
              <label htmlFor="email" className="block mb-2">Correo Electrónico</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                placeholder="tu@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block mb-2">Contraseña</label>
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

            <div>
              <label htmlFor="confirmPassword" className="block mb-2">Confirmar Contraseña</label>
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            {error && <p style={{color: 'red', fontSize: '13px'}}>{error}</p>}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] text-foreground py-3 rounded-lg hover:opacity-90 transition-opacity shadow-lg"
            >
              Crear Cuenta
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-muted-foreground">
              ¿Ya tienes una cuenta?{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-[#9FBCE0] hover:underline"
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