import React, { useState, useEffect } from 'react';

export default function LoadingScreen({ onFinished }) {
  const [isHidden, setIsHidden] = useState(false);

  useEffect(() => {
    // Add scroll lock to body on mount
    document.body.classList.add('loading-lock');

    const fadeTimeout = setTimeout(() => {
      setIsHidden(true);
      document.body.classList.remove('loading-lock');
    }, 2500);

    const removeTimeout = setTimeout(() => {
      if (onFinished) {
        onFinished();
      }
    }, 3500);

    return () => {
      clearTimeout(fadeTimeout);
      clearTimeout(removeTimeout);
      document.body.classList.remove('loading-lock');
    };
  }, [onFinished]);

  return (
    <div className={`loading-screen ${isHidden ? 'hidden' : ''}`} id="loading-screen">
      <div className="loading-content">
        <div className="loading-logo-container">
          <img
            alt="Loading Anchor"
            className="loading-logo"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuC17BH1mpOeKMSIFxD3LZsdwGZhMGfS5tj8ftfruK8TLrvjMxC6fwvsJQyToIuPx-K4D_-M4nTDpDsgDLXbbAE9jor9UV2GZL3jxLsccQ-G_BKhbEe6KulW90xAsIEsr4n92FsfyzOY0gJDcoek92kB44HLNA_GgaNYknlK2LY4qRfE-AYg9uCHzkrzc8AcuYLtuGilmztiy_Pgr5lrBIdQqz0UWQYzxHBl8actdOag0qEIPQt2-0K3IRhaAlxDr-6gIiigsKoiyGsD"
          />
          <div className="loading-ping"></div>
        </div>
        <div className="loading-text">
          <h2>PREPARING FOR IMMERSION</h2>
          <div className="loading-dots">
            <div className="dot" style={{ animationDelay: '0s' }}></div>
            <div className="dot" style={{ animationDelay: '0.15s' }}></div>
            <div className="dot" style={{ animationDelay: '0.3s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
