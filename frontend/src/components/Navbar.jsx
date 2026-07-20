import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`} id="mainNav">
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <img
            alt="S&T Logo"
            className="navbar-logo-img"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC17BH1mpOeKMSIFxD3LZsdwGZhMGfS5tj8ftfruK8TLrvjMxC6fwvsJQyToIuPx-K4D_-M4nTDpDsgDLXbbAE9jor9UV2GZL3jxLsccQ-G_BKhbEe6KulW90xAsIEsr4n92FsfyzOY0gJDcoek92kB44HLNA_GgaNYknlK2LY4qRfE-AYg9uCHzkrzc8AcuYLtuGilmztiy_Pgr5lrBIdQqz0UWQYzxHBl8actdOag0qEIPQt2-0K3IRhaAlxDr-6gIiigsKoiyGsD"
          />
          SALT BORN
        </Link>
        <div className="navbar-menu">
          <a className="navbar-link" href="#manifesto">HISTORIA</a>
          <a className="navbar-link" href="#news">ACTUALIZACIONES</a>
          <a className="navbar-link" href="#team">TRIPULACIÓN</a>
          <a className="navbar-link" href="#community">COMUNIDAD</a>
        </div>
        <div className="navbar-auth">
          <Link to="/login" className="navbar-link">INICIAR SESIÓN</Link>
          <Link to="/register" className="navbar-button">REGISTRARSE</Link>
        </div>
      </div>
    </nav>
  );
}
