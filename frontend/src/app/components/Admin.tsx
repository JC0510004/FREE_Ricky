import { useState, useEffect, useCallback } from 'react';
import { Trash2, Edit, Save, X, Shield, AlertCircle } from 'lucide-react';
import API from '../api/axios';
import { useAuth } from '../contexts/AuthContext';

interface Usuario {
  id: number;
  username: string;
  email: string;
  rol: string;
  fecha_registro: string;
}

export function Admin() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ username: '', email: '', rol: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    try {
      const res = await API.get('/usuarios/');
      setUsuarios(res.data);
    } catch {
      setError('Error al cargar');
    }
  };

  const handleEdit = (usuario: Usuario) => {
    setEditingId(usuario.id);
    setEditData({ username: usuario.username, email: usuario.email, rol: usuario.rol });
  };

  const handleSave = async (id: number) => {
    try {
      await API.put(`/usuarios/${id}/`, editData);
      setEditingId(null);
      fetchUsuarios();
    } catch {
      setError('Error al actualizar');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este usuario?')) return;
    try {
      await API.delete(`/usuarios/${id}/`);
      fetchUsuarios();
    } catch {
      setError('Error al eliminar');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Shield className="w-8 h-8 text-[#9FBCE0]" />
          <h1>Panel de Administración</h1>
        </div>
        <p className="text-muted-foreground">Gestiona todos los usuarios del sistema</p>
      </div>

      {error && <p style={{ color: 'red', fontSize: '13px' }} className="mb-4">{error}</p>}

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0]">
            <tr>
              <th className="text-left p-4 text-white">Usuario</th>
              <th className="text-left p-4 text-white">Email</th>
              <th className="text-left p-4 text-white">Rol</th>
              <th className="text-left p-4 text-white">Registro</th>
              <th className="text-left p-4 text-white">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {usuarios.map((usuario) => (
              <tr key={usuario.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-4">
                  {editingId === usuario.id ? (
                    <input
                      value={editData.username}
                      onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                      className="px-2 py-1 border border-border rounded-lg w-full"
                    />
                  ) : (
                    <span className="font-medium">{usuario.username}</span>
                  )}
                </td>
                <td className="p-4">
                  {editingId === usuario.id ? (
                    <input
                      value={editData.email}
                      onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                      className="px-2 py-1 border border-border rounded-lg w-full"
                    />
                  ) : (
                    usuario.email
                  )}
                </td>
                <td className="p-4">
                  {editingId === usuario.id ? (
                    <select
                      value={editData.rol}
                      onChange={(e) => setEditData({ ...editData, rol: e.target.value })}
                      className="px-2 py-1 border border-border rounded-lg"
                    >
                      <option value="jugador">Jugador</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 rounded-full text-xs text-white ${
                      usuario.rol === 'admin' ? 'bg-[#9FBCE0]' : 'bg-[#9FE0C3]'
                    }`}>
                      {usuario.rol}
                    </span>
                  )}
                </td>
                <td className="p-4 text-muted-foreground text-sm">
                  {new Date(usuario.fecha_registro).toLocaleDateString()}
                </td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    {editingId === usuario.id ? (
                      <>
                        <button
                          onClick={() => handleSave(usuario.id)}
                          className="p-2 text-[#9FE0C3] hover:bg-[#9FE0C3]/10 rounded-lg transition-colors"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEdit(usuario)}
                          className="p-2 text-[#9FBCE0] hover:bg-[#9FBCE0]/10 rounded-lg transition-colors"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(usuario.id)}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}