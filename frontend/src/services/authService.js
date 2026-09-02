// ─── SERVICIO DE AUTENTICACIÓN ────────────────────────────────────────
// Este módulo encapsula toda la lógica de autenticación del lado del cliente.
// Actúa como capa de abstracción entre el contexto de React y las peticiones
// HTTP al backend. Maneja login, registro, cierre de sesión, renovación de
// token y persistencia de datos del usuario en localStorage.
// IMPORTANTE: Este servicio NO tiene dependencias de React, lo que permite
// usarlo tanto dentro de componentes como en el interceptor de Axios
// (que no puede usar hooks de React).

// ─── IMPORTACIONES ────────────────────────────────────────────────────
// API: instancia de Axios configurada con la URL base, interceptores y headers
import API from '../api/axios'
// Funciones para gestionar el access token en memoria (no en localStorage)
import { setAccessToken, getAccessToken, clearAccessToken } from '../api/tokenStore'

// ─── CONSTANTE: CLAVE DE ALMACENAMIENTO ──────────────────────────────
// Clave usada en localStorage para guardar los datos del usuario.
// Se usa el formato 'usuario:v1' para facilitar la migración futura:
// si el esquema cambia, se puede usar 'usuario:v2' sin conflictos.
const USER_KEY = 'usuario:v1'

// ─── OBJETO DEL SERVICIO DE AUTENTICACIÓN ────────────────────────────
// Exportamos un objeto con todos los métodos de autenticación como propiedades.
// Usamos un objeto (en lugar de exportaciones individuales) para agrupar
// lógicamente todas las operaciones relacionadas con auth.
export const authService = {

  // ─── MÉTODO: INICIO DE SESIÓN ──────────────────────────────────────
  // Envía las credenciales (usuario y contraseña) al backend.
  // Si son correctas, el backend devuelve los datos del usuario y el access token.
  // Los datos del usuario se guardan en localStorage (para persistir entre
  // recargas de página) y el access token se guarda en memoria.
  // Retorna: objeto con los datos del usuario y tokens.
  async login(username, password) {
    // Hacemos la petición POST al endpoint de login con las credenciales
    const { data } = await API.post('/login/', { username, password })

    // Guardamos los datos del usuario en localStorage para que persistan
    // cuando el usuario recargue la página. Al recargar, AuthContext
    // leerá estos datos para mostrar al usuario sin necesidad de login.
    localStorage.setItem(USER_KEY, JSON.stringify(data.usuario))

    // Si el backend devuelve un access token, lo guardamos en memoria.
    // El access token se usa en cada petición HTTP para autenticar al usuario.
    if (data.access_token) {
      setAccessToken(data.access_token)
    }

    // Devolvemos todos los datos (usuario, tokens, etc.) al componente
    // que llamó a login para que pueda usarlos
    return data
  },

  // ─── MÉTODO: REGISTRO ──────────────────────────────────────────────
  // Envía los datos de registro de un nuevo usuario al backend.
  // NO inicia sesión automáticamente después del registro; el usuario
  // debe ir a la página de login para autenticarse.
  // Parámetro data: objeto con los campos del formulario de registro
  // (nombre de usuario, email, contraseña, etc.)
  async register(data) {
    // Hacemos la petición POST al endpoint de registro
    const { data: response } = await API.post('/register/', data)
    return response
  },

  // ─── MÉTODO: RENOVACIÓN DE TOKEN ──────────────────────────────────
  // Solicita un nuevo access token al backend usando el refresh token
  // (que se envía automáticamente como cookie HttpOnly).
  // Retorna: el nuevo access token si fue exitoso, o null si falló.
  // El interceptor de Axios también maneja esta lógica, pero este método
  // permite una renovación manual cuando se necesita.
  async refreshToken() {
    try {
      const { data } = await API.post('/token/refresh/')
      if (data.access_token) {
        // Guardamos el nuevo token en memoria para las siguientes peticiones
        setAccessToken(data.access_token)
        return data.access_token
      }
      return null
    } catch {
      // Si el refresh falló, la sesión ha expirado completamente.
      // Limpiamos todos los datos de autenticación del cliente.
      localStorage.removeItem(USER_KEY)
      clearAccessToken()
      return null
    }
  },

  // ─── MÉTODO: CIERRE DE SESIÓN ─────────────────────────────────────
  // Cierra la sesión del usuario actual. Primero notifica al backend
  // (para invalidar el refresh token en la cookie del servidor) y luego
  // limpia todos los datos locales de autenticación.
  async logout() {
    try {
      // Notificamos al backend para que invalide el refresh token.
      // Usamos try/catch vacío porque incluso si la petición falla
      // (por ejemplo, si el token ya expiró), queremos limpiar los
      // datos locales de todas formas.
      await API.post('/logout/')
    } catch {
      // Error al notificar al backend — la sesión local se limpia de todas formas
    }
    // Limpiamos los datos del usuario del localStorage
    localStorage.removeItem(USER_KEY)
    // Limpiamos el access token de memoria
    clearAccessToken()
  },

  // ─── MÉTODO: VERIFICACIÓN DE SESIÓN ───────────────────────────────
  // Verifica si la sesión del usuario actual es válida haciendo una
  // petición al endpoint de verificación del backend.
  // Retorna: true si la sesión es válida, false si no lo es.
  // Esto se usa al cargar la aplicación para verificar si el usuario
  // sigue autenticado (por si el refresh token expiró).
  async verifySession() {
    try {
      await API.get('/verify/')
      return true
    } catch {
      // Si la verificación falla (401, error de red, etc.),
      // la sesión no es válida
      return false
    }
  },

  // ─── MÉTODO: OBTENER USUARIO GUARDADO ─────────────────────────────
  // Lee los datos del usuario desde localStorage.
  // Se usa al iniciar la aplicación para restaurar el estado de sesión
  // sin necesidad de login (si el usuario recargó la página).
  // Retorna: objeto del usuario o null si no hay datos guardados.
  getStoredUser() {
    // Leemos la cadena JSON del localStorage
    const raw = localStorage.getItem(USER_KEY)
    // Si no hay datos guardados, retornamos null
    if (!raw) return null
    try {
      // Intentamos parsear el JSON. Si está corrupto, retornamos null.
      // Esto puede ocurrir si el usuario manipuló el localStorage manualmente.
      return JSON.parse(raw)
    } catch { return null }
  },

  // ─── MÉTODO: OBTENER TOKEN GUARDADO ───────────────────────────────
  // Devuelve el token de acceso actual desde el almacén en memoria.
  // Es un wrapper simple sobre la función getAccessToken de tokenStore.
  getStoredToken() {
    return getAccessToken()
  },
}
