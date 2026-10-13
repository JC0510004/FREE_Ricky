import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'

const ORIGEN_JUEGO = 'http://192.168.18.50:8080'
const URL_JUEGO = `${ORIGEN_JUEGO}/?v=20261013a`

export default function Juego() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const iframeRef = useRef(null)

  useEffect(() => {
    function onMessage(e) {
      if (e.origin !== ORIGEN_JUEGO) return
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