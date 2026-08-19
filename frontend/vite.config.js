// ─── CONFIGURACIÓN DE VITE ────────────────────────────────────────────
// Este archivo define la configuración del bundler Vite para el proyecto
// frontend. Vite es una herramienta de desarrollo y build que ofrece
// servidores de desarrollo rápidos con hot module replacement (HMR)
// y builds de producción optimizados.

// ─── IMPORTACIONES ────────────────────────────────────────────────────
// defineConfig: función helper de Vite que proporciona autocompletado
// y validación de tipos para la configuración (TypeScript-friendly)
import { defineConfig } from 'vite'
// Plugin oficial de React para Vite: habilita JSX, Fast Refresh (HMR
// para componentes React sin perder estado), y otras optimizaciones
import react from '@vitejs/plugin-react'

// ─── EXPORTACIÓN DE LA CONFIGURACIÓN ─────────────────────────────────
export default defineConfig({
  // Plugins: añadimos el plugin de React para soporte JSX y HMR
  plugins: [react()],

  // Configuración del servidor de desarrollo
  server: {
    // host: '0.0.0.0' permite acceder al servidor desde otros dispositivos
    // en la red local (útil para probar en dispositivos móviles o cuando
    // se ejecuta en Docker). Si solo se necesita acceso local, se puede
    // usar 'localhost' o '127.0.0.1'.
    host: '0.0.0.0',

    // Puerto en el que se ejecuta el servidor de desarrollo de Vite.
    // 5173 es el puerto por defecto de Vite.
    port: 5173,

    // ─── PROXY DE API ────────────────────────────────────────────
    // Configura un proxy inverso para redirigir peticiones /api al backend.
    // Esto evita problemas de CORS durante el desarrollo: el frontend
    // y el backend están en puertos diferentes (5173 vs 8000), pero
    // al hacer proxy, el navegador ve todo como proveniente del mismo origen.
    //
    // Ejemplo: una petición a http://localhost:5173/api/login/
    // se redirige a http://127.0.0.1:8000/api/login/
    proxy: {
      '/api': {
        // URL del backend Django (puerto 8000 es el default de Django)
        target: 'http://127.0.0.1:8000',
        // changeOrigin: true modifica el header 'Host' de la petición
        // para que coincida con el servidor de destino. Sin esto,
        // Django podría rechazar la petición por el Host incorrecto.
        changeOrigin: true,
      },
    },
  },
})
