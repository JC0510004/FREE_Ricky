import React from 'react';

function Manifesto() {
  return (
    <section id="manifesto" className="manifesto">
      <div className="manifesto-card fade-up-element">
        <div className="card-top-bar"></div>
        <div className="manifesto-header">
          <h2 className="section-title">Nuestro Manifiesto</h2>
        </div>
        <div className="manifesto-content">
          <p>
            Salt Born nace de la pasión por los juegos de plataformas desafiantes.
            Creemos en la dificultad como maestra, en la exploración como recompensa
            y en la comunidad como el verdadero tesoro.
          </p>
          <p>
            Cada nivel es una isla por descubrir, cada enemigo un desafío por superar,
            cada muerte una lección aprendida. Nos inspiramos en los clásicos del género
            para crear una experiencia fresca, con mecánicas innovadoras y un estilo
            pixel-art que rinde homenaje a las leyendas que nos precedieron.
          </p>
        </div>
        <div className="character-gallery">
          {['🏴‍☠️', '⚓', '🗺️', '⚔️', '🏝️', '💀'].map((emoji, i) => (
            <span key={i} className="character-img" style={{ fontSize: '48px', lineHeight: 1, textAlign: 'center' }}>
              {emoji}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

export default Manifesto;
