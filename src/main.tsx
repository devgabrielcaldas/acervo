import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import './styles/global.css';
import './styles/layout.css';
import './styles/storage.css';
import './styles/media.css';
import './styles/lists.css';
import './styles/statistics.css';
import './styles/refinements.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado no index.html.');

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary><BrowserRouter><App /></BrowserRouter></AppErrorBoundary>
  </StrictMode>,
);
import './styles/backup.css';
