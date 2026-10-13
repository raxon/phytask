import React from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from './app/AppProviders';
import { App } from './app/App';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </React.StrictMode>,
);
