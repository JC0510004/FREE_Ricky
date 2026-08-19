// ─── ALMACÉN DE TOKENS EN MEMORIA ─────────────────────────────────────
// Este módulo gestiona el access token de forma simple en memoria (variable).
// El token NO se almacena en localStorage ni en cookies del lado del cliente,
// solo se mantiene en esta variable mientras la aplicación está activa.
// Esto es una decisión de seguridad: si el usuario cierra la pestaña o
// recarga la página, el token se pierde y se renueva al verificar la sesión.

// Variable privada (no exportada directamente) que almacena el token de acceso.
// Se accede solo a través de las funciones getter/setter exportadas.
let accessToken = null

// ─── GUARDAR TOKEN ────────────────────────────────────────────────────
// Almacena el token de acceso en memoria. Se llama después de:
// 1. Login exitoso
// 2. Refresh token exitoso
// El token se mantiene solo en memoria (no en localStorage/cookies del cliente)
// como medida de seguridad contra ataques XSS (si un atacante inyecta JS malicioso,
// no puede leer esta variable al no estar en el DOM o en storage persistente).
export function setAccessToken(token) {
  accessToken = token
}

// ─── OBTENER TOKEN ────────────────────────────────────────────────────
// Devuelve el token de acceso actual desde memoria.
// Se usa en el interceptor de requests de Axios para agregar el header
// Authorization a cada petición HTTP saliente.
export function getAccessToken() {
  return accessToken
}

// ─── LIMPIAR TOKEN ────────────────────────────────────────────────────
// Elimina el token de acceso de memoria. Se llama cuando:
// 1. El refresh token falla (sesión expirada)
// 2. El usuario cierra sesión (logout)
// Esto garantiza que no se envíe un token inválido/expirado
// en futuras peticiones HTTP.
export function clearAccessToken() {
  accessToken = null
}
