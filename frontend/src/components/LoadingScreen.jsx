// ─── LOADING SCREEN - Pantalla de carga inicial ───
// Componente que se muestra al cargar la aplicación. Bloquea el scroll,
// muestra una animación de carga con el logo, y notifica al padre
// cuando la animación ha terminado para permitir la transición.

import { useState, useEffect } from 'react';

// ─── Props ───
// onFinished: callback que se ejecuta cuando la pantalla de carga
// ha completado su animación, permitiendo al componente padre
// ocultar esta pantalla y mostrar el contenido principal
export default function LoadingScreen({ onFinished }) {
  // ─── Estado de visibilidad ───
  // Controla si la pantalla tiene la clase 'hidden' para la transición CSS
  const [isHidden, setIsHidden] = useState(false);

  // ─── Efecto principal de temporización ───
  // Gestiona las tres fases de la pantalla de carga:
  // 1. Bloqueo de scroll y visualización de la animación
  // 2. Aplicación de la clase 'hidden' para la transición de salida
  // 3. Notificación al padre de que la carga ha terminado
  useEffect(() => {
    // ─── Fase 1: Bloqueo de scroll ───
    // Agrega una clase al body que impide el scroll mientras se muestra
    // la pantalla de carga (preveniendo scroll accidental)
    document.body.classList.add('loading-lock');

    // ─── Fase 2: Transición de salida (2500ms) ───
    // Después de 2.5 segundos, activa la clase 'hidden' que inicia
    // la animación CSS de fade-out y desbloquea el scroll
    const fadeTimeout = setTimeout(() => {
      setIsHidden(true);
      document.body.classList.remove('loading-lock');
    }, 2500);

    // ─── Fase 3: Notificación de finalización (3500ms) ───
    // Un segundo después de iniciar la transición de salida (para dar
    // tiempo a la animación CSS), notifica al componente padre
    const removeTimeout = setTimeout(() => {
      if (onFinished) {
        onFinished();
      }
    }, 3500);

    // ─── Limpieza de timeouts ───
    // Si el componente se desmonta antes de que los timeouts se ejecuten,
    // cancela ambos y restaura el scroll del body
    return () => {
      clearTimeout(fadeTimeout);
      clearTimeout(removeTimeout);
      document.body.classList.remove('loading-lock');
    };
  }, [onFinished]);

  return (
    <div className={`loading-screen ${isHidden ? 'hidden' : ''}`} id="loading-screen">

      {/* ─── Contenido central de la carga ─── */}
      <div className="loading-content">

        {/* ─── Logo animado con efecto ping ─── */}
        {/* Contiene el logo del juego y un efecto de onda circular (ping) */}
        <div className="loading-logo-container">
          {/* TODO: Replace with local asset: import logo from '../../assets/logo.png' */}
          <img
            alt="Loading Anchor"
            className="loading-logo"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC17BH1mpOeKMSIFxD3LZsdwGZhMGfS5tj8ftfruK8TLrvjMxC6fwvsJQyToIuPx-K4D_-M4nTDpDsgDLXbbAE9jor9UV2GZL3jxLsccQ-G_BKhbEe6KulW90xAsIEsr4n92FsfyzOY0gJDcoek92kB44HLNA_GgaNYknlK2LY4qRfE-AYg9uCHzkrzc8AcuYLtuGilmztiy_Pgr5lrBIdQqz0UWQYzxHBl8actdOag0qEIPQt2-0K3IRhaAlxDr-6gIiigsKoiyGsD"
          />
          {/* Efecto de onda circular que se expande y desvanece */}
          <div className="loading-ping"></div>
        </div>

        {/* ─── Texto de estado y puntos animados ─── */}
        <div className="loading-text">
          {/* Mensaje de preparación inmersivo */}
          <h2>PREPARING FOR IMMERSION</h2>

          {/* ─── Puntos de carga animados ─── */}
          {/* Tres puntos que aparecen secuencialmente usando animation-delay.
              Cada punto tiene un retraso de 0.15s para crear un efecto
              de三点 de carga progresiva */}
          <div className="loading-dots">
            <div className="dot" style={{ animationDelay: '0s' }}></div>
            <div className="dot" style={{ animationDelay: '0.15s' }}></div>
            <div className="dot" style={{ animationDelay: '0.3s' }}></div>
          </div>
        </div>

      </div>
    </div>
  );
}
