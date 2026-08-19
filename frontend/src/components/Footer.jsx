// ─── FOOTER - Pie de página del sitio ───
// Componente estático que muestra el pie de página con enlaces legales,
// redes sociales y copyright. No tiene lógica de estado ni efectos.

import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">
        <Link to="/" className="footer-logo">SALT BORN</Link>

        <div className="footer-links">
          <a href="#news">Actualizaciones</a>
          <a href="#team">Tripulación</a>
          <span>© 2024, 1724 Studios</span>
          <a href="#community">Comunidad</a>
          <a href="#manifesto">Historia</a>
        </div>

        <div className="footer-socials">
          <a className="social-link" href="https://linkedin.com" target="_blank" rel="noopener noreferrer">In</a>
          <a className="social-link" href="https://x.com" target="_blank" rel="noopener noreferrer">X</a>
        </div>
      </div>
    </footer>
  );
}
