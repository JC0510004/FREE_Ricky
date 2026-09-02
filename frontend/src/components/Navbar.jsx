// ─── NAVBAR - Barra de navegación principal ───
// Componente que muestra la barra de navegación fija en la parte superior.
// Su contenido cambia según el estado de autenticación del usuario:
// - Visitantes: ven botones de "Iniciar Sesión" y "Registrarse"
// - Usuarios autenticados: ven su avatar, nombre de usuario y un menú desplegable
// - Admins: ven un enlace adicional a "Estadísticas" dentro del menú desplegable
// El menú desplegable se cierra automáticamente al hacer clic fuera de él.

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

export default function Navbar() {
  // ─── Estado de scroll ───
  // Controla si la página ha sido desplazada más de 50px hacia abajo.
  const [isScrolled, setIsScrolled] = useState(false);

  // ─── Estado del menú desplegable ───
  // Controla si el menú del usuario está abierto o cerrado.
  const [menuOpen, setMenuOpen] = useState(false);

  // ─── Referencia al contenedor del menú ───
  // Se usa para detectar clics fuera del menú y cerrarlo automáticamente.
  const menuRef = useRef(null);

  // ─── Hook de navegación ───
  const navigate = useNavigate();

  // ─── Datos del contexto de autenticación ───
  const { user, isAuthenticated, logout } = useAuth();

  // ─── Efecto de escucha de scroll ───
  // Registra un listener de scroll en la ventana para detectar la posición.
  // Se limpia al desmontar el componente para evitar memory leaks.
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

  // ─── Efecto de cierre del menú al hacer clic fuera ───
  // Detecta clics fuera del contenedor del menú para cerrarlo.
  // Esto permite que el usuario cierre el menú haciendo clic en cualquier otra parte.
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // ─── Cerrar el menú al navegar ───
  // Asegura que el menú se cierre cuando el usuario navega a otra página.
  const closeMenu = () => setMenuOpen(false);

  // ─── Manejador de cierre de sesión ───
  // Ejecuta el logout del contexto y redirige al landing page.
  const handleLogout = async () => {
    closeMenu();
    await logout();
    navigate('/');
  };

  // ─── Extrae la inicial del nombre de usuario ───
  // Se usa como avatar por defecto cuando no hay imagen de perfil.
  const userInitial = user?.username?.[0]?.toUpperCase() || '?';

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`} id="mainNav">
      <div className="navbar-container">

        {/* ─── Logo y nombre del sitio ─── */}
        {/* Link al home; incluye imagen SVG y texto del nombre del proyecto */}
        <Link to="/" className="navbar-logo">
          {/* TODO: Replace with local asset: import logo from '../../assets/logo.png' */}
          <img
            alt="S&T Logo"
            className="navbar-logo-img"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC17BH1mpOeKMSIFxD3LZsdwGZhMGfS5tj8ftfruK8TLrvjMxC6fwvsJQyToIuPx-K4D_-M4nTDpDsgDLXbbAE9jor9UV2GZL3jxLsccQ-G_BKhbEe6KulW90xAsIEsr4n92FsfyzOY0gJDcoek92kB44HLNA_GgaNYknlK2LY4qRfE-AYg9uCHzkrzc8AcuYLtuGilmztiy_Pgr5lrBIdQqz0UWQYzxHBl8actdOag0qEIPQt2-0K3IRhaAlxDr-6gIiigsKoiyGsD"
          />
          SALT BORN
        </Link>

        {/* ─── Menú de navegación principal ─── */}
        {/* Enlaces ancla que apuntan a secciones dentro de la landing page */}
        <div className="navbar-menu">
          <a className="navbar-link" href="#manifesto">HISTORIA</a>
          <a className="navbar-link" href="#news">ACTUALIZACIONES</a>
          <a className="navbar-link" href="#team">TRIPULACIÓN</a>
          <a className="navbar-link" href="#community">COMUNIDAD</a>
        </div>

        {/* ─── Sección de autenticación ─── */}
        {/* Muestra contenido diferente según si el usuario está autenticado */}
        <div className="navbar-auth">
          {isAuthenticated ? (
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="user-menu-trigger"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen}
                aria-label="Menú de usuario"
              >
                <div className="user-avatar">{userInitial}</div>
                <span className="user-name">{user.username}</span>
                <span className={`material-symbols-outlined user-chevron ${menuOpen ? 'open' : ''}`}>
                  expand_more
                </span>
              </button>

              {/* ─── Menú desplegable ─── */}
              {/* Se muestra solo cuando menuOpen es true */}
              {menuOpen && (
                <div className="dropdown-menu">
                  {/* Información del usuario en la cabecera del menú */}
                  <div className="dropdown-header">
                    <div className="user-avatar">{userInitial}</div>
                    <div className="dropdown-user-info">
                      <span className="dropdown-username">{user.username}</span>
                      <span className={`dropdown-role ${user.rol}`}>
                        {user.rol === 'admin' ? 'Administrador' : 'Jugador'}
                      </span>
                    </div>
                  </div>

                  {/* Separador visual */}
                  <div className="dropdown-divider" />

                  {/* Enlaces de navegación del menú */}
                  <Link to="/home" className="dropdown-item" onClick={closeMenu}>
                    <span className="material-symbols-outlined">sports_esports</span>
                    Dashboard
                  </Link>

                  <Link to="/settings" className="dropdown-item" onClick={closeMenu}>
                    <span className="material-symbols-outlined">settings</span>
                    Configuración
                  </Link>

                  {/* Enlace de admin: solo visible para usuarios con rol admin */}
                  {user?.rol === 'admin' && (
                    <Link to="/admin" className="dropdown-item dropdown-item-admin" onClick={closeMenu}>
                      <span className="material-symbols-outlined">analytics</span>
                      Estadísticas
                    </Link>
                  )}

                  {/* Separador visual */}
                  <div className="dropdown-divider" />

                  {/* Botón de cerrar sesión */}
                  <button type="button" className="dropdown-item dropdown-item-danger" onClick={handleLogout}>
                    <span className="material-symbols-outlined">logout</span>
                    Cerrar Sesión
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="navbar-link">INICIAR SESIÓN</Link>
              <Link to="/register" className="navbar-button">REGISTRARSE</Link>
            </>
          )}
        </div>

      </div>
    </nav>
  );
}
