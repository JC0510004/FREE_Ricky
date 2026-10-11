import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Unity, useUnityContext } from 'react-unity-webgl'
import { useAuth } from '../contexts/useAuth'

export default function Juego() {
  const { user } = useAuth()

  const { unityProvider, sendMessage, isLoaded, loadingProgression } = useUnityContext({
    loaderUrl: '/unity/BuildWebGL.loader.js',
    dataUrl: '/unity/BuildWebGL.data',
    frameworkUrl: '/unity/BuildWebGL.framework.js',
    codeUrl: '/unity/BuildWebGL.wasm',
  })

  // Cuando el juego termina de cargar, le mandamos el nombre del usuario.
  // 'WebBridge' = nombre del objeto en la escena, 'SetPlayerName' = su método.
  useEffect(() => {
    if (isLoaded && user?.username) {
      sendMessage('WebBridge', 'SetPlayerName', user.username)
    }
  }, [isLoaded, user, sendMessage])

  return (
    <div style={{ padding: 20 }}>
      <Link to="/home">← Volver al panel</Link>

      {!isLoaded && (
        <p>Cargando juego... {Math.round(loadingProgression * 100)}%</p>
      )}

      <Unity
        unityProvider={unityProvider}
        style={{ width: 960, height: 540, visibility: isLoaded ? 'visible' : 'hidden' }}
      />
    </div>
  )
}