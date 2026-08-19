// ─── FOOTER - Pie de página del sitio ───
// Componente estático que muestra el pie de página con enlaces legales,
// redes sociales y copyright. No tiene lógica de estado ni efectos.

import React from 'react';

export default function Footer() {
  return (
    <footer className="footer">

      {/* ─── Contenedor del footer ─── */}
      {/* Centra el contenido y organiza los enlaces en fila */}
      <div className="footer-container">

        {/* ─── Logo del footer ─── */}
        {/* Link al inicio con el nombre del proyecto */}
        <a className="footer-logo" href="#">SALT BORN</a>

        {/* ─── Enlaces legales e informativos ─── */}
        {/* Contiene enlaces a kit de prensa, PR, copyright y políticas */}
        <div className="footer-links">
          <a href="#">Kit de Prensa</a>
          <a href="#">Relaciones Públicas</a>
          {/* Copyright con el año de los estudios creadores */}
          <a href="#">© 2024, 1724 Studios</a>
          <a href="#">Privacidad</a>
          <a href="#">Términos</a>
        </div>

        {/* ─── Redes sociales ─── */}
        {/* Links a plataformas sociales: LinkedIn y X (Twitter) */}
        <div className="footer-socials">
          <a className="social-link" href="#">In</a>
          <a className="social-link" href="#">X</a>
        </div>

      </div>
    </footer>
  );
}
