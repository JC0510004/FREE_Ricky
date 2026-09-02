// ─── TEAM - Carrusel de miembros del equipo ───
// Componente que muestra un carrusel interactivo con los miembros del equipo.
// Incluye navegación por botones y teclado, y cálculo dinámico de altura
// para evitar saltos de layout al cambiar entre descripciones de distinta longitud.

import { useState, useEffect, useRef } from 'react';

// ─── Datos de los miembros del equipo ───
// Array con información de cada miembro: nombre, rol, descripción e imagen.
// Las descripciones varían en longitud, lo que requiere cálculo de altura mínima.
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
  // ─── Estado del índice actual ───
  // Controla qué miembro del equipo se muestra en el carrusel (0-based index)
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0);

  // ─── Estado de visibilidad de la sección ───
  // Controla si la sección del equipo está visible en el viewport
  const [isInView, setIsInView] = useState(false);

  // ─── Referencia al elemento de descripción ───
  // Se usa para medir el texto y calcular la altura mínima necesaria
  const descriptionRef = useRef(null);

  // ─── Navegación hacia atrás ───
  // Retrocede al miembro anterior con wrap-around al final del array
  const handlePrev = () => {
    setCurrentMemberIndex((prev) => (prev - 1 + teamMembers.length) % teamMembers.length);
  };

  // ─── Navegación hacia adelante ───
  // Avanza al siguiente miembro con wrap-around al inicio del array
  const handleNext = () => {
    setCurrentMemberIndex((prev) => (prev + 1) % teamMembers.length);
  };

  // ─── Efecto de visibilidad con IntersectionObserver ───
  // Detecta si la sección del equipo está visible en el viewport.
  // Solo se activa la navegación por teclado cuando la sección es visible.
  useEffect(() => {
    const section = document.getElementById('team');
    if (!section) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // ─── Efecto de navegación por teclado ───
  // Permite usar las flechas izquierda/derecha para navegar el carrusel.
  // Solo responde cuando la sección del equipo está visible en el viewport.
  useEffect(() => {
    if (!isInView) return;
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isInView]);

  // ─── Efecto de cálculo de altura mínima ───
  // Mide todas las descripciones del equipo para establecer una altura mínima
  // en el contenedor de texto. Esto evita que el layout "salte" al cambiar
  // entre descripciones de diferente longitud.
  useEffect(() => {
    const updateTeamDescriptionMinHeight = () => {
      const descriptionEl = descriptionRef.current;
      if (!descriptionEl) return;

      // ─── Medición offscreen ───
      // Crea un elemento <p> oculto que replica las propiedades tipográficas
      // del elemento real para medir el alto de cada descripción sin mostrarlo
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

      // ─── Encontrar la altura máxima ───
      // Itera sobre todas las descripciones y guarda la mayor altura encontrada
      let maxHeight = 0;
      teamMembers.forEach((member) => {
        measurement.textContent = member.description;
        maxHeight = Math.max(maxHeight, measurement.scrollHeight);
      });

      // Limpia el elemento de medición y aplica la altura como CSS custom property
      document.body.removeChild(measurement);
      document.documentElement.style.setProperty('--team-description-min-height', `${maxHeight}px`);
    };

    // Ejecuta la medición inicial al montar el componente
    updateTeamDescriptionMinHeight();

    // ─── Recálculo en resize ───
    // Cuando la ventana cambia de tamaño, recalcula la altura mínima
    // Se usa debounce (150ms) para evitar cálculos excesivos durante el resize
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

  // ─── Miembro actual ───
  // Obtiene el objeto del miembro del equipo que se muestra actualmente
  const member = teamMembers[currentMemberIndex];

  return (
    <section className="team" id="team">

      {/* ─── Contenedor principal del equipo ─── */}
      {/* Layout de dos columnas: información a la izquierda, carrusel a la derecha */}
      <div className="team-container fade-up-element">

        {/* ─── Columna izquierda: información ─── */}
        <div className="team-left">

          {/* ─── Etiqueta de sección ─── */}
          <span className="section-label">NUESTRO EQUIPO</span>

          {/* ─── Título de sección ─── */}
          <h3 className="team-title">CONOCE A LA TRIPULACIÓN</h3>

          {/* ─── Contenedor de descripción del miembro ─── */}
          {/* ref se usa para medir el texto y calcular la altura mínima */}
          <div className="team-quote">
            <p ref={descriptionRef}>
              {/* Muestra la descripción del miembro actual */}
              {member.description}
            </p>
          </div>

          {/* ─── Imagen decorativa de bomba ─── */}
          {/* Imagen decorativa del lado izquierdo del carrusel */}
          {/* TODO: Replace with local asset: import bomb from '../../assets/bomb.png' */}
          <img
            alt="Bomb"
            className="bomb-img"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC17BH1mpOeKMSIFxD3LZsdwGZhMGfS5tj8ftfruK8TLrvjMxC6fwvsJQyToIuPx-K4D_-M4nTDpDsgDLXbbAE9jor9UV2GZL3jxLsccQ-G_BKhbEe6KulW90xAsIEsr4n92FsfyzOY0gJDcoek92kB44HLNA_GgaNYknlK2LY4qRfE-AYg9uCHzkrzc8AcuYLtuGilmztiy_Pgr5lrBIdQqz0UWQYzxHBl8actdOag0qEIPQt2-0K3IRhaAlxDr-6gIiigsKoiyGsD"
          />
        </div>

        {/* ─── Columna derecha: carrusel ─── */}
        <div className="team-right">

          {/* ─── Botón anterior ─── */}
          {/* Navega al miembro anterior del equipo */}
          <button type="button" className="carousel-button prev" id="team-prev-btn" onClick={handlePrev}>
            <span className="material-symbols-outlined">chevron_left</span>
          </button>

          {/* ─── Tarjeta del miembro actual ─── */}
          <div className="team-card">

            {/* ─── Imagen del miembro ─── */}
            {/* key fuerza un remount para reiniciar animaciones CSS de transición */}
            <div className="team-image">
              <img
                key={`img-${currentMemberIndex}`}
                alt="team-img"
                className="team-img"
                src={member.image}
              />
              {/* Gradiente superpuesto sobre la imagen para legibilidad del texto */}
              <div className="team-image-gradient"></div>
            </div>

            {/* ─── Nombre del miembro ─── */}
            {/* key fuerza re-render para animaciones de entrada */}
            <h4
              key={`name-${currentMemberIndex}`}
              className="team-member-name"
            >
              {member.name}
            </h4>

            {/* ─── Rol del miembro ─── */}
            <p className="team-member-role">
              {member.role}
            </p>

            {/* ─── Indicador de posición del carrusel ─── */}
            {/* Muestra el índice actual y el total de miembros (1-based) */}
            <div className="team-member-counter">
              <span>{currentMemberIndex + 1}</span> / <span>{teamMembers.length}</span>
            </div>

          </div>

          {/* ─── Botón siguiente ─── */}
          {/* Navega al siguiente miembro del equipo */}
          <button type="button" className="carousel-button next" id="team-next-btn" onClick={handleNext}>
            <span className="material-symbols-outlined">chevron_right</span>
          </button>

        </div>

      </div>
    </section>
  );
}
