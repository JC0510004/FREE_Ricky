// ─── NEWS - Sección de noticias y actualizaciones ───
// Componente que muestra las últimas noticias del juego en formato de tarjetas.
// Incluye tanto imágenes estáticas como GIFs animados.

import React from 'react';

export default function News() {
  return (
    <section className="news" id="news">

      {/* ─── Encabezado de la sección ─── */}
      <div className="section-header">
        <span className="section-label">NOTICIAS</span>
      </div>

      {/* ─── Grid de noticias ─── */}
      {/* 'fade-up-element' activa animación de entrada al hacer scroll */}
      <div className="news-grid fade-up-element">

        {/* ─── Noticia 1: Mapa del tesoro ─── */}
        {/* Tarjeta con imagen estática y overlay oscuro para legibilidad */}
        <div className="news-card">
          <h3 className="news-title">EL MAPA DEL TESORO ESTÁ COMPLETO</h3>
          <p className="news-text">
            La última pieza del mapa ha sido descubierta.
            La ruta hacia el tesoro está definida, pero los peligros que la protegen
            son más mortales que nunca.
          </p>
          <div className="news-image">
            <img
              alt="Playtest Screenshot"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC4rzSeG3GMy0ZPIdq2aT3LxzTR_MqhA_8NeEXTVq5r2Ow7tioyXNE7JxwgTTIXYjTJQXoGpIv-ujQFQcnhtZP42ox8VUB0U4jUO7pPOfTGP-xWXOaTl7166KzOx8cLyUqg1KgqpRDVj-pu6nQau1lLZx4sDXr_cHIGVLlFGDBptvQ6w_DV42DQG7xkHTXnwcqD9rG36ol0mqtAOutzy2irMN5I_u_nkFvMbr1vpHnzA9kXRRMh34Djxu9q-FhyzSNqtb9qNnpYKl_T"
            />
            {/* Overlay con gradiente para mejorar contraste del texto sobre la imagen */}
            <div className="news-image-overlay"></div>
          </div>
        </div>

        {/* ─── Noticia 2: Multijugador ─── */}
        {/* Tarjeta con GIF animado que muestra gameplay multijugador */}
        <div className="news-card">
          <h3 className="news-title">PRESENTANDO EL GALEÓN MULTIJUGADOR</h3>
          <p className="news-text">
            La nueva actualización trae caos cooperativo. Únete junto a tu compañero de tripulación para ser protagonistas de un caotico y explosivo entorno de pelea en el que podran enfrentarse.
          </p>
          <div className="news-multiplayer-card">
            <img
              alt="multiplayerGif"
              src="https://img.itch.zone/aW1nLzI1NzYzMjMuZ2lm/original/7vteNk.gif"
            />
            {/* Gradiente inferior para suavizar la transición del GIF */}
            <div className="news-image-bottom-gradient"></div>
          </div>
        </div>

      </div>
    </section>
  );
}
