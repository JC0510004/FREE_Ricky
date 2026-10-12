import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'

const ORIGEN_JUEGO = 'http://192.168.18.50:8080'

export default function Juego() {
  const { user } = useAuth()
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
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [user])

  return (
    <div style={{ padding: 20 }}>
      <Link to="/home">← Volver al panel</Link>
      <iframe
        ref={iframeRef}
        src={ORIGEN_JUEGO}
        title="Salt Born"
        style={{ width: 960, height: 540, border: 0, display: 'block' }}
        allow="fullscreen"
      />
    </div>
  )
}