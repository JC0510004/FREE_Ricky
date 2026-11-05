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

function tieneDatosPartida(datos) {
  return datos?.nivelId != null
    || datos?.escena != null
    || datos?.muertes != null
    || datos?.tiempo != null
}

async function resolverNivelId(datos, nivelIdFallback) {
  let lista = []
  try {
    const { data } = await API.get('/niveles/')
    lista = data.results || data
  } catch (e) {
    console.error('[Juego] error buscando niveles', e)
  }

  if (datos?.nivelId != null) {
    const nivel = lista.find((n) => Number(n.id) === Number(datos.nivelId))
    if (nivel) return nivel.id
  }
  if (nivelIdFallback != null) {
    const nivel = lista.find((n) => Number(n.id) === Number(nivelIdFallback))
    if (nivel) return nivel.id
  }
  if (datos?.escena) {
    const nivel = lista.find((n) => normalizar(n.nombre) === normalizar(datos.escena))
    if (nivel) return nivel.id
  }
  if (nivelIdFallback != null) return Number(nivelIdFallback)
  return null
}

async function guardarResultado(datos, nivelId, token) {
  if (nivelId == null) {
    console.warn(
      '[guardarResultado] No hay un nivel que coincida con el mensaje del juego:',
      { nivelId: datos?.nivelId, escena: datos?.escena }
    )
    return
  }
  if (!token) {
    console.error('[guardarResultado] falta el token de partida; no se guarda')
    return
  }

  try {
    await API.post('/partidas/', {
      nivel: Number(nivelId),
      muertes: datos?.muertes ?? 0,
      tiempo: datos?.tiempo ?? 0,
      completado: datos?.completado === true,
      token,
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
  const tokenPromisesRef = useRef(new Map())
  const guardadoRef = useRef(false)
  const savePromiseRef = useRef(null)
  const muertesRef = useRef(null)
  const tiempoRef = useRef(null)
  const esperandoAbandonoRef = useRef(false)
  const timeoutRef = useRef(null)

  useEffect(() => {
    let activo = true
    guardadoRef.current = false
    savePromiseRef.current = null
    muertesRef.current = null
    tiempoRef.current = null
    esperandoAbandonoRef.current = false
    tokenPromisesRef.current = new Map()
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

    function asegurarToken(id) {
      if (id == null) return Promise.resolve(null)
      if (!tokenPromisesRef.current.has(id)) {
        const promesa = API.post('/partidas/iniciar/', { nivel: id })
          .then(({ data }) => {
            const token = data?.token ?? null
            if (!token) tokenPromisesRef.current.delete(id)
            return token
          })
          .catch((err) => {
            console.error(
              '[Juego] iniciar falló:',
              id,
              err.response?.status,
              JSON.stringify(err.response?.data)
            )
            tokenPromisesRef.current.delete(id)
            return null
          })
        tokenPromisesRef.current.set(id, promesa)
      }
      return tokenPromisesRef.current.get(id)
    }

    function prepararTokens() {
      if (nivelId != null) {
        asegurarToken(nivelId)
        return
      }
      API.get('/niveles/')
        .then(({ data }) => {
          if (!activo) return
          const lista = data.results || data
          for (const nivel of lista) asegurarToken(nivel.id)
        })
        .catch((err) => {
          console.error('[Juego] no se pudieron preparar los tokens', err)
        })
    }

    function aplicarStats(datos) {
      if (!datos) return
      if (datos.muertes !== null && datos.muertes !== undefined) {
        muertesRef.current = datos.muertes
      }
      if (datos.tiempo !== null && datos.tiempo !== undefined) {
        tiempoRef.current = datos.tiempo
      }
    }

    function tieneStats() {
      return muertesRef.current !== null || tiempoRef.current !== null
    }

    function guardarPartida(datos, { navegar = false } = {}) {
      if (guardadoRef.current) return savePromiseRef.current
      guardadoRef.current = true
      esperandoAbandonoRef.current = false
      limpiarTimeout()

      const completado = datos.completado === true
      const promesa = (async () => {
        const idNivel = await resolverNivelId(datos, nivelId)
        if (idNivel == null) return
        const token = await asegurarToken(idNivel)
        await guardarResultado({ ...datos, completado }, idNivel, token)
        tokenPromisesRef.current.delete(idNivel)
        if (activo && !completado) asegurarToken(idNivel)
      })()
        .catch((err) => {
          console.error('[Juego] no se pudo guardar la partida', err)
        })
        .finally(() => {
          if (navegar) navigate('/home')
        })

      savePromiseRef.current = promesa
      return promesa
    }

    function guardarAbandono(datos = null) {
      aplicarStats(datos)
      if (guardadoRef.current) {
        const pendiente = savePromiseRef.current || Promise.resolve()
        pendiente.finally(() => navigate('/home'))
        return pendiente
      }
      if (nivelId == null && !tieneDatosPartida(datos)) {
        navigate('/home')
        return Promise.resolve()
      }

      esperandoAbandonoRef.current = false
      limpiarTimeout()
      console.log('[Juego] Guardando abandono con:', {
        muertes: muertesRef.current,
        tiempo: tiempoRef.current,
      })
      return guardarPartida({
        ...(datos || {}),
        muertes: muertesRef.current,
        tiempo: tiempoRef.current,
        completado: false,
      }, { navegar: true })
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
      console.log('[Juego] mensaje', tipo, datos)
      aplicarStats(datos)

      if (tipo === MENSAJE.UNITY_LISTO) {
        prepararTokens()
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
        guardarPartida(datos, { navegar: datos.completado === true })
        return
      }

      if (tipo === MENSAJE.SALIR) {
        if (guardadoRef.current) {
          const pendiente = savePromiseRef.current || Promise.resolve()
          pendiente.finally(() => navigate('/home'))
          return
        }
        if (tieneDatosPartida(datos)) {
          guardarPartida({ ...datos, completado: datos.completado === true }, { navegar: true })
          return
        }
        if (nivelId == null) {
          navigate('/home')
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
      activo = false
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
