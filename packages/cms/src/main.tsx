import React from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import { App } from './App';
import './styles.css';
import { bootstrapTheme } from './lib/dark-mode';

// Apply saved/system theme before first render to avoid flicker
bootstrapTheme();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
