import React, { useEffect, useState } from 'react';

function LoadingScreen({ onFinished }) {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    document.body.classList.add('loading-lock');
    const timer = setTimeout(() => {
      setHidden(true);
      document.body.classList.remove('loading-lock');
      setTimeout(onFinished, 1000);
    }, 2500);
    return () => {
      clearTimeout(timer);
      document.body.classList.remove('loading-lock');
    };
  }, [onFinished]);

  return (
    <div className={`loading-screen${hidden ? ' hidden' : ''}`}>
      <div className="loading-content">
        <div className="loading-logo-container">
          <div className="loading-ping"></div>
          <svg className="loading-logo" width="160" height="160" viewBox="0 0 160 160" fill="none">
            <rect width="160" height="160" rx="16" fill="#0f436f" />
            <text x="50%" y="55%" dominantBaseline="middle" textAnchor="middle" fill="#ffb68c" fontFamily="JetBrains Mono" fontSize="64" fontWeight="700">SB</text>
          </svg>
        </div>
        <div className="loading-text">
          <h2>Salt Born</h2>
          <div className="loading-dots">
            <div className="dot" style={{ animationDelay: '0s' }}></div>
            <div className="dot" style={{ animationDelay: '0.2s' }}></div>
            <div className="dot" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoadingScreen;
