import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { initAnalytics } from './services/analytics';
import { initProgressSync } from './services/progress';
import './styles/global.css';

initAnalytics();
initProgressSync();

// Register the offline service worker in prod only. The SW precaches the
// /demo route + L6 assets so the JKPS Summer Fair build keeps working on
// patchy venue Wi-Fi. Dev still runs without a SW so HMR is unaffected.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] registration failed', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
