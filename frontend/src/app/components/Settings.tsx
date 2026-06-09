import { useState } from 'react';
import { Settings as SettingsIcon, User, Mail, Save, AlertCircle } from 'lucide-react';
import API from '../api/axios';
import { useAuth } from '../contexts/AuthContext';

export function Settings() {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.username || '',
    email: user?.email || '',
  });
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true);
    setError('');
    try {
      await API.put(`/usuarios/${user.id}/`, {
        username: formData.name,
        email: formData.email,
      });
      const stored = localStorage.getItem('usuario');
      if (stored) {
        const updated = { ...JSON.parse(stored), username: formData.name, email: formData.email };
        localStorage.setItem('usuario', JSON.stringify(updated));
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch {
      setError('Error al guardar los cambios');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-8 h-8 text-[#9FBCE0]" />
          <h1>Configuración</h1>
        </div>
        <p className="text-muted-foreground">Gestiona tu información personal</p>
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="flex items-center gap-2 mb-2">
              <User className="w-5 h-5 text-[#9FBCE0]" />
              Nombre de Usuario
            </label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value.replace(/[<>]/g, '') })}
              className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              placeholder="Tu nombre"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label htmlFor="email" className="flex items-center gap-2 mb-2">
              <Mail className="w-5 h-5 text-[#9FDDE0]" />
              Correo Electrónico
            </label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              placeholder="tu@email.com"
              disabled={isLoading}
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
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
                Guardando...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Guardar Cambios
              </>
            )}
          </button>

          {isSaved && (
            <div className="p-4 bg-[#9FE0C3]/20 border border-[#9FE0C3] rounded-lg text-center">
              <p className="text-foreground">Cambios guardados correctamente</p>
            </div>
          )}
        </form>
      </div>

      <div className="mt-6 p-6 bg-gradient-to-r from-[#9FE0C3]/10 to-[#9FBCE0]/10 rounded-xl border border-[#9FBCE0]/30">
        <h3 className="mb-2">Preferencias de Cuenta</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white rounded-lg">
            <span>Notificaciones por correo</span>
            <input type="checkbox" className="w-5 h-5 accent-[#9FBCE0]" defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 bg-white rounded-lg">
            <span>Perfil público</span>
            <input type="checkbox" className="w-5 h-5 accent-[#9FBCE0]" defaultChecked />
          </div>
          <div className="flex items-center justify-between p-3 bg-white rounded-lg">
            <span>Mostrar en ranking</span>
            <input type="checkbox" className="w-5 h-5 accent-[#9FBCE0]" defaultChecked />
          </div>
        </div>
      </div>
    </div>
  );
}
