import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Mail, Save } from 'lucide-react';
import API from '../api/axios';

export function Settings() {
  const [formData, setFormData] = useState({ name: '', email: '', bio: '' });
  const [isSaved, setIsSaved] = useState(false);
  const [error, setError] = useState('');
  const [usuarioId, setUsuarioId] = useState<number | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem('usuario');
    if (raw) {
      const usuario = JSON.parse(raw);
      setUsuarioId(usuario.id);
      setFormData({
        name: usuario.username || '',
        email: usuario.email || '',
        bio: usuario.bio || ''
      });
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioId) return;
    try {
      const res = await API.put(`/usuarios/${usuarioId}/`, {
        username: formData.name,
        email: formData.email
      });
      localStorage.setItem('usuario', JSON.stringify(res.data.usuario));
      setIsSaved(true);
      setError('');
      setTimeout(() => setIsSaved(false), 3000);
    } catch {
      setError('Error al guardar los cambios');
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
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              placeholder="Tu nombre"
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
              required
            />
          </div>

          <div>
            <label htmlFor="bio" className="block mb-2">Biografía</label>
            <textarea
              id="bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-4 py-3 bg-input-background rounded-lg border border-border focus:outline-none focus:ring-2 focus:ring-primary transition-all min-h-[100px] resize-none"
              placeholder="Cuéntanos sobre ti..."
            />
          </div>

          {error && <p style={{ color: 'red', fontSize: '13px' }}>{error}</p>}

          <button
            type="submit"
            className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] text-foreground py-3 rounded-lg hover:opacity-90 transition-opacity shadow-lg flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            Guardar Cambios
          </button>

          {isSaved && (
            <div className="p-4 bg-[#9FE0C3]/20 border border-[#9FE0C3] rounded-lg text-center">
              <p className="text-foreground">✓ Cambios guardados exitosamente</p>
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