import { useState } from 'react'
import API from '../api/axios'
import { useNavigate } from 'react-router-dom'

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async () => {
    try {
      await API.post('/register/', form)
      navigate('/login')
    } catch {
      setError('Error al registrarse, intenta de nuevo')
    }
  }

  return (
    <div className="form-card">
      <h2>Crear cuenta</h2>
      <p className="sub">Únete a FREE RICKY</p>
      <input placeholder="Usuario" onChange={e => setForm({...form, username: e.target.value})} />
      <input placeholder="Correo" type="email" onChange={e => setForm({...form, email: e.target.value})} />
      <input placeholder="Contraseña" type="password" onChange={e => setForm({...form, password: e.target.value})} />
      {error && <p className="error">{error}</p>}
      <button onClick={handleSubmit}>Registrarse</button>
      <p className="link" onClick={() => navigate('/login')}>¿Ya tienes cuenta? <span>Inicia sesión</span></p>
    </div>
  )
}