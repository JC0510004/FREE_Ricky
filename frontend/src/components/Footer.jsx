import React from 'react';

function Footer() {
  const socials = ['𝕏', '▶', '💬', '📄'];
  const links = ['Inicio', 'Manifiesto', 'Noticias', 'Equipo', 'Contacto'];

  return (
    <footer className="footer">
      <div className="footer-container">
        <a href="/" className="footer-logo">Salt Born</a>
        <div className="footer-links">
          {links.map((link, i) => (
            <a key={i} href={`#${link.toLowerCase()}`}>{link}</a>
          ))}
        </div>
        <div className="footer-socials">
          {socials.map((s, i) => (
            <a key={i} href="#" className="social-link">{s}</a>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default Footer;
