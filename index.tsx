import {createRoot} from 'react-dom/client';
import './index.css';
import App from './src/App';

// Inject the playground preview flag BEFORE the application initializes
(window as any).__PLAYGROUND_PREVIEW__ = true;

const root = createRoot(document.getElementById('root')!);

root.render(
  <div
    style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
    }}>
    <App />
  </div>,
);
