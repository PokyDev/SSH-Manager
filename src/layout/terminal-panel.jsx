import React, { useRef, useCallback } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import './terminal-panel.css';

const TERMINAL_MIN_H = 36;
const TERMINAL_DEFAULT_H = 220;

export { TERMINAL_MIN_H, TERMINAL_DEFAULT_H };

export default function TerminalPanel({ isOpen, onToggle, height, onHeightChange }) {
  const startY = useRef(0);
  const startH = useRef(0);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    startY.current = e.clientY;
    startH.current = height;

    const onMove = (mv) => {
      const delta = startY.current - mv.clientY;
      const newH = Math.max(TERMINAL_MIN_H + 1, Math.min(startH.current + delta, window.innerHeight * 0.6));
      onHeightChange(newH);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [height, onHeightChange]);

  return (
    <div
      className="terminal-panel"
      style={{ height: isOpen ? height : TERMINAL_MIN_H }}
      aria-label="Panel de terminal"
    >
      {isOpen && (
        <div
          className="terminal-panel__resize"
          onMouseDown={onMouseDown}
          title="Arrastrar para redimensionar"
          aria-hidden="true"
        />
      )}

      <div className="terminal-panel__header">
        <div className="terminal-panel__header-left">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="terminal-panel__header-icon" aria-hidden="true">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span className="terminal-panel__header-title">Terminal</span>
          <span className="terminal-panel__header-badge">inactivo</span>
        </div>
        <button
          className="terminal-panel__toggle"
          onClick={onToggle}
          aria-label={isOpen ? 'Colapsar terminal' : 'Expandir terminal'}
        >
          {isOpen
            ? <ChevronDown size={13} strokeWidth={2} />
            : <ChevronUp size={13} strokeWidth={2} />
          }
        </button>
      </div>

      {isOpen && (
        <div className="terminal-panel__body">
          <p className="terminal-panel__placeholder">
            $ <span className="terminal-panel__cursor">▌</span>
          </p>
        </div>
      )}
    </div>
  );
}
