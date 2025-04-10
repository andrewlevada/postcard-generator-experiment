import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const container = document.getElementById('react-page');
if (container) {
  const root = createRoot(container);
  root.render(
    <App
      onSubmit={async (header) => {
        // Send message to the plugin code
        parent.postMessage({ pluginMessage: { type: 'create-postcard', header } }, '*');
      }}
    />
  );
} 