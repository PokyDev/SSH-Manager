import React from 'react';
import './titlebar.css';

import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindows = getCurrentWindow();

export default function Titlebar({ title = "Duck Manager" }) {

  const handleMinimize = () => appWindows.minimize();
  const handleMaximize = () => appWindows.toggleMaximize();
  const handleClose = () => appWindows.close();

  return (
    <nav className="titlebar" data-tauri-drag-region>

      <div className="titlebar__brand" data-tauri-drag-region>
        <img src="/svg/semaphore.svg" alt="Duck" className="titlebar__icon" />
        <span className="titlebar__title">{title}</span>
      </div>
      
      <div className="titlebar__controls">
        <button
          className="titlebar__btn titlebar__btn--minimize"
          onClick={handleMinimize}
          title="Minimizar"
          aria-label="Minimizar"
        >
          <svg width="10" height="1" viewBox="0 0 10 1">
            <rect width="10" height="1.5" rx="0.75" fill="currentColor" />
          </svg>
        </button>

        <button
          className="titlebar__btn titlebar__btn--maximize"
          onClick={handleMaximize}
          title="Maximizar"
          aria-label="Maximizar"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect
              x="1"
              y="1"
              width="8"
              height="8"
              rx="1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </button>

        <button
          className="titlebar__btn titlebar__btn--close"
          onClick={handleClose}
          title="Cerrar"
          aria-label="Cerrar"
        >
          <svg width="10" height="10" viewBox="0 0 10 10">
            <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </nav>
  );
}