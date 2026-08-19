// ─── COMMUNITY - Sección de llamada a la comunidad ───
// Componente simple que invita al usuario a unirse a la comunidad del juego.
// Usa la clase 'fade-up-element' para animación de entrada al hacer scroll.

import React from 'react';
import { Link } from 'react-router-dom';

export default function Community() {
  return (
    <section className="community" id="community">

      {/* ─── Contenido de la sección ─── */}
      {/* 'fade-up-element' activa una animación CSS que hace que el contenido
          aparezca deslizándose desde abajo cuando entra en el viewport */}
      <div className="community-content fade-up-element">

        {/* ─── Etiqueta de sección ─── */}
        {/* Indicador visual del tipo de contenido (estilo breadcrumb) */}
        <span className="section-label">COMUNIDAD</span>

        {/* ─── Título provocador ─── */}
        {/* Desafía al usuario para incentivar la participación */}
        <h3 className="community-title">¿CREES TENER MÁS SUERTE QUE ÉL??</h3>

        {/* ─── Botón de registro ─── */}
        {/* Link a la página de registro; usa el término temático 'tripulación' */}
        <Link to="/register" className="community-button">ÚNETE A LA TRIPULACIÓN</Link>

      </div>
    </section>
  );
}
