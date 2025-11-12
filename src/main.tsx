import React from 'react';
import ReactDOM from 'react-dom/client';
import { ErrorBoundary } from 'react-error-boundary';
import App from './App';
import { ErrorFallback } from './ErrorFallback';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()} // reload on retry
    >
      <App />
    </ErrorBoundary>
  </React.StrictMode>
