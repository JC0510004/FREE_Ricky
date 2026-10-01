// ─── COMPONENTE PRINCIPAL / LANDING PAGE ──────────────────────────────
// Este componente es la página de aterrizaje pública de la aplicación.
// Muestra la pantalla de carga inicial, la barra de navegación, secciones
// de contenido (hero, manifiesto, noticias, equipo, comunidad) y el pie
// de página. También gestiona las animaciones de entrada de elementos
// cuando el usuario hace scroll.

// ─── IMPORTACIONES DE REACT ───────────────────────────────────────────
// useState: hook para gestionar el estado local del componente
// useEffect: hook para ejecutar efectos secundarios (como el observer del scroll)
import { useState, useEffect } from 'react';

// ─── IMPORTACIONES DE COMPONENTES HIJOS ───────────────────────────────
// LoadingScreen: pantalla de carga animada que se muestra al inicio
import LoadingScreen from './components/LoadingScreen';
// Hero: sección principal de presentación con título y llamada a la acción
import Hero from './components/Hero';
// Manifesto: sección con el manifiesto/declaración de la organización
import Manifesto from './components/Manifesto';
// News: sección de noticias o novedades recientes
import News from './components/News';
// Team: sección que muestra los miembros del equipo
import Team from './components/Team';
// Community: sección de comunidad y redes sociales
import Community from './components/Community';
// Footer: pie de página con información de copyright y enlaces
import Footer from './components/Footer';
import Navbar from './components/Navbar';
import { useAuth } from './contexts/useAuth';

// ─── COMPONENTE APP ───────────────────────────────────────────────────
// Función principal que renderiza toda la landing page.
// Gestiona el estado de la pantalla de carga y las animaciones de scroll.
function App() {
  // Estado que controla si se muestra la pantalla de carga.
  // Inicia en true para que se muestre al cargar la aplicación.
  const [showLoading, setShowLoading] = useState(true);

  // ─── Datos del contexto de autenticación ───
  // Se usa para verificar si el usuario está autenticado y mostrar el botón de
  // descarga. También `user`, porque el botón de jugar exige correo verificado.
  const { isAuthenticated, user } = useAuth();

  // Para poder registrar una partida (jugar) el backend exige que el correo
  // esté verificado (permiso IsEmailVerified en backend/api/permissions.py).
  // Aquí solo se refleja ese estado para que el usuario entienda por qué el
  // botón está apagado: la regla que manda es la del backend, y esta condición
  // evita que se pulse un botón que va a fallar con un 403 sin explicación.
  const correoVerificado = Boolean(user?.is_verified);

  // ─── EFECTO DE ANIMACIONES DE SCROLL ──────────────────────────────
  // Se ejecuta cada vez que cambia showLoading para reconfigurar el observer
  // después de que la pantalla de carga desaparece y los elementos del DOM
  // están disponibles para ser observados.
  useEffect(() => {
    // Detectamos si el dispositivo es táctil (teléfono/tablet).
    // En dispositivos táctiles NO usamos IntersectionObserver porque
    // el comportamiento de scroll es diferente y puede causar problemas
    // con las animaciones al hacer scroll con el dedo.
    const isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;

    // Seleccionamos todos los elementos que tienen la clase CSS 'fade-up-element'.
    // Estos elementos están diseñados para animarse (aparecer deslizándose hacia arriba)
    // cuando entran en el viewport del usuario.
    const fadeElements = document.querySelectorAll('.fade-up-element');

    if (!isTouchDevice) {
      // ─── CONFIGURACIÓN DEL INTERSECTION OBSERVER (escritorio) ────
      // El IntersectionObserver detecta cuando un elemento entra o sale
      // del área visible del navegador (viewport). Lo usamos para
      // activar animaciones de entrada al hacer scroll.
      const observer = new IntersectionObserver(
        (entries) => {
          // Para cada elemento observado, verificamos si es visible
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // Cuando el elemento entra en el viewport, le agregamos la clase
              // 'is-visible' que activa la animación CSS de fade-up
              entry.target.classList.add('is-visible');
              // Dejamos de observar el elemento para que la animación
              // solo se ejecute una vez (no se repita al hacer scroll)
              observer.unobserve(entry.target);
            }
          });
        },
        {
          // threshold: 0.1 significa que la animación se activa cuando
          // el 10% del elemento es visible en el viewport
          threshold: 0.1,
          // rootMargin: '0px 0px -50px 0px' reduce el área de detección
          // 50px desde abajo, haciendo que la animación se active un poco
          // antes de que el elemento esté completamente visible
          rootMargin: '0px 0px -50px 0px',
        }
      );

      // Observamos cada elemento fade-up-element para detectar su visibilidad
      fadeElements.forEach((el) => observer.observe(el));

      // Cleanup: desconectamos el observer cuando el componente se desmonta
      // o cuando el efecto se vuelve a ejecutar, para evitar memory leaks
      return () => observer.disconnect();
    } else {
      // ─── DISPOSITIVOS TÁCTILES: MOSTRAR TODO DIRECTAMENTE ──────
      // En dispositivos táctiles, simplemente mostramos todos los elementos
      // sin animaciones de scroll, ya que el comportamiento de scroll
      // táctil puede hacer que las animaciones se activen de forma
      // inconsistente o problemática.
      fadeElements.forEach((el) => el.classList.add('is-visible'));
    }
  }, [showLoading]); // Se re-ejecuta cuando la pantalla de carga desmonta,
  // ya que los elementos fade-up-element recién están disponibles en el DOM

  // ─── RENDERIZADO DEL COMPONENTE ────────────────────────────────────
  // Estructura de la landing page: navbar arriba, contenido principal
  // en el medio, footer abajo, y la pantalla de carga como overlay.
  return (
    <>
      <Navbar />

      {/* Contenido principal de la página */}
      <main className="main-content">
        {/* Sección hero: presentación principal con imagen de fondo y título */}
        <Hero />

        {/* Sección de manifiesto: declaración de principios/valores */}
        <Manifesto />

        {/* Separador visual entre secciones: línea con diamante decorativo */}
        <div className="section-divider">
          <div className="diamond-separator"></div>
        </div>

        {/* Sección de noticias: publicaciones o actualizaciones recientes */}
        <News />

        {/* Otro separador visual entre secciones */}
        <div className="section-divider">
          <div className="diamond-separator"></div>
        </div>

        {/* Sección de equipo: muestra los miembros del equipo */}
        <Team />

        {/* Sección de comunidad: enlaces a redes sociales y recursos */}
        <Community />

        {/* ─── SECCIÓN DE JUGAR (solo usuarios autenticados) ─── */}
        {/* Se muestra la llamada a la acción solo cuando el usuario tiene
            sesión activa */}
        {isAuthenticated && (
          <section className="download-section">
            <div className="download-card">
              <div className="download-content">
                <h2 className="download-title">Juega Salt Born</h2>
                <p className="download-text">
                  Ya eres parte de la tripulación. Supera los niveles y compite en el ranking.
                </p>
                {/* El botón sigue deshabilitado, pero por un motivo distinto al
                    de antes. Ahora dice "Jugar" y no "Descargar" porque la regla
                    de negocio es jugar con el correo verificado: lo que se
                    comprueba al registrar una partida, no una descarga.
                    Sigue apagado porque el juego todavía no está publicado; en
                    cuanto haya ruta de juego, este es el sitio donde conectarla. */}
                <button
                  type="button"
                  className="download-btn"
                  disabled
                  title={correoVerificado
                    ? 'Próximamente disponible'
                    : 'Verifica tu correo electrónico para poder jugar'}
                >
                  <span className="material-symbols-outlined">play_arrow</span>
                  JUGAR
                </button>

                {/* Aviso explícito del correo sin verificar. Aparece solo en ese
                    caso, porque un `disabled` sin explicación (que era el
                    estado anterior) deja al usuario sin saber qué hacer ni
                    por qué. */}
                {!correoVerificado && (
                  <p className="download-text" style={{ marginTop: '16px' }}>
                    <strong>Verifica tu correo para poder jugar.</strong>{' '}
                    Te enviamos un correo al registrarte. Si no lo ves, revisa
                    la carpeta de spam o pídelo de nuevo desde tu perfil.
                  </p>
                )}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* Pie de página */}
      <Footer />

      {/* ─── PANTALLA DE CARGA ──────────────────────────────────── */}
      {/* Se muestra como overlay sobre todo el contenido mientras carga.
          Cuando termina su animación, llama a onFinished que pone
          showLoading en false, desmontando este componente. */}
      {showLoading && (
        <LoadingScreen onFinished={() => setShowLoading(false)} />
      )}
    </>
  );
}

export default App;
