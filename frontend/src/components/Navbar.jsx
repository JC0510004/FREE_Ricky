import React, { useState, useEffect } from 'react';

function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <div className="navbar-container">
        <a href="/" className="navbar-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" style={{ imageRendering: 'pixelated' }}>
            <rect width="32" height="32" rx="4" fill="#0f436f" />
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="#ffb68c" fontFamily="JetBrains Mono" fontSize="18" fontWeight="700">SB</text>
          </svg>
          Salt Born
        </a>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <a href="#manifesto" className="navbar-link">Manifiesto</a>
          <a href="#news" className="navbar-link">Noticias</a>
          <a href="#team" className="navbar-link">Equipo</a>
          <button className="navbar-button">Iniciar Sesión</button>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
