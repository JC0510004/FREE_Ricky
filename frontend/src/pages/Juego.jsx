import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import API from '../api/axios'
import {
  MENSAJE,
  normalizarMensajeUnity,
  normalizarOrigen,
} from '../game/unityProtocol'
import {
  normalizarMensajeUnityLegacy,
  solicitudesStatsLegacy,
} from '../game/unityProtocolLegacy'

// Origen del build de Unity WebGL. Configurable por entorno (VITE_GAME_ORIGIN)
// para no atar el código a la IP de una LAN concreta, que es lo que rompía la
// integración en cualquier otro host. El valor por defecto mantiene el
// comportamiento histórico mientras se migra el despliegue.
const ORIGEN_JUEGO_CRUDO = import.meta.env.VITE_GAME_ORIGIN || 'http://192.168.18.50:8080'
// Se compara solo el origen para que una configuración como
// "http://host:8080/" o ".../unity/" no rompa el filtro de seguridad.
const ORIGEN_JUEGO = normalizarOrigen(ORIGEN_JUEGO_CRUDO)
// URL completa del iframe. Permite un endpoint distinto del origen (p. ej. un
// CDN) y conserva el cache-buster del build actual.
const URL_JUEGO = import.meta.env.VITE_GAME_URL
  || `${ORIGEN_JUEGO_CRUDO.replace(/\/+$/, '')}/?v=20261017e`
const normalizar = (s) => String(s).toLowerCase().replace(/[\s_-]/g, '')

// Mientras el build de Unity no cumpla el contrato se aceptan los mensajes
// históricos. Es una capa temporal: se desactiva con
// VITE_UNITY_LEGACY_COMPAT=false en cuanto el juego migre.
function compatibilidadLegacyActiva() {
  return import.meta.env.VITE_UNITY_LEGACY_COMPAT !== 'false'
}

async function guardarResultado(datos, nivelIdFallback) {
  let nivel = null
  try {
    const { data } = await API.get('/niveles/')
    const lista = data.results || data
    if (datos?.nivelId != null) {
      nivel = lista.find((n) => Number(n.id) === Number(datos.nivelId))
    }
    if (!nivel && nivelIdFallback != null) {
      nivel = lista.find((n) => Number(n.id) === Number(nivelIdFallback))
    }
    if (!nivel && datos?.escena) {
      nivel = lista.find((n) => normalizar(n.nombre) === normalizar(datos.escena))
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
        completado: datos?.completado === true,
      })
      console.log('[guardarResultado] Guardado con fallback nivelId')
      return
    } catch (e) {
      console.error('[guardarResultado] fallo con fallback', e)
      return
    }
  }

  if (!nivel) {
    console.warn(
      '[guardarResultado] No hay un nivel que coincida con el mensaje del juego:',
      { nivelId: datos?.nivelId, escena: datos?.escena, nivelIdFallback }
    )
    return
  }

  try {
    await API.post('/partidas/', {
      nivel: nivel.id,
      muertes: datos?.muertes ?? 0,
      tiempo: datos?.tiempo ?? 0,
      completado: datos?.completado === true,
    })
    console.log(
      '[guardarResultado] Partida guardada OK:',
      datos?.completado === true ? 'COMPLETADO' : 'NO COMPLETADO'
    )
  } catch (e) {
    console.error('[guardarResultado] error guardando partida', e)
  }
}

export default function Juego() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const iframeRef = useRef(null)
  const nivelId = location.state?.nivelId
  const guardadoRef = useRef(false)
  const muertesRef = useRef(null)
  const tiempoRef = useRef(null)
  const esperandoAbandonoRef = useRef(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    guardadoRef.current = false
    muertesRef.current = null
    tiempoRef.current = null
    esperandoAbandonoRef.current = false
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }

    function limpiarTimeout() {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    function aplicarStats(datos) {
      if (!datos) return
      if (datos.muertes !== null) muertesRef.current = datos.muertes
      if (datos.tiempo !== null) tiempoRef.current = datos.tiempo
    }

    function tieneStats() {
      return muertesRef.current !== null || tiempoRef.current !== null
    }

    function guardarPartida(datos, completado) {
      if (guardadoRef.current) return
      guardadoRef.current = true
      esperandoAbandonoRef.current = false
      limpiarTimeout()
      guardarResultado({ ...datos, completado }, nivelId)
        .catch((err) => console.error('[Juego] no se pudo guardar la partida', err))
        .finally(() => {
          setTimeout(() => navigate('/home'), 600)
        })
    }

    function guardarAbandono(datos = null) {
      aplicarStats(datos)
      if (guardadoRef.current || nivelId == null) {
        esperandoAbandonoRef.current = false
        navigate('/home')
        return
      }
      guardadoRef.current = true
      esperandoAbandonoRef.current = false
      limpiarTimeout()
      console.log('[Juego] Guardando abandono con:', {
        muertes: muertesRef.current,
        tiempo: tiempoRef.current,
      })
      API.post('/partidas/', {
        nivel: nivelId,
        muertes: muertesRef.current ?? 0,
        tiempo: tiempoRef.current ?? 0,
        completado: false,
      })
        .catch((err) => console.error('[Juego] no se pudo guardar el abandono', err))
        .finally(() => navigate('/home'))
    }

    function solicitarStats() {
      const win = iframeRef.current?.contentWindow
      try {
        const solicitudes = compatibilidadLegacyActiva()
          ? solicitudesStatsLegacy()
          : [{ type: 'solicitarDatos' }]
        for (const solicitud of solicitudes) {
          win?.postMessage(solicitud, ORIGEN_JUEGO)
        }
      } catch (err) {
        console.error('[Juego] no se pudo solicitar stats al juego', err)
      }
      esperandoAbandonoRef.current = true
      limpiarTimeout()
      timeoutRef.current = setTimeout(() => {
        console.log('[Juego] Timeout esperando stats -> guardando abandono')
        guardarAbandono()
      }, 3000)
    }

    function onMessage(e) {
      if (e.origin !== ORIGEN_JUEGO) return

      const mensaje = compatibilidadLegacyActiva()
        ? normalizarMensajeUnityLegacy(e.data)
        : normalizarMensajeUnity(e.data)
      if (!mensaje) {
        console.warn('[Juego] mensaje de Unity fuera del contrato:', e.data)
        return
      }
      if (mensaje.advertencias.length > 0) {
        console.warn('[Juego] contrato incompleto:', mensaje.advertencias.join('; '), e.data)
      }

      const { tipo, datos } = mensaje
      aplicarStats(datos)

      if (tipo === MENSAJE.UNITY_LISTO) {
        if (user?.username) {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'setPlayerName', nombre: user.username },
            ORIGEN_JUEGO
          )
        }
        if (nivelId != null) {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'cargarNivel', nivel: nivelId },
            ORIGEN_JUEGO
          )
        }
        return
      }

      if (tipo === MENSAJE.STATS) {
        if (esperandoAbandonoRef.current && !guardadoRef.current) {
          guardarAbandono()
        }
        return
      }

      if (tipo === MENSAJE.RESULTADO) {
        guardarPartida(datos, datos.completado)
        return
      }

      if (tipo === MENSAJE.SALIR) {
        if (guardadoRef.current) {
          navigate('/home')
          return
        }
        if (nivelId == null) {
          navigate('/home')
          return
        }
        if (datos.completado === true) {
          guardarPartida(datos, true)
          return
        }
        if (tieneStats()) {
          guardarAbandono()
          return
        }
        solicitarStats()
      }
    }

    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      limpiarTimeout()
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
