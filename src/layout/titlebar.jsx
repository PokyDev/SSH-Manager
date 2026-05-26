import React from 'react';
import './titlebar.css';

import Semaphore from './components/semaphore';
import Controls from './components/controls';

export default function Titlebar({ onThemeToggle }) {
  return (
    <nav className="titlebar" data-tauri-drag-region>

      <div className="titlebar__left">
        <Semaphore />
        {/*
        <span className="titlebar__title" data-tauri-drag-region>
          Active
        </span>
        */}
      </div>

      <div className="titlebar__right">
        <Controls onThemeToggle={onThemeToggle} />
      </div>

    </nav>
  );
}