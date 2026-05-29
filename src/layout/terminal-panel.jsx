import React, { useRef, useCallback, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTerminalStore, CONNECTION_STATE } from '../stores/use-terminal-store';
import AnsiText from '../utils/ansi-text';
import './terminal-panel.css';

export const TERMINAL_MIN_H = 36;
export const TERMINAL_DEFAULT_H = 220;

function renderLine(line, i) {
  switch (line.type) {
    case 'cmd':
      return (
        <div key={i} className="terminal-panel__line terminal-panel__line--cmd">
          <span className="terminal-panel__prompt">{line.prompt}&nbsp;</span>
          <span className="terminal-panel__command">{line.command}</span>
          {line.cursor && <span className="terminal-panel__cursor">▌</span>}
        </div>
      );

    case 'out':
      return (
        <div key={i} className="terminal-panel__line terminal-panel__line--out">
          {line.text}
        </div>
      );

    case 'ansi':
      return (
        <div key={i} className="terminal-panel__line terminal-panel__line--out">
          <AnsiText text={line.text} />
        </div>
      );

    case 'blank':
      return (
        <div key={i} className="terminal-panel__line terminal-panel__line--blank" />
      );

    case 'error':
      return (
        <div key={i} className="terminal-panel__line terminal-panel__line--error">
          {line.text}
        </div>
      );

    case 'idle':
      return (
        <div key={i} className="terminal-panel__line terminal-panel__line--idle">
          <span className="terminal-panel__prompt">{line.prompt}&nbsp;</span>
          <span className="terminal-panel__cursor">▌</span>
        </div>
      );

    default:
      return null;
  }
}

export default function TerminalPanel({ isOpen, onToggle, height, onHeightChange }) {
  const lines = useTerminalStore((s) => s.lines);
  const isActive = useTerminalStore((s) => s.isActive);
  const connectionState = useTerminalStore((s) => s.connectionState);
  const prompt = useTerminalStore((s) => s.prompt);

  const [inputValue, setInputValue] = useState('');

  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const inputRef = useRef(null);
  const dragState = useRef({ startY: 0, startH: 0, nextH: 0, rafId: 0 });

  const isConnected = connectionState === CONNECTION_STATE.CONNECTED;

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    if (isConnected && inputRef.current && isOpen) {
      inputRef.current.focus();
    }
  }, [isConnected, isOpen]);

  const handleCommandSubmit = useCallback(async (e) => {
    e.preventDefault();
    const command = inputValue.trim();
    const { addLine } = useTerminalStore.getState();

    addLine({ type: 'cmd', prompt, command, cursor: false });

    if (!command) {
      addLine({ type: 'blank' });
    }

    setInputValue('');

    if (command) {
      addLine({ type: 'error', text: 'Funcionalidad no implementada' });
    }
  }, [inputValue, prompt]);

  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);
  }, []);

  const handleBodyClick = useCallback(() => {
    if (isConnected && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isConnected]);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    const ds = dragState.current;
    ds.startY = e.clientY;
    ds.startH = height;
    ds.nextH = height;

    panelRef.current?.classList.add('terminal-panel--dragging');

    const onMove = (mv) => {
      const delta = ds.startY - mv.clientY;
      ds.nextH = Math.max(
        TERMINAL_MIN_H + 1,
        Math.min(ds.startH + delta, window.innerHeight * 0.6),
      );
      cancelAnimationFrame(ds.rafId);
      ds.rafId = requestAnimationFrame(() => onHeightChange(ds.nextH));
    };

    const onUp = () => {
      cancelAnimationFrame(ds.rafId);
      onHeightChange(ds.nextH);
      panelRef.current?.classList.remove('terminal-panel--dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [height, onHeightChange]);

  return (
    <div
      ref={panelRef}
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
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="terminal-panel__header-icon"
            aria-hidden="true"
          >
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span className="terminal-panel__header-title">Terminal</span>
          <span
            className={`terminal-panel__header-badge${
              isActive ? ' terminal-panel__header-badge--active' : ''
            }`}
          >
            {isActive ? 'activo' : 'inactivo'}
          </span>
        </div>

        <button
          className="terminal-panel__toggle"
          onClick={onToggle}
          aria-label={isOpen ? 'Colapsar terminal' : 'Expandir terminal'}
        >
          {isOpen
            ? <ChevronDown size={13} strokeWidth={2} />
            : <ChevronUp size={13} strokeWidth={2} />}
        </button>
      </div>

      {isOpen && (
        <div className="terminal-panel__body" ref={bodyRef} onClick={handleBodyClick}>
          {lines.length > 0 ? (
            lines.map(renderLine)
          ) : (
            <p className="terminal-panel__placeholder">
              $&nbsp;<span className="terminal-panel__cursor">▌</span>
            </p>
          )}

          {isConnected && (
            <form className="terminal-panel__input-row" onSubmit={handleCommandSubmit}>
              <span className="terminal-panel__prompt">{prompt}&nbsp;</span>
              <input
                ref={inputRef}
                type="text"
                className="terminal-panel__input"
                value={inputValue}
                onChange={handleInputChange}
                disabled={!isConnected}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
              />
            </form>
          )}
        </div>
      )}
    </div>
  );
}