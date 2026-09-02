// ─── CONFIGURACIÓN CENTRAL DE AXIOS ───────────────────────────────────
// Este archivo configura la instancia de Axios que se usa en toda la
// aplicación para hacer peticiones HTTP al backend. Implementa:
// 1. Configuración base (URL, headers, credenciales)
// 2. Interceptor de requests: agrega el token de acceso a cada petición
// 3. Interceptor de responses: maneja la renovación automática del token
//    cuando recibe un 401 (token expirado), con cola de peticiones fallidas
//    para evitar múltiples peticiones de refresh simultáneas.

// ─── IMPORTACIONES ────────────────────────────────────────────────────
// Axios: librería HTTP para hacer peticiones al backend
import axios from 'axios'
// Funciones para gestionar el token de acceso en memoria
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
  // Es ESencial para el sistema de refresh tokens basado en cookies HttpOnly
  // que usa el backend (el refresh token se envía automáticamente como cookie).
  withCredentials: true,
})

// ─── COLA DE PETICIONES FALLIDAS ─────────────────────────────────────
// Cuando el token expira y se está renovando, múltiples peticiones pueden
// fallar simultáneamente con 401. En lugar de hacer múltiples peticiones
// de refresh (una por cada petición fallida), las encolamos y las reintentamos
// todas una vez que el refresh termine exitosamente.

// Flag que indica si actualmente se está renovando el token.
// Evita que se disparen múltiples peticiones de refresh simultáneas.
let isRefreshing = false
// Cola de peticiones que fallaron mientras se renovaba el token.
// Cada elemento contiene las funciones resolve y reject de la Promise.
let failedQueue = []

// Procesa todas las peticiones que estaban encoladas durante el refresh.
// Si el refresh fue exitoso, resuelve cada promesa con el nuevo token.
// Si falló, rechaza cada promesa con el error correspondiente.
const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error)
    else resolve(token)
  })
  // Limpiamos la cola después de procesar todas las peticiones
  failedQueue = []
}

// ─── INTERCEPTOR DE REQUESTS (SALIENTES) ─────────────────────────────
// Se ejecuta ANTES de cada petición HTTP saliente.
// Su función es agregar el token de acceso (Bearer token) al header
// Authorization de cada petición, para que el backend pueda autenticar
// al usuario en cada endpoint protegido.
API.interceptors.request.use((config) => {
  // Obtenemos el token actual del almacenamiento en memoria
  const token = getAccessToken()
  if (token) {
    // Si existe un token, lo agregamos al header Authorization
    // en formato "Bearer <token>", que es el estándar OAuth 2.0
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// ─── INTERCEPTOR DE RESPONSES (ENTRANTES) ────────────────────────────
// Se ejecuta DESPUÉS de cada respuesta HTTP recibida.
// Su función principal es detectar errores 401 (No Autorizado) y
// manejar la renovación automática del token de acceso.
API.interceptors.response.use(
  // Si la respuesta es exitosa (código 2xx), la devolvemos tal cual
  (response) => response,
  // Si hay un error, analizamos si necesita renovación de token
  async (error) => {
    // Obtenemos la configuración original de la petición que falló
    const originalRequest = error.config

    // ─── CONDICIONES PARA RENOVAR EL TOKEN ──────────────────────
    // Solo intentamos renovar si:
    // 1. El error es 401 (No Autorizado - token expirado/inválido)
    // 2. Esta petición NO ha sido reintentada antes (_retry flag)
    // 3. La petición fallida NO es de refresh token (para evitar
    //    un bucle infinito de refresh fallido → refresh → fail → repeat)
    // 4. La petición NO es de login/register: ahí un 401 significa
    //    "credenciales incorrectas", no un token expirado. Intentar
    //    renovar el token en ese caso devolvería un error de refresh
    //    en lugar del mensaje de credenciales correcto.
    const isAuthEndpoint =
      originalRequest.url.includes('/login/') ||
      originalRequest.url.includes('/register/') ||
      originalRequest.url.includes('/token/refresh/')
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
      // Si ya hay un refresh en curso, encolamos esta petición
      // en lugar de发起 otra petición de refresh
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          // Cuando el refresh termine con éxito, reintentamos la petición
          // original con el nuevo token
          if (token) {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return API(originalRequest)
          }
          // Si no se obtuvo token, rechazamos con el error original
          return Promise.reject(error)
        }).catch(() => Promise.reject(error))
      }

      // Marcamos la petición como reintentada para evitar bucles infinitos
      originalRequest._retry = true
      // Indicamos que estamos en proceso de refresh
      isRefreshing = true

      try {
        // ─── PETICIÓN DE REFRESH TOKEN ────────────────────────
        // Enviamos una petición al endpoint de refresh. El refresh token
        // se envía automáticamente como cookie HttpOnly gracias a
        // withCredentials: true, por lo que no necesitamos enviarlo
        // explícitamente en el body.
        const { data } = await API.post('/token/refresh/')
        const newToken = data.access_token

        // Guardamos el nuevo access token en memoria
        setAccessToken(newToken)

        // Procesamos todas las peticiones que estaban encoladas
        // durante el refresh, pasándoles el nuevo token
        processQueue(null, newToken)

        // Reintentamos la petición original con el nuevo token
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return API(originalRequest)
      } catch (refreshError) {
        // ─── FALLO EN LA RENOVACIÓN DEL TOKEN ─────────────────
        // Si el refresh también falló, significa que la sesión ha expirado.
        // Rechazamos todas las peticiones encoladas con el error.
        processQueue(refreshError, null)

        // Limpiamos el token de acceso de memoria
        clearAccessToken()

        // Limpiamos los datos del usuario del localStorage.
        // Esto fuerza al usuario a iniciar sesión nuevamente.
        localStorage.removeItem('usuario:v1')

        return Promise.reject(refreshError)
      } finally {
        // Siempre reseteamos el flag de refresh, independientemente
        // de si fue exitoso o falló
        isRefreshing = false
      }
    }

    // Para cualquier otro error que no sea 401, lo propagamos tal cual
    return Promise.reject(error)
  }
)

// ─── EXPORTACIÓN ──────────────────────────────────────────────────────
// Exportamos la instancia configurada de Axios para usar en toda la aplicación.
// Todos los servicios (authService, etc.) importan esta instancia en lugar
// de crear sus propias instancias de Axios.
export default API
