import { useEffect, useState } from 'react'
import API from '../api/axios'
import { useNavigate } from 'react-router-dom'

export default function Inicio() {
  const [usuarios, setUsuarios] = useState([])
  const [editando, setEditando] = useState(null)
  const [form, setForm] = useState({ username: '', email: '' })
  const navigate = useNavigate()
  const usuario = JSON.parse(localStorage.getItem('usuario'))

  useEffect(() => {
    if (!usuario) navigate('/login')
    cargarUsuarios()
  }, [])

  const cargarUsuarios = async () => {
    const res = await API.get('/usuarios/')
    setUsuarios(res.data)
  }

  const eliminar = async (id) => {
    await API.delete(`/usuarios/${id}/`)
    cargarUsuarios()
  }

  const abrirEditar = (u) => {
    setEditando(u.id)
    setForm({ username: u.username, email: u.email })
  }

  const guardar = async () => {
    await API.put(`/usuarios/${editando}/`, form)
    setEditando(null)
    cargarUsuarios()
  }

  const cerrarSesion = () => {
    localStorage.removeItem('usuario')
    navigate('/login')
  }

  return (
    <div className="inicio">
      <div className="top-bar">
        <span className="logo">FREE RICKY</span>
        <div className="user-session">
          <span>Hola, <strong>{usuario?.username}</strong></span>
          <button className="btn-logout" onClick={cerrarSesion}>Cerrar sesión</button>
        </div>
      </div>

      <div className="usuarios-section">
        <h2>Usuarios</h2>
        <p className="sub">{usuarios.length} usuarios registrados</p>

        {usuarios.map(u => (
          <div className="user-card" key={u.id}>
            {editando === u.id ? (
              <div className="edit-form">
                <input value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                <div className="edit-actions">
                  <button className="btn-save" onClick={guardar}>Guardar</button>
                  <button className="btn-cancel" onClick={() => setEditando(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <>
                <div className="user-info">
                  <div className="avatar">{u.username[0].toUpperCase()}</div>
                  <div>
                    <p className="username">{u.username}</p>
                    <p className="email">{u.email}</p>
                  </div>
                </div>
                <div className="user-actions">
                  <button className="btn-edit" onClick={() => abrirEditar(u)}>Editar</button>
                  <button className="btn-delete" onClick={() => eliminar(u.id)}>Eliminar</button>
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}