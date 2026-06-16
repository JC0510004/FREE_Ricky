import React from 'react';

const newsItems = [
  {
    title: 'Nuevo Mundo Descubierto',
    text: 'Explora las Islas Malditas, un archipiélago lleno de peligros y tesoros sin precedentes. ¿Tienes lo que hay que tener para sobrevivir?',
    image: null,
    type: 'text',
  },
  {
    title: 'Multijugador en Camino',
    text: 'Prepárate para la batalla definitiva. El modo multijugador llegará en la próxima gran actualización con modos competitivos y cooperativos.',
    image: null,
    type: 'multiplayer',
  },
  {
    title: 'Beta Cerrada',
    text: 'Los primeros navegantes ya están probando Salt Born. Únete a la lista de espera para ser parte de la historia desde el principio.',
    image: null,
    type: 'text',
  },
];

function News() {
  return (
    <section id="news" className="news">
      <div className="section-header fade-up-element">
        <h2 className="section-title">Últimas Noticias</h2>
      </div>
      <div className="news-grid">
        {newsItems.map((item, i) => (
          <div key={i} className="news-card fade-up-element">
            <h3 className="news-title">{item.title}</h3>
            <p className="news-text">{item.text}</p>
            {item.type === 'multiplayer' && (
              <div className="news-multiplayer-card">
                <div style={{
                  width: '100%', height: '100%', background: 'linear-gradient(135deg, #0f436f, #022a45)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Space Grotesk', fontSize: '24px', color: 'var(--primary-color)',
                }}>
                  🎮 PRÓXIMAMENTE
                </div>
                <div className="news-image-bottom-gradient"></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default News;
