// ─── HERO - Sección principal con efecto parallax ───
// Componente de pantalla completa que muestra una escena pirata animada.
// Incluye efecto parallax basado en el movimiento del mouse del usuario
// para crear sensación de profundidad con múltiples capas.

import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

export default function Hero() {
  // ─── Referencia al elemento sección ───
  // Se usa useRef para obtener acceso directo al DOM del <section>
  // y poder consultar sus hijos y observar su visibilidad en viewport
  const sectionRef = useRef(null);

  // ─── Efecto de parallax y animación ───
  // Configura el sistema completo de parallax: listeners de mouse,
  // animación por requestAnimationFrame, y optimización con IntersectionObserver
  useEffect(() => {
    // Referencia local a la sección para evitar lectures innecesarias del ref
    const section = sectionRef.current;
    if (!section) return;

    // Selecciona todas las capas parallax dentro de la sección
    // Cada capa tiene un data-speed que define cuánto se mueve relativamente
    const layers = section.querySelectorAll('.parallax-layer');
    if (layers.length === 0) return;

    // ─── Variables de interpolación del mouse ───
    // globalMouseX/Y: posición normalizada del mouse (-0.5 a 0.5)
    // currentX/Y: posición suavizada que se interpola hacia globalMouseX/Y
    let globalMouseX = 0;
    let globalMouseY = 0;
    let currentX = 0;
    let currentY = 0;

    // ─── Flags de control de animación ───
    // parallaxActive: indica si el parallax debe estar ejecutándose
    // isAnimating: indica si el loop de requestAnimationFrame está activo
    // rafId: referencia al ID del frame actual para poder cancelarlo
    let parallaxActive = true;
    let isAnimating = true;
    let rafId = null;

    // ─── Listener de movimiento del mouse ───
    // Convierte las coordenadas del mouse a un rango normalizado
    // centrado en 0 (0.5 del ancho/alto de pantalla = centro)
    const handlePointerMove = (e) => {
      globalMouseX = e.clientX / window.innerWidth - 0.5;
      globalMouseY = e.clientY / window.innerHeight - 0.5;
    };

    // ─── Listener de salida del mouse ───
    // Resetea las coordenadas a 0 cuando el mouse sale de la ventana,
    // causando que las capas vuelvan suavemente a su posición central
    const handleMouseLeave = () => {
      globalMouseX = 0;
      globalMouseY = 0;
    };

    // Se registran los listeners con passive para no bloquear el scroll
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    // ─── Bucle de animación por frame ───
    // Ejecuta la interpolación suave (lerp) y actualiza la posición
    // de cada capa parallax en cada frame del navegador
    const animateParallax = () => {
      // Si el parallax fue desactivado (fuera de viewport), detiene la animación
      if (!parallaxActive) {
        isAnimating = false;
        return;
      }

      // Interpolación lineal suave (lerp) con factor 0.05
      // Crea un efecto de movimiento fluido con "arrastre" en vez de movimiento instantáneo
      currentX += (globalMouseX - currentX) * 0.05;
      currentY += (globalMouseY - currentY) * 0.05;

      // ─── Aplicar transformación a cada capa ───
      layers.forEach((layer) => {
        // Lee el factor de velocidad desde el atributo data-speed del HTML
        // Capas con mayor speed se mueven más (efecto de profundidad)
        const speed = parseFloat(layer.dataset.speed) || 1;
        // Multiplica por constantes 75px (horizontal) y 50px (vertical)
        // para definir el rango máximo de movimiento en cada eje
        const x = currentX * speed * 75;
        const y = currentY * speed * 50;
        // Aplica la transformación CSS manteniendo el centrado base
        layer.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
      });

      // Programa el siguiente frame de animación
      rafId = requestAnimationFrame(animateParallax);
    };

    // Inicia el bucle de animación
    animateParallax();

    // ─── Optimización con IntersectionObserver ───
    // Pausa la animación cuando la sección no es visible en el viewport,
    // evitando consumo innecesario de CPU cuando el usuario scrollea lejos
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // La sección es visible: reactivar parallax si estaba pausado
            parallaxActive = true;
            if (!isAnimating) {
              isAnimating = true;
              animateParallax();
            }
          } else {
            // La sección no es visible: pausar animación
            parallaxActive = false;
          }
        });
      },
      { threshold: 0 }
    );

    observer.observe(section);

    // ─── Limpieza al desmontar ───
    // Elimina todos los event listeners, cancela frames pendientes,
    // desconecta el observer, y desactiva la animación
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
      parallaxActive = false;
    };
  }, []);

  return (
    <section className="parallax-hero" id="hero" ref={sectionRef}>

      {/* ─── Capa: Fondo ─── */}
      {/* Capa más lenta (speed 0.2) - se mueve muy poco para simular distancia */}
      <img
        src="source/img/gifs/background.png"
        className="parallax-layer parallax-bg"
        data-speed="0.2"
        alt="Background"
      />

      {/* ─── Capa: Sol ─── */}
      {/* Capa intermedia (speed 0.5) - movimiento moderado */}
      <img
        src="source/img/gifs/sol.png"
        className="parallax-layer parallax-sun"
        data-speed="0.5"
        alt="Sun"
      />

      {/* ─── Capa: Nubes ─── */}
      {/* Capa media (speed 1.0) - referencia base de movimiento */}
      <img
        src="source/img/gifs/nubes.png"
        className="parallax-layer parallax-clouds"
        data-speed="1"
        alt="Clouds"
      />

      {/* ─── Capa: Barco ─── */}
      {/* Capa rápida (speed 2.0) - se mueve el doble que las nubes */}
      <img
        src="source/img/gifs/barco.gif"
        className="parallax-layer parallax-boat"
        data-speed="2"
        alt="Boat"
      />

      {/* ─── Capa: Mar ─── */}
      {/* Capa más rápida (speed 3.0) - simula que está más cerca del espectador */}
      <img
        src="source/img/gifs/mar.gif"
        className="parallax-layer parallax-sea"
        data-speed="3"
        alt="Sea"
      />

      {/* ─── Contenido textual del Hero ─── */}
      {/* Se superpone sobre las capas parallax con posicionamiento absoluto */}
      <div className="hero-content">

        {/* ─── Título principal ─── */}
        {/* Lema del juego que comunica la temática de suerte y desventura */}
        <h1 className="hero-title">
          EL TESORO ESTÁ AHÍ.<br />
          LA SUERTE NO.
        </h1>

        {/* ─── Primera descripción de la trama ─── */}
        {/* Presenta al protagonista pirata y su mala fortuna */}
        <p className="hero-description">
          Durante años, un viejo pirata ha perseguido un tesoro perdido que nadie ha logrado encontrar.
          El problema es que la fortuna nunca estuvo de su lado: perdió un ojo, un pie y más barcos de los
          que puede recordar.
        </p>

        {/* ─── Segunda descripción de la trama ─── */}
        {/* Introduce el conflicto actual y los obstáculos del juego */}
        <p className="hero-description">
          Ahora ha encontrado la pista definitiva. Pero entre él y el tesoro se interponen trampas absurdas,
          plataformas engañosas y un mundo decidido a convertir cada paso en una nueva desgracia.
        </p>

        {/* ─── Botón de llamada a la acción ─── */}
        {/* Link al registro; es el punto de conversión principal del hero */}
        <div className="hero-buttons">
          <Link to="/register" className="hero-button">COMIENZA LA BÚSQUEDA</Link>
        </div>

      </div>
    </section>
  );
}
