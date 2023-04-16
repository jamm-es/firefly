import React from 'react';
import ReactDOM from 'react-dom/client';
import Widget from './Widget';
import loadFont from "./load-font";

loadFont();

const widgetRoot = document.createElement('div');
document.body.appendChild(widgetRoot);
const root = ReactDOM.createRoot(widgetRoot);

root.render(
  <React.StrictMode>
    <Widget />
  </React.StrictMode>
);
