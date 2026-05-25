import React from 'react';
import './titlebar.css';

import Semaphore from './components/semaphore';
import Controls from './components/controls';

export default function Titlebar({ title = "Duck Manager" }) {
  return (
    <nav className="titlebar" data-tauri-drag-region>

      <div className="titlebar__left">
        <Semaphore />
      </div>

      <div className="titlebar__center" data-tauri-drag-region>
        <span className="titlebar__title" data-tauri-drag-region>{title}</span>
      </div>

      <div className="titlebar__right">
        <Controls />
      </div>
    </nav>
  );
}