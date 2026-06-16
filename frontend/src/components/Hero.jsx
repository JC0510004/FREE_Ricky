import React, { useEffect, useRef } from 'react';

export default function Hero() {
  const sectionRef = useRef(null);

  useEffect(() => {
    const handlePointerMove = (e) => {
      globalMouseX = e.clientX / window.innerWidth - 0.5;
      globalMouseY = e.clientY / window.innerHeight - 0.5;
    };

    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });

    const section = sectionRef.current;
    if (!section) return;

    const layers = section.querySelectorAll('.parallax-layer');
    if (layers.length === 0) return;

    let globalMouseX = 0;
    let globalMouseY = 0;
    let currentX = 0;
    let currentY = 0;

    // Start active by default to prevent timing issues with CSS injection and initial observer callback
    let parallaxActive = true;
    let isAnimating = true;

    const handleMouseMove = (e) => {
      globalMouseX = e.clientX / window.innerWidth - 0.5;
      globalMouseY = e.clientY / window.innerHeight - 0.5;
    };

    const handleMouseLeave = () => {
      globalMouseX = 0;
      globalMouseY = 0;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    const animateParallax = () => {
      if (!parallaxActive) {
        isAnimating = false;
        return;
      }

      currentX += (globalMouseX - currentX) * 0.05;
      currentY += (globalMouseY - currentY) * 0.05;

      layers.forEach((layer) => {
        const speed = parseFloat(layer.dataset.speed) || 1;
        const x = currentX * speed * 75;
        const y = currentY * speed * 50;
        layer.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
        console.log(layer.className, x, y);
      });

      requestAnimationFrame(animateParallax);
    };

    // Run the animation loop immediately on mount
    animateParallax();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            parallaxActive = true;
            if (!isAnimating) {
              isAnimating = true;
              animateParallax();
            }
          } else {
            parallaxActive = false;
          }
        });
      },
      { threshold: 0 }
    );

    observer.observe(section);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      observer.disconnect();
      parallaxActive = false;
    };
  }, []);

  return (
    <section className="parallax-hero" id="hero" ref={sectionRef}>
      <img
        src="source/img/gifs/background.png"
        className="parallax-layer parallax-bg"
        data-speed="0.2"
        alt="Background"
      />
      <img
        src="source/img/gifs/sol.png"
        className="parallax-layer parallax-sun"
        data-speed="0.5"
        alt="Sun"
      />
      <img
        src="source/img/gifs/nubes.png"
        className="parallax-layer parallax-clouds"
        data-speed="1"
        alt="Clouds"
      />
      <img
        src="source/img/gifs/barco.gif"
        className="parallax-layer parallax-boat"
        data-speed="2"
        alt="Boat"
      />
      <img
        src="source/img/gifs/mar.gif"
        className="parallax-layer parallax-sea"
        data-speed="3"
        alt="Sea"
      />

      <div className="hero-content">
        <h1 className="hero-title">
          EL TESORO ESTÁ AHÍ.<br />
          LA SUERTE NO.
        </h1>
        <p className="hero-description">
          Durante años, un viejo pirata ha perseguido un tesoro perdido que nadie ha logrado encontrar.
          El problema es que la fortuna nunca estuvo de su lado: perdió un ojo, un pie y más barcos de los
          que puede recordar.
        </p>
        <p className="hero-description">
          Ahora ha encontrado la pista definitiva. Pero entre él y el tesoro se interponen trampas absurdas,
          plataformas engañosas y un mundo decidido a convertir cada paso en una nueva desgracia.
        </p>
        <div className="hero-buttons">
          <button className="hero-button">COMIENZA LA BÚSQUEDA</button>
        </div>
      </div>
    </section>
  );
}
