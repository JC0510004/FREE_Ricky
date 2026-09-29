// ─── CONFIGURACIÓN CENTRAL DE AXIOS ───────────────────────────────────
// Este archivo configura la instancia de Axios que se usa en toda la
// aplicación para hacer peticiones HTTP al backend. Implementa:
// 1. Configuración base (URL, headers, credenciales)
// 2. Interceptor de peticiones: agrega el access token a cada petición
// 3. Interceptor de respuestas: renueva el access token cuando el backend
//    responde que caducó, compartiendo UNA sola renovación entre todas las
//    peticiones que la necesitan.
//
// ─── MODELO DE CONCURRENCIA (léase antes de tocar el refresh) ─────────
// El problema que resuelve este archivo: cuando expira el access token,
// N peticiones que salen en el mismo tick (la home pide /ranking/,
// /niveles/, /partidas/ y /estadisticas/ a la vez) reciben un 401 a la vez.
// Si cada una disparase su propio refresh, el backend vería N rotaciones de
// la cookie refresh_token en paralelo y N-1 de ellas se rejectarían
// (el token anterior ya está en la blacklist), dejando al usuario con la
// sesión muerta de forma intermitente.
//
// Aquí se usa el modelo "una promesa compartida" (single-flight):
//
//   refreshPromise   -> ES la promesa de la ÚNICA renovación en vuelo.
//                      Mientras no sea null, cualquier 401 que necesite
//                      renovar hace `await refreshPromise`: no lanza otra
//                      petición, simplemente se suma a la misma.
//   refreshSuspended -> tras un refresh fallido, la sesión está muerta.
//                      Marca de "no lo intentes otra vez" para que las
//                      peticiones siguientes no monten una tormenta de
//                      refrescos contra un backend que ya los rechazó. Se
//                      rearma cuando el usuario inicia sesión de nuevo.
//
// Invariantes que debe mantener este archivo (hay tests que los fijan):
//   1. Como mucho UNA petición a /token/refresh/ en vuelo a la vez.
//   2. /token/refresh/ nunca se reintenta a sí misma (ni siquiera si su
//      respuesta trae el cuerpo de SimpleJWT): si no, 401 -> refresh ->
//      401 -> refresh... bucle infinito.
//   3. Solo se renueva ante un 401 que dice explícitamente "el token no es
//      válido". Un 401 de login ("Credenciales incorrectas") o un 403 de
//      cuenta desactivada NO se renuevan: reenviarlos cambiaría el error
//      que ve el usuario por otro, y sería ruido.
//   4. Si la renovación falla, TODOS los que esperaban la promesa compartida
//      se rechazan (nadie se queda colgado esperando un token que no llegó).

// ─── IMPORTACIONES ────────────────────────────────────────────────────
// Axios: librería HTTP para hacer peticiones al backend
import axios from 'axios'
// Funciones para gestionar el access token en memoria
import { getAccessToken, setAccessToken, clearAccessToken } from './tokenStore'

// ─── CREACIÓN DE LA INSTANCIA DE AXIOS ───────────────────────────────
// Se crea una instancia personalizada de Axios con configuración base.
// Usamos una instancia en lugar de importar axios directamente para no
// modificar la configuración global de axios.
const API = axios.create({
  // La URL base se toma de la variable de entorno VITE_API_URL.
  // Si no existe, se usa '/api' como fallback (útil en producción
  // donde el proxy está configurado en nginx o similar).
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    // Tipo de contenido por defecto: JSON
    'Content-Type': 'application/json',
    // Header que identifica la petición como AJAX/XMLHttpRequest.
    // Esto ayuda al backend a distinguir entre peticiones API
    // y peticiones de navegador normales.
    'X-Requested-With': 'XMLHttpRequest',
  },
  // withCredentials: true permite enviar cookies con cada petición.
  // Es esencial para el sistema de refresh tokens basado en cookies HttpOnly
  // que usa el backend (el refresh token se envía automáticamente como cookie).
  withCredentials: true,
})

// ─── CONSTANTES DE URLs ───────────────────────────────────────────────
// Endpoint de renovación (ver backend/api/urls.py -> token/refresh/).
const REFRESH_URL = '/token/refresh/'
// Clave del usuario en localStorage. Es el mismo valor que usa authService
// para no dejar usuarios zombis cuando la sesión muere.
const USER_KEY = 'usuario:v1'

// ─── ESTADO DE CONCURRENCIA DEL REFRESH ───────────────────────────────
// Promesa de la renovación en vuelo, o null si ahora mismo no hay ninguna.
// Es el corazón del modelo single-flight descrito en la cabecera.
let refreshPromise = null
// true cuando ya sabemos que la sesión está muerta: no se vuelve a intentar.
let refreshSuspended = false

// ─── CLASIFICACIÓN DE ERRORES ─────────────────────────────────────────
// Rutas donde un 401 NO significa "el access token caducó" y por tanto no
// deben entrar en la cola de renovación.
//
// - /token/refresh/ es el caso crítico: su propio 401 significa "no hay
//   sesión", así que reintentarlo a sí mismo es el bucle infinito.
// - /login/ y /register/ devuelven 401 por credenciales/validación: renovar
//   ahí convierte un mensaje útil ("Credenciales incorrectas") en otro
//   inútil ("Sesión expirada").
// - /logout/ con 401 significa que la sesión ya no existe; reintentar para
//   cerrar una sesión que ya está cerrada no tiene sentido, y el logout
//   local se hace igual (ver AuthContext.logout).
const NO_RENOVAR = ['/token/refresh/', '/login/', '/register/', '/logout/']

// Normaliza la url de una config, sea absoluta o relativa a la baseURL.
function urlDe(config) {
  return config?.url ?? ''
}

function esRutaDeAuthSinRenovar(config) {
  const url = urlDe(config)
  return NO_RENOVAR.some((ruta) => url.includes(ruta))
}

// ─── ¿Este 401 es un access token caducado? ────────────────────────────
// True SOLO cuando el access token caducó o fue revocado.
//
// SimpleJWT responde a un endpoint protegido con 401 y este cuerpo:
//   { code: 'token_not_valid', messages: [...], detail: '...' }
// (views_auth.py lo deja pasar por DRF, que serializa el dict tal cual).
//
// En cambio, /login/ y /token/refresh/ responden 401 con { error: '...' } y
// NO se deben renovar. Por eso se mira el cuerpo y no solo el código HTTP:
// el mismo 401 significa cosas opuestas según de dónde venga.
export function isExpiredTokenError(error) {
  // Sin respuesta no hay 401: es un error de red (DNS, timeout, CORS).
  if (error?.response?.status !== 401) return false

  const { data } = error.response

  // Forma canónica de SimpleJWT.
  if (data?.code === 'token_not_valid') return true
  // Forma anidada: { detail: { code: 'token_not_valid' } }
  if (data?.detail?.code === 'token_not_valid') return true
  // Red de seguridad: si el backend solo manda el detalle en texto.
  if (typeof data?.detail === 'string') {
    return /token/i.test(data.detail) && /not valid|no es válido|expirad/i.test(data.detail)
  }
  return false
}

// ─── CIERRE DE SESIÓN LOCAL ───────────────────────────────────────────
// Cuando el backend ya no reconoce la sesión, el frontend tiene que olvidarla
// SÍ O SÍ. Si no, la app queda "autenticada" en memoria con endpoints que
// devuelven 401 en bucle (el estado zombi del que habla la auditoría).
function cerrarSesionLocal(motivo) {
  // 1. El access token en memoria deja de enviarse en cualquier petición.
  clearAccessToken()
  // 2. El usuario guardado deja de "restaurar" una sesión fantasma al
  //    recargar. Sin esto, cada recarga volvería a intentar verificar una
  //    sesión que el backend ya no reconoce.
  try {
    localStorage.removeItem(USER_KEY)
  } catch {
    // localStorage puede lanzar SecurityError (Safari con "prevenir
    // seguimiento", modos privados). Es peor no borrar, nunca peor fallar.
  }
  // 3. La renovación queda suspendida: la sesión está muerta y reintentar
  //    solo genera más 401. Se rearma en el próximo login correcto.
  refreshSuspended = true
  // 4. Avisamos a React, que es el único sitio donde vive el estado de
  //    autenticación: el interceptor no puede tocar hooks.
  window.dispatchEvent(new CustomEvent('auth:session-expired', { detail: motivo }))
}

// ─── RENOVACIÓN DEL ACCESS TOKEN ──────────────────────────────────────
// Devuelve la promesa de la renovación en vuelo, creando la primera si no
// hay ninguna. Quien ya está esperando esa promesa la comparte.
function renovarAccessToken() {
  if (!refreshPromise) {
    // El .finally devuelve una promesa nueva: se asigna la cadena completa,
    // no el interior, para que TODOS compartan exactamente el mismo
    // resultado (éxito o fallo) y no se queden esperando a medias.
    refreshPromise = ejecutarRefresh().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

// Trabajo real de la renovación. Se ejecuta como mucho una vez por vuelo.
async function ejecutarRefresh() {
  try {
    // El refresh token viaja en la cookie HttpOnly (withCredentials: true),
    // así que no se manda en el body. El backend rota la cookie y devuelve
    // solo el access token nuevo.
    const { data } = await API.post(REFRESH_URL)

    const nuevoToken = data?.access_token
    if (!nuevoToken) {
      // Respuesta inesperada (200 sin token). No es un caso que debamos
      // asumir: se trata como sesión caída, igual que un 401.
      throw new Error('La renovación devolvió una respuesta sin access token')
    }

    setAccessToken(nuevoToken)
    // La sesión vive otra vez: se rearma la renovación para los 401 futuros.
    refreshSuspended = false
    return nuevoToken
  } catch (error) {
    // Se limpia el estado local y se rechaza la promesa compartida, con lo
    // que todas las peticiones encoladas reciben el mismo error claro.
    cerrarSesionLocal('refresh fallido')
    throw error
  }
}

// ─── INTERCEPTOR DE PETICIONES (SALIENTES) ─────────────────────────────
// Se ejecuta ANTES de cada petición HTTP saliente: añade el header
// Authorization con el access token en memoria, que es la credencial que
// valida JWTAuthentication en el backend.
export function attachAuthHeader(config) {
  // Guarda defensiva: si algún camino de axios entrega una petición sin
  // config, devolvemos lo mismo que nos dieron. Antes esto reventaba con un
  // TypeError dentro del interceptor, que tapaba el error real.
  if (!config) return config

  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
}

// Rechazo del interceptor de peticiones: se propaga el error intacto.
// Un interceptor no debería recibir nunca undefined, pero si lo recibe debe
// reenviar el error original en vez de sustituirlo por otro distinto.
export function forwardRequestError(error) {
  return Promise.reject(error)
}

API.interceptors.request.use(attachAuthHeader, forwardRequestError)

// ─── INTERCEPTOR DE RESPONSES (ENTRANTES) ────────────────────────────
// Se ejecuta DESPUÉS de cada respuesta recibida.
API.interceptors.response.use(
  (response) => {
    // Un login o registro correcto reabre la puerta a la renovación: el
    // backend acaba de emitir una cookie refresh_token nueva. Es lo que
    // desactiva `refreshSuspended` tras una sesión caída.
    const url = urlDe(response?.config)
    if ((url.includes('/login/') || url.includes('/register/')) && response.status < 300) {
      refreshSuspended = false
    }
    // Un logout cierra la sesión: aunque el backend fallara y su cookie
    // siguiera viva por un motivo raro, no tiene sentido renovar para
    // reintentar un cierre de sesión. Se rearma con el próximo login.
    if (url.includes('/logout/') && response.status < 300) {
      refreshSuspended = true
    }
    return response
  },

  async (error) => {
    // ─── GUARD DE error.config (hallazgo 3.5) ──────────────────────
    // Un error de red llega sin `config` (y sin `response`). Tocar
    // error.config._retry sin comprobarlo lanzaba un TypeError DENTRO del
    // interceptor, que sustituía el error de red real por uno inútil: el
    // usuario veía "falló la conexión" y el developers veía otra cosa.
    const originalRequest = error?.config
    if (!originalRequest) return Promise.reject(error)

    // ─── ¿Hay algo que renovar? ────────────────────────────────────
    // 1. Solo 401. Un 403 ("Cuenta desactivada") o un 429 ("Cuenta
    //    bloqueada") son respuestas definitivas: reenviar la petición
    //    cambiaría el mensaje que ve el usuario y no arregla nada.
    if (error.response?.status !== 401) return Promise.reject(error)
    // 2. El cuerpo tiene que decir que el TOKEN caducó. Un 401 de
    //    credenciales no se renueva (ver isExpiredTokenError).
    if (!isExpiredTokenError(error)) return Promise.reject(error)
    // 3. /token/refresh/ jamás se reintenta a sí misma: sería el bucle.
    if (esRutaDeAuthSinRenovar(originalRequest)) return Promise.reject(error)
    // 4. Si ya sabemos que la sesión está muerta, no se insiste.
    if (refreshSuspended) return Promise.reject(error)
    // 5. Cada petición se reintenta como mucho UNA vez. La bandera se pone
    //    ANTES de esperar la renovación, también para las que se encolan:
    //    si se pusiera después, una petición reencolada llegaría al
    //    reintento sin ella y podría pedir otro refresh (hallazgo 3.4).
    if (originalRequest._retry) return Promise.reject(error)
    originalRequest._retry = true

    try {
      // Única línea de contacto con la renovación. Si ya hay un refresh en
      // vuelo, esto no lanza otra petición: se espera a la misma promesa.
      const nuevoToken = await renovarAccessToken()

      originalRequest.headers = originalRequest.headers || {}
      originalRequest.headers.Authorization = `Bearer ${nuevoToken}`
      return API(originalRequest)
    } catch (refreshError) {
      // La renovación falló. La promesa compartida ya se rechazó y el
      // estado local ya está limpio, así que aquí solo hay que devolver
      // ese error. Todas las peticiones encoladas reciben el mismo.
      return Promise.reject(refreshError)
    }
  }
)

// ─── EXPORTACIÓN ──────────────────────────────────────────────────────
// Exportamos la instancia configurada de Axios para usar en toda la aplicación.
// Todos los servicios (authService, etc.) importan esta instancia en lugar
// de crear sus propias instancias de Axios.
export default API
