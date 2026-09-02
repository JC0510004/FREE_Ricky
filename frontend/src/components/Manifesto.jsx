// ─── MANIFESTO - Sección de historia / lore del juego ───
// Componente que presenta la narrativa del juego: la historia del pirata
// y su búsqueda del tesoro. Incluye una galería de personajes animada.

export default function Manifesto() {
  return (
    <section className="manifesto fade-up-element" id="manifesto">

      {/* ─── Tarjeta contenedora del manifesto ─── */}
      {/* Card con borde superior decorativo y estilo premium */}
      <div className="manifesto-card">

        {/* ─── Barra decorativa superior ─── */}
        {/* Elemento visual que enmarca la tarjeta */}
        <div className="card-top-bar"></div>

        {/* ─── Encabezado de la sección ─── */}
        <div className="manifesto-header">
          {/* Etiqueta de tipo de contenido */}
          <span className="section-label">HISTORIA</span>
          {/* Título principal de la narrativa */}
          <h3 className="section-title">El Pirata Más Salado del Océano</h3>
        </div>

        {/* ─── Contenido narrativo ─── */}
        <div className="manifesto-content">

          {/* ─── Párrafo 1: Introducción del protagonista ─── */}
          {/* Establece al pirata como protagonista y su obsesión con el tesoro */}
          <p>
            Durante años, este viejo pirata ha perseguido un tesoro que muchos consideran un mito.
            Pero la suerte nunca estuvo de su lado.
          </p>

          {/* ─── Párrafo 2: Desarrollo de la trágica historia ─── */}
          {/* Detalla las desgracias del pirata y el giro narrativo de la pista encontrada */}
          <p>
            Entre expediciones fallidas, trampas mortales y accidentes absurdos,
            perdió un ojo y un pie sin acercarse un solo paso a su objetivo.
            Cuando todo parecía perdido, encontró una pista que podría conducirlo
            por fin al tesoro legendario.
          </p>

          {/* ─── Párrafo 3: Descripción de la experiencia de juego ─── */}
          {/* Comunica al jugador qué tipo de desafíos encontrará */}
          <p>
            El camino está repleto de trampas troll, secretos ocultos y desafíos diseñados
            para castigar hasta el más mínimo error. Cada plataforma puede ser una mentira y
            cada salto una nueva desgracia.
          </p>

        </div>

        {/* ─── Galería de personajes ─── */}
        {/* Muestra los sprites de los personajes del juego con animación escalonada.
            Cada imagen tiene un animationDelay diferente para crear un efecto
            secuencial de entrada. */}
        <div className="character-gallery">

          {/* TODO: Replace with local asset: import bucanero from '../../assets/bucanero.png' */}
          {/* Personaje principal: el pirata protagonista */}
          <img
            alt="Bucanero"
            className="character-img"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDItGEypVVUrP3ID83muuWdFj784cV0XVRHwEAsT1A7ndpoBaSB0L7WxmpHClE9BScLVa2nYkqQ5Qx8cbKsBtem2hCLXIC5hrVzTv-glwnfJWEpqN1F_jPeidTy-GoZfodwf9rzeRbkrVJq_Gb-_8x3wq-wg7nQw1v1PR-O6OUiUBlya0RrcRwv66CcwoqLgJ4wXlIOHI_KKqTGOtbvWQCGjO-uauYOegkIv_RgHH7WK0nq8Q7QEz2f9g87I0sAlUFEeBkLXgJ_sZ39"
            style={{ animationDelay: '0s' }}
          />

          {/* TODO: Replace with local asset: import enemigo from '../../assets/enemigo.png' */}
          {/* Enemigo: personaje antagonista */}
          <img
            alt="Enemigo 1"
            className="character-img"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAPQx6J9UjjdQhvOqNEcfeqfmG8TwUJNEVBHZHNtmrZ2Ly7DQbeEB6tC0a_0k-C5oxeplpKPTA1hS-r-lC1uRHOrYN40wXQlR9ByrtJeTL5mdOsUoEvRLIIeLXZuZKE_EhdnHCj1_Uh2IRTXHrFb2RrxsBgj3HkdOtYrJkMLbEcSzMsxW-WcYz1sH2fdzRAYRwNYEVMFvBsbvQ9i7lwzbDzu-Meensekc1GEmYQ9whL__08aXAfzm5H_UqCOSLyB3UkfrWohejY51D"
            style={{ animationDelay: '0.5s' }}
          />

          {/* TODO: Replace with local asset: import marinero from '../../assets/marinero.png' */}
          {/* Marinero: personaje aliado */}
          <img
            alt="Marinero"
            className="character-img"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA8sO3lyw8wj3-IUhj6DEAogWHOVXsiN5CW3oyfp3El2GFep9iJtuhLVzncLulvO4d35Ez6FGuZXfV0-D3J5XrOtbfwka1ei8XTaboVgeRV285o063knIw8LieLtaCzkdia-CwGRvhR8MiU62LrxWALFncvSU7SoR9xbxnz9e1oP5MtTHXNtMohVfOvzHqewdasiMaCXANQ4nlempEDRqf3b0abVGOaWsm-4p5R4AX7XFnXlvsslCHkQvpJYEWvSV62qftWdfndjpd6"
            style={{ animationDelay: '1s' }}
          />

        </div>

      </div>
    </section>
  );
}
