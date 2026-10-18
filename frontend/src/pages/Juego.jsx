import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import API from '../api/axios'

const ORIGEN_JUEGO = 'http://192.168.18.50:8080'
const URL_JUEGO = `${ORIGEN_JUEGO}/?v=20261017a`
const normalizar = (s) => String(s).toLowerCase().replace(/[\s_-]/g, '')

async function guardarResultado(datos) {
  const { data } = await API.get('/niveles/')
  const lista = data.results || data
  const nivel = lista.find((n) => normalizar(n.nombre) === normalizar(datos.escena))
  if (!nivel) {
    console.warn('No hay un nivel en el panel que coincida con la escena:', datos.escena)
    return
  }
  await API.post('/partidas/', {
    nivel: nivel.id,
    muertes: datos.muertes,
    tiempo: datos.tiempo,
    completado: datos.completado,
  })
}
export default function Juego() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const iframeRef = useRef(null)

  useEffect(() => {
    function onMessage(e) {
      console.log('[Juego] mensaje', e.origin, e.data)
      if (e.origin !== ORIGEN_JUEGO) return
      if (e.data?.type === 'resultadoPartida') {
      guardarResultado(e.data.datos).catch((err) => console.error('No se pudo guardar la partida', err))
      }
      if (e.data?.type === 'unityListo' && user?.username) {
        iframeRef.current?.contentWindow.postMessage(
          { type: 'setPlayerName', nombre: user.username },
          ORIGEN_JUEGO
        )
      }
      if (e.data?.type === 'salirPanel') navigate('/home')
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [user, navigate])

  return (
    <div style={{ padding: 20 }}>
      <iframe
        ref={iframeRef}
        src={URL_JUEGO}
        title="Salt Born"
        style={{ width: 960, height: 540, border: 0, display: 'block' }}
        allow="fullscreen"
      />
    </div>
  )
}