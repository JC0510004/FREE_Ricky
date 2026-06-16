import React, { useEffect, useRef } from 'react';
import heroBg from '../assets/hero.png';

function Hero() {
  const layersRef = useRef([]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      layersRef.current.forEach((layer, i) => {
        if (layer) {
          const speed = 0.1 + i * 0.1;
          layer.style.transform = `translate(-50%, calc(-50% + ${scrollY * speed}px))`;
        }
      });
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <section className="parallax-hero">
      <img
        ref={(el) => (layersRef.current[0] = el)}
        src={heroBg}
        alt="Fondo"
        className="parallax-layer parallax-bg"
      />
      <div className="parallax-layer parallax-sun" style={{ background: 'radial-gradient(circle, rgba(255,182,140,0.3) 0%, transparent 70%)', width: '60vw', height: '60vh', minWidth: 'auto', aspectRatio: 'auto' }} />
      <div className="parallax-layer parallax-clouds" style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(255,255,255,0.08) 0%, transparent 50%)', width: '100vw', height: '40vh', minWidth: 'auto', aspectRatio: 'auto' }} />
      <div className="parallax-layer parallax-sea" style={{ background: 'linear-gradient(to top, rgba(2,42,69,0.6) 0%, transparent 40%)', width: '110vw', height: '50vh', minWidth: 'auto', aspectRatio: 'auto', top: '70%' }} />
      <div className="hero-content">
        <h1 className="hero-title">Salt Born</h1>
        <p className="hero-description">
          Un desafiante plataformas pirata donde navegarás mares traicioneros,
          descubrirás tesoros ocultos y te convertirás en la leyenda más temida de los siete mares.
        </p>
        <button className="hero-button">Jugar Ahora</button>
      </div>
    </section>
  );
}

export default Hero;
