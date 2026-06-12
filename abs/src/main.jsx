import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';

// Gracefully intercept and suppress dev-only benign Vite/WebSocket rejections/errors 
// that arise due to sandboxed environment proxy limitations.
if (typeof window !== 'undefined') {
  const isWebsocketError = (message = '') => {
    const msg = String(message).toLowerCase();
    return (
      msg.includes('websocket') ||
      msg.includes('closed without opened') ||
      msg.includes('failed to connect') ||
      msg.includes('vite')
    );
  };

  window.addEventListener('error', (event) => {
    if (isWebsocketError(event.message) || (event.error && isWebsocketError(event.error.message))) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    if (isWebsocketError(message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

