import { useState } from 'react'
import API from '../api/axios'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' })
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async () => {
    try {
      const res = await API.post('/login/', form)
      localStorage.setItem('usuario', JSON.stringify(res.data.usuario))
      navigate('/inicio')
    } catch {
      setError('Credenciales incorrectas')
    }
  }

  return (
    <div className="form-card">
      <h2>Iniciar sesión</h2>
      <p className="sub">Accede a tu cuenta</p>
      <input placeholder="Usuario" onChange={e => setForm({...form, username: e.target.value})} />
      <input placeholder="Contraseña" type="password" onChange={e => setForm({...form, password: e.target.value})} />
      {error && <p className="error">{error}</p>}
      <button onClick={handleSubmit}>Entrar</button>
      <p className="link" onClick={() => navigate('/')}>¿No tienes cuenta? <span>Regístrate</span></p>
    </div>
  )
}