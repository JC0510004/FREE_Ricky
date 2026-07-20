import React from 'react';
import { Link } from 'react-router-dom';

export default function Community() {
  return (
    <section className="community" id="community">
      <div className="community-content fade-up-element">
        <span className="section-label">COMUNIDAD</span>
        <h3 className="community-title">¿CREES TENER MÁS SUERTE QUE ÉL??</h3>
        <Link to="/register" className="community-button">ÚNETE A LA TRIPULACIÓN</Link>
      </div>
    </section>
  );
}
