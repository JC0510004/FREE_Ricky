import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import API from '../api/axios'

const ORIGEN_JUEGO = 'http://192.168.18.50:8080'
const URL_JUEGO = `${ORIGEN_JUEGO}/?v=20261017e`
const normalizar = (s) => String(s).toLowerCase().replace(/[\s_-]/g, '')

async function guardarResultado(datos, nivelIdFallback) {
  let nivel = null
  try {
    const { data } = await API.get('/niveles/')
    const lista = data.results || data
    if (datos?.escena) {
      nivel = lista.find((n) => normalizar(n.nombre) === normalizar(datos.escena))
    }
    if (!nivel && nivelIdFallback != null) {
      nivel = lista.find((n) => Number(n.id) === Number(nivelIdFallback))
    }
    if (!nivel && datos?.nivelId != null) {
      nivel = lista.find((n) => Number(n.id) === Number(datos.nivelId))
    }
  } catch (e) {
    console.error('[guardarResultado] error buscando niveles', e)
  }

  if (!nivel && nivelIdFallback != null) {
    try {
      await API.post('/partidas/', {
        nivel: Number(nivelIdFallback),
        muertes: datos?.muertes ?? 0,
        tiempo: datos?.tiempo ?? 0,
        completado: true,
      })
      console.log('[guardarResultado] Guardado con fallback nivelId')
      return
    } catch (e) {
      console.error('[guardarResultado] fallo con fallback', e)
      return
    }
  }

  if (!nivel) {
    console.warn('No hay un nivel en el panel que coincida con la escena:', datos?.escena, 'nivelIdFallback:', nivelIdFallback)
    return
  }

  try {
    await API.post('/partidas/', {
      nivel: nivel.id,
      muertes: datos?.muertes ?? 0,
      tiempo: datos?.tiempo ?? 0,
      completado: true,
    })
    console.log('[guardarResultado] Partida completada guardada OK')
  } catch (e) {
    console.error('[guardarResultado] error guardando partida', e)
  }
}

function extraerDatos(obj) {
  if (!obj || typeof obj !== 'object') return null
  const res = { muertes: null, tiempo: null }

  if (typeof obj.muertes === 'number' && obj.muertes >= 0) res.muertes = obj.muertes
  else if (typeof obj.muerte === 'number' && obj.muerte >= 0) res.muertes = obj.muerte
  else if (typeof obj.deaths === 'number' && obj.deaths >= 0) res.muertes = obj.deaths
  else if (typeof obj.vidasPerdidas === 'number' && obj.vidasPerdidas >= 0) res.muertes = obj.vidasPerdidas
  else if (typeof obj.killCount === 'number' && obj.killCount >= 0) res.muertes = obj.killCount
  else if (typeof obj.muertesTotales === 'number' && obj.muertesTotales >= 0) res.muertes = obj.muertesTotales

  if (typeof obj.tiempo === 'number' && obj.tiempo >= 0) res.tiempo = obj.tiempo
  else if (typeof obj.time === 'number' && obj.time >= 0) res.tiempo = obj.time
  else if (typeof obj.segundos === 'number' && obj.segundos >= 0) res.tiempo = obj.segundos
  else if (typeof obj.timer === 'number' && obj.timer >= 0) res.tiempo = obj.timer
  else if (typeof obj.elapsedTime === 'number' && obj.elapsedTime >= 0) res.tiempo = obj.elapsedTime
  else if (typeof obj.playTime === 'number' && obj.playTime >= 0) res.tiempo = obj.playTime
  else if (typeof obj.tiempoTranscurrido === 'number' && obj.tiempoTranscurrido >= 0) res.tiempo = obj.tiempoTranscurrido

  if (res.muertes === null && res.tiempo === null) return null
  return res
}

export default function Juego() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const iframeRef = useRef(null)
  const nivelId = location.state?.nivelId
  const guardadoRef = useRef(false)
  const muertesRef = useRef(0)
  const tiempoRef = useRef(0)
  const esperandoAbandonoRef = useRef(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    guardadoRef.current = false
    muertesRef.current = 0
    tiempoRef.current = 0
    esperandoAbandonoRef.current = false
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    function guardarAbandono(forzar = false) {
      if (guardadoRef.current || nivelId == null) {
        esperandoAbandonoRef.current = false
        navigate('/home')
        return
      }
      guardadoRef.current = true
      esperandoAbandonoRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      console.log('[Juego] Guardando abandono con:', { muertes: muertesRef.current, tiempo: tiempoRef.current, forzar })
      API.post('/partidas/', {
        nivel: nivelId,
        muertes: muertesRef.current || 0,
        tiempo: tiempoRef.current || 0,
        completado: false,
      })
        .catch((err) => console.error('No se pudo guardar abandono de partida', err))
        .finally(() => {
          navigate('/home')
        })
    }

    function onMessage(e) {
      console.log('[Juego] mensaje', e.origin, e.data)
      if (e.origin !== ORIGEN_JUEGO) return

  // SIEMPRE intentar extraer muertes/tiempo aunque el type sea distinto
      const candidatosGlobal = [
        e.data,
        e.data?.datos,
        e.data?.stats,
        e.data?.hud,
        e.data?.estado,
        e.data?.gameState,
        e.data?.data,
        e.data?.resultado,
        e.data?.partida,
        e.data?.finalStats,
      e.data?.endStats,
    ]

    for (const c of candidatosGlobal) {
      const extraido = extraerDatos(c)
      if (extraido) {
        if (extraido.muertes !== null) {
          muertesRef.current = extraido.muertes
        }
        if (extraido.tiempo !== null) {
          tiempoRef.current = extraido.tiempo
        }
      }
    }

      if (e.data?.type === 'resultadoPartida') {
        guardadoRef.current = true
        esperandoAbandonoRef.current = false
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        guardarResultado(e.data.datos || e.data, nivelId)
          .catch((err) => console.error('No se pudo guardar partida', err))
          .finally(() => {
            setTimeout(() => navigate('/home'), 600)
          })
        return
      }

      if (e.data?.type === 'stats' || e.data?.type === 'hudUpdate' || e.data?.type === 'gameStats' || e.data?.type === 'updateStats' || e.data?.type === 'finalStats' || e.data?.type === 'endStats') {
        const extraido = extraerDatos(e.data?.datos || e.data?.stats || e.data?.finalStats || e.data)
        if (extraido) {
          if (extraido.muertes !== null) muertesRef.current = extraido.muertes
          if (extraido.tiempo !== null) tiempoRef.current = extraido.tiempo
          if (esperandoAbandonoRef.current && !guardadoRef.current) {
            guardarAbandono(true)
            return
          }
        }
        return
      }

      if (e.data?.type === 'unityListo' && user?.username) {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'setPlayerName', nombre: user.username },
          ORIGEN_JUEGO
        )
        if (nivelId != null) {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'cargarNivel', nivel: nivelId },
            ORIGEN_JUEGO
          )
        }
        return
      }

      if (e.data?.type === 'salirPanel') {
        if (guardadoRef.current) {
          navigate('/home')
          return
        }

        const directos = [e.data?.datos, e.data?.stats, e.data?.hud, e.data?.final, e.data?.finalStats, e.data]
        for (const c of directos) {
          const extraido = extraerDatos(c)
          if (extraido) {
            if (extraido.muertes !== null) muertesRef.current = extraido.muertes
            if (extraido.tiempo !== null) tiempoRef.current = extraido.tiempo
          }
        }

        if (nivelId == null) {
          navigate('/home')
          return
        }

        const win = iframeRef.current?.contentWindow
        try {
          win?.postMessage({ type: 'solicitarDatos' }, ORIGEN_JUEGO)
          win?.postMessage({ type: 'pedirStats' }, ORIGEN_JUEGO)
          win?.postMessage({ type: 'getStats' }, ORIGEN_JUEGO)
          win?.postMessage({ type: 'requestStats' }, ORIGEN_JUEGO)
          win?.postMessage({ type: 'getFinalStats' }, ORIGEN_JUEGO)
          win?.postMessage({ type: 'enviarDatos' }, ORIGEN_JUEGO)
          win?.postMessage({ type: 'finalizarPartida' }, ORIGEN_JUEGO)
          win?.postMessage({ type: 'getGameData' }, ORIGEN_JUEGO)
          win?.postMessage({ action: 'getStats' }, ORIGEN_JUEGO)
        } catch (err) {
          console.error(err)
        }

        esperandoAbandonoRef.current = true

        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
          console.log('[Juego] Timeout salirPanel -> guardando con', muertesRef.current, tiempoRef.current)
          guardarAbandono(true)
        }, 3000)

        return
      }
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [user, navigate, nivelId])

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