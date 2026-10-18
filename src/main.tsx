import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import demo from '../data/demo.json';
import { App } from '@/ui/App';
import { DataProvider } from '@/ui/data/DataProvider';
import './index.css';

/** Reading `window.localStorage` can throw (blocked cookies, some private modes). */
function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const container = document.getElementById('root');
if (!container) throw new Error('index.html has no #root element.');

createRoot(container).render(
  <StrictMode>
    <DataProvider storage={browserStorage()} demo={demo}>
      <App />
    </DataProvider>
  </StrictMode>,
);
