import React, { useState, useEffect } from 'react';
import LoadingScreen from './components/LoadingScreen';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Manifesto from './components/Manifesto';
import News from './components/News';
import Team from './components/Team';
import Community from './components/Community';
import Footer from './components/Footer';

function App() {
  const [showLoading, setShowLoading] = useState(true);

  useEffect(() => {
    const isTouchDevice =
      'ontouchstart' in window ||
      navigator.maxTouchPoints > 0;

    const fadeElements = document.querySelectorAll('.fade-up-element');

    if (!isTouchDevice) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              observer.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.1,
          rootMargin: '0px 0px -50px 0px',
        }
      );

      fadeElements.forEach((el) => observer.observe(el));

      return () => observer.disconnect();
    } else {
      fadeElements.forEach((el) => el.classList.add('is-visible'));
    }
  }, [showLoading]);

  return (
    <>
      <Navbar />
      <main className="main-content">
        <Hero />
        <Manifesto />
        <div className="section-divider">
          <div className="diamond-separator"></div>
        </div>
        <News />
        <div className="section-divider">
          <div className="diamond-separator"></div>
        </div>
        <Team />
        <Community />
      </main>
      <Footer />
      {showLoading && (
        <LoadingScreen onFinished={() => setShowLoading(false)} />
      )}
    </>
  );
}

export default App;
