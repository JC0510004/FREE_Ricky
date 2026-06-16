import React from 'react';

export default function Manifesto() {
  return (
    <section className="manifesto fade-up-element" id="manifesto">
      <div className="manifesto-card">
        <div className="card-top-bar"></div>
        <div className="manifesto-header">
          <span className="section-label">HISTORIA</span>
          <h3 className="section-title">El Pirata Más Salado del Océano</h3>
        </div>
        <div className="manifesto-content">
          <p>
            Durante años, este viejo pirata ha perseguido un tesoro que muchos consideran un mito.
            Pero la suerte nunca estuvo de su lado.
          </p>
          <p>
            Entre expediciones fallidas, trampas mortales y accidentes absurdos,
            perdió un ojo y un pie sin acercarse un solo paso a su objetivo.
            Cuando todo parecía perdido, encontró una pista que podría conducirlo
            por fin al tesoro legendario.
          </p>
          <p>
            El camino está repleto de trampas troll, secretos ocultos y desafíos diseñados
            para castigar hasta el más mínimo error. Cada plataforma puede ser una mentira y
            cada salto una nueva desgracia.
          </p>
        </div>
        <div className="character-gallery">
          <img
            alt="Bucanero"
            className="character-img"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDItGEypVVUrP3ID83muuWdFj784cV0XVRHwEAsT1A7ndpoBaSB0L7WxmpHClE9BScLVa2nYkqQ5Qx8cbKsBtem2hCLXIC5hrVzTv-glwnfJWEpqN1F_jPeidTy-GoZfodwf9rzeRbkrVJq_Gb-_8x3wq-wg7nQw1v1PR-O6OUiUBlya0RrcRwv66CcwoqLgJ4wXlIOHI_KKqTGOtbvWQCGjO-uauYOegkIv_RgHH7WK0nq8Q7QEz2f9g87I0sAlUFEeBkLXgJ_sZ39"
            style={{ animationDelay: '0s' }}
          />
          <img
            alt="Enemigo 1"
            className="character-img"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAAPQx6J9UjjdQhvOqNEcfeqfmG8TwUJNEVBHZHNtmrZ2Ly7DQbeEB6tC0a_0k-C5oxeplpKPTA1hS-r-lC1uRHOrYN40wXQlR9ByrtJeTL5mdOsUoEvRLIIeLXZuZKE_EhdnHCj1_Uh2IRTXHrFb2RrxsBgj3HkdOtYrJkMLbEcSzMsxW-WcYz1sH2fdzRAYRwNYEVMFvBsbvQ9i7lwzbDzu-Meensekc1GEmYQ9whL__08aXAfzm5H_UqCOSLyB3UkfrWohejY51D"
            style={{ animationDelay: '0.5s' }}
          />
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
