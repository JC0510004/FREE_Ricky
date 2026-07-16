import React, { useState, useEffect, useRef } from 'react';

const teamMembers = [
  {
    name: 'Marinero Valiente',
    role: 'Desarrollador Principal',
    description: 'Con años de experiencia navegando aguas turbulentas de código, este marinero es experto en construir sistemas robustos que pueden resistir cualquier tormenta digital.',
    image: 'source/img/team/BaldPirate.png'
  },
  {
    name: 'Bucanero Furioso',
    role: 'Artista de Gráficos',
    description: 'Especialista en crear mundos visuales impresionantes. Su pasión por los detalles y la creatividad sin límites hace que cada píxel cuente una historia.',
    image: 'source/img/team/bigGuy.png'
  },
  {
    name: 'Enemigo Misterioso',
    role: 'Diseñador de Mecánicas',
    description: 'Un personaje enigmático que desafía las convenciones. Sus ideas innovadoras empujan los límites de lo que es posible en el juego.',
    image: 'source/img/team/BombGuy.png'
  },
  {
    name: 'Navegante Sabio',
    role: 'Director de Producción',
    description: 'Guía la nave del proyecto a través de aguas desconocidas. Su sabiduría y experiencia mantienen al equipo enfocado en la visión final.',
    image: 'source/img/team/Captain.png'
  },
  {
    name: 'Capitán Ingeniero',
    role: 'Líder Técnico',
    description: 'Experto en resolver los problemas más complejos. Su arquitectura de código es tan sólida como una fortaleza pirata, resistiendo cualquier ataque.',
    image: 'source/img/team/Cucumber.png'
  },
  {
    name: 'Capitán Barba Gris',
    role: 'Director Creativo',
    description: 'Construir grandes equipos para lograr ideas desafiantes es lo que ama. Tuve la oportunidad de experimentarlo antes en mi vida, y ahora con una tripulación de increíbles bucaneros. Mis otras pasiones son pasar tiempo en el mar y jugar videojuegos retro (mucho).',
    image: 'source/img/team/While.png'
  }
];

export default function Team() {
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0);
  const descriptionRef = useRef(null);

  const handlePrev = () => {
    setCurrentMemberIndex((prev) => (prev - 1 + teamMembers.length) % teamMembers.length);
  };

  const handleNext = () => {
    setCurrentMemberIndex((prev) => (prev + 1) % teamMembers.length);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const updateTeamDescriptionMinHeight = () => {
      const descriptionEl = descriptionRef.current;
      if (!descriptionEl) return;

      const computedStyle = window.getComputedStyle(descriptionEl);
      const measurement = document.createElement('p');
      measurement.style.position = 'absolute';
      measurement.style.visibility = 'hidden';
      measurement.style.pointerEvents = 'none';
      measurement.style.width = `${descriptionEl.clientWidth}px`;
      measurement.style.fontFamily = computedStyle.fontFamily;
      measurement.style.fontSize = computedStyle.fontSize;
      measurement.style.lineHeight = computedStyle.lineHeight;
      measurement.style.fontStyle = computedStyle.fontStyle;
      measurement.style.whiteSpace = 'normal';
      measurement.style.margin = '0';
      measurement.style.padding = '0';
      measurement.style.letterSpacing = computedStyle.letterSpacing;
      document.body.appendChild(measurement);

      let maxHeight = 0;
      teamMembers.forEach((member) => {
        measurement.textContent = member.description;
        maxHeight = Math.max(maxHeight, measurement.scrollHeight);
      });

      document.body.removeChild(measurement);
      document.documentElement.style.setProperty('--team-description-min-height', `${maxHeight}px`);
    };

    // Run initial measurement
    updateTeamDescriptionMinHeight();

    // Recalculate max height of description text on resize
    let teamResizeTimeout = null;
    const handleResize = () => {
      clearTimeout(teamResizeTimeout);
      teamResizeTimeout = setTimeout(updateTeamDescriptionMinHeight, 150);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(teamResizeTimeout);
    };
  }, []);

  const member = teamMembers[currentMemberIndex];

  return (
    <section className="team" id="team">
      <div className="team-container fade-up-element">
        <div className="team-left">
          <span className="section-label">NUESTRO EQUIPO</span>
          <h3 className="team-title">CONOCE A LA TRIPULACIÓN</h3>
          <div className="team-quote">
            <p id="team-description" ref={descriptionRef}>
              {member.description}
            </p>
          </div>
          <img
            alt="Bomb"
            className="bomb-img"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC17BH1mpOeKMSIFxD3LZsdwGZhMGfS5tj8ftfruK8TLrvjMxC6fwvsJQyToIuPx-K4D_-M4nTDpDsgDLXbbAE9jor9UV2GZL3jxLsccQ-G_BKhbEe6KulW90xAsIEsr4n92FsfyzOY0gJDcoek92kB44HLNA_GgaNYknlK2LY4qRfE-AYg9uCHzkrzc8AcuYLtuGilmztiy_Pgr5lrBIdQqz0UWQYzxHBl8actdOag0qEIPQt2-0K3IRhaAlxDr-6gIiigsKoiyGsD"
          />
        </div>
        <div className="team-right">
          <button type="button" className="carousel-button prev" id="team-prev-btn" onClick={handlePrev}>
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <div className="team-card">
            <div className="team-image">
              <img
                key={`img-${currentMemberIndex}`}
                alt="team-img"
                className="team-img"
                id="team-img"
                src={member.image}
              />
              <div className="team-image-gradient"></div>
            </div>
            <h4
              key={`name-${currentMemberIndex}`}
              className="team-member-name"
              id="team-name"
            >
              {member.name}
            </h4>
            <p className="team-member-role" id="team-role">
              {member.role}
            </p>
            <div className="team-member-counter">
              <span id="team-current">{currentMemberIndex + 1}</span> / <span id="team-total">{teamMembers.length}</span>
            </div>
          </div>
          <button type="button" className="carousel-button next" id="team-next-btn" onClick={handleNext}>
            <span className="material-symbols-outlined">chevron_right</span>
          </button>
        </div>
      </div>
    </section>
  );
}
