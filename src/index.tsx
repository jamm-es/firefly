import React from 'react';
import ReactDOM from 'react-dom/client';
import Widget from './Widget';

const widgetRoot = document.createElement('div');
document.body.appendChild(widgetRoot);

const root = ReactDOM.createRoot(
  widgetRoot
);
root.render(
  <React.StrictMode>
    <Widget />
  </React.StrictMode>
);
