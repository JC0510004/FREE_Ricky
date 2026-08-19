// ─── DEFINICIÓN DEL CONTEXTO DE AUTENTICACIÓN ─────────────────────────
// Este archivo define el objeto React Context de autenticación.
// Está separado del AuthProvider (en AuthContext.jsx) a propósito para
// evitar dependencias circulares:
// - useAuth.js importa AuthContext desde aquí
// - AuthContext.jsx (el proveedor) importa AuthContext desde aquí
// - Si ambos estuvieran en el mismo archivo, habría un ciclo de imports
//
// El valor por defecto es null, lo que permite que useAuth.js detecte
// cuando el hook se usa fuera de un AuthProvider y lance un error claro.

// ─── IMPORTACIONES ────────────────────────────────────────────────────
// createContext: función de React que crea un objeto de contexto
import { createContext } from 'react'

// ─── CREACIÓN DEL CONTEXTO ────────────────────────────────────────────
// createContext(null) crea un contexto con valor por defecto null.
// El null se usa como valor por defecto intencionalmente: si un componente
// intenta consumir este contexto sin estar dentro de un AuthProvider,
// recibirá null, lo que permite que useAuth() lance un error descriptivo.
export const AuthContext = createContext(null)
