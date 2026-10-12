// ─── COMMUNITY - Sección de llamada a la comunidad ───
// Componente simple que invita al usuario a unirse a la comunidad del juego.
// Usa la clase 'fade-up-element' para animación de entrada al hacer scroll.

import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

export default function Community() {
  const { isAuthenticated, user } = useAuth();

  // Para poder jugar el backend exige el correo verificado (permiso
  // IsEmailVerified). Aquí solo se refleja para explicar por qué el botón
  // está apagado; la regla que manda es la del backend.
  const correoVerificado = Boolean(user?.is_verified);

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

        {/* ─── Llamada a la acción según la sesión ─── */}
        {/* Visitante sin sesión: invita a registrarse ('tripulación').
            Usuario con sesión: la misma zona pasa a ser el acceso al juego
            (bloque 'Juega Salt Born'), que antes vivía suelto en la landing. */}
        {isAuthenticated ? (
          <div className="download-card">
            <div className="download-content">
              <h2 className="download-title">Juega Salt Born</h2>
              <p className="download-text">
                Ya eres parte de la tripulación. Supera los niveles y compite en el ranking.
              </p>
              {correoVerificado ? (
                <Link to="/juego" className="download-btn">
                  <span className="material-symbols-outlined">play_arrow</span>
                  JUGAR
                </Link>
              ) : (
                <button
                  type="button"
                  className="download-btn"
                  disabled
                  title="Verifica tu correo electrónico para poder jugar"
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                  JUGAR
                </button>
              )}

              {/* Aviso explícito del correo sin verificar: un `disabled` sin
                  explicación deja al usuario sin saber qué hacer ni por qué. */}
              {!correoVerificado && (
                <p className="download-text" style={{ marginTop: '16px' }}>
                  <strong>Verifica tu correo para poder jugar.</strong>{' '}
                  Te enviamos un correo al registrarte. Si no lo ves, revisa
                  la carpeta de spam o pídelo de nuevo desde tu perfil.
                </p>
              )}
            </div>
          </div>
        ) : (
          <Link to="/register" className="community-button">ÚNETE A LA TRIPULACIÓN</Link>
        )}

      </div>
    </section>
  );
}
