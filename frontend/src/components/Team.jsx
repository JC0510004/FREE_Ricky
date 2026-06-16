import React, { useState } from 'react';

const members = [
  { name: 'Juan Carlos', role: 'Fundador & Desarrollador', emoji: '👨‍💻' },
  { name: 'María López', role: 'Artista Pixel', emoji: '🎨' },
  { name: 'Carlos Ruiz', role: 'Diseñador de Niveles', emoji: '🗺️' },
  { name: 'Ana García', role: 'Community Manager', emoji: '📢' },
];

function Team() {
  const [current, setCurrent] = useState(0);

  const next = () => setCurrent((prev) => (prev + 1) % members.length);
  const prev = () => setCurrent((prev) => (prev - 1 + members.length) % members.length);

  const member = members[current];

  return (
    <section id="team" className="team">
      <div className="team-container fade-up-element">
        <div className="team-left">
          <h2 className="team-title">Conoce al Equipo</h2>
          <div className="team-quote">
            <p>{'"Somos un grupo de apasionados por los videojuegos que decidió convertir su sueño en realidad."'}</p>
          </div>
          <div className="bomb-img" style={{ fontSize: '64px', textAlign: 'center' }}>💣</div>
        </div>
        <div className="team-right">
          <button className="carousel-button" onClick={prev} style={{ fontSize: '20px' }}>‹</button>
          <div className="team-card">
            <div className="team-image">
              <span className="team-img" style={{ fontSize: '64px' }}>{member.emoji}</span>
              <div className="team-image-gradient"></div>
            </div>
            <h3 className="team-member-name">{member.name}</h3>
            <p className="team-member-role">{member.role}</p>
            <p className="team-member-counter">{current + 1} / {members.length}</p>
          </div>
          <button className="carousel-button" onClick={next} style={{ fontSize: '20px' }}>›</button>
        </div>
      </div>
    </section>
  );
}

export default Team;
