import React, { useRef, useCallback, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useTerminalStore } from '../stores/use-terminal-store';
import './terminal-panel.css';

const TERMINAL_MIN_H = 36;
const TERMINAL_DEFAULT_H = 220;

export { TERMINAL_MIN_H, TERMINAL_DEFAULT_H };

// ── Detector de líneas de prompt del servidor ─────────────────────────────────
//
// Con PTY real el servidor emite prompts como "ubuntu@ip-172-31-19-136:~$ "
// o "ubuntu@ip-172-31-19-136:~$ ls" (eco del comando con el prompt).
// Los detectamos para renderizarlos con el color correcto (prompt en cyan,
// comando en blanco), igual que vería el usuario en una terminal real.

const PROMPT_REGEX = /^([a-z_][\w-]*@[\w.\-]+:[~\w/]*)(\$|#)\s?(.*)$/;

function parseLine(line) {
  if (line.type !== 'out') return null;
  const match = PROMPT_REGEX.exec(line.text);
  if (!match) return null;
  return {
    host: match[1],   // "ubuntu@ip-172-31-19-136:~"
    sigil: match[2],  // "$" o "#"
    cmd: match[3],    // texto después del prompt (eco del comando)
  };
}

export default function TerminalPanel({ isOpen, onToggle, height, onHeightChange }) {
  const lines = useTerminalStore((s) => s.lines);
  const isActive = useTerminalStore((s) => s.isActive);
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const startY = useRef(0);
  const startH = useRef(0);
  const rafId = useRef(0);
  const nextH = useRef(0);

  // Auto-scroll al fondo cuando llegan nuevas líneas
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines]);

  // ── Drag para redimensionar ───────────────────────────────────────────────

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    startY.current = e.clientY;
    startH.current = height;
    nextH.current = height;

    panelRef.current?.classList.add('terminal-panel--dragging');

    const onMove = (mv) => {
      const delta = startY.current - mv.clientY;
      nextH.current = Math.max(
        TERMINAL_MIN_H + 1,
        Math.min(startH.current + delta, window.innerHeight * 0.6),
      );
      cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => onHeightChange(nextH.current));
    };

    const onUp = () => {
      cancelAnimationFrame(rafId.current);
      onHeightChange(nextH.current);
      panelRef.current?.classList.remove('terminal-panel--dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [height, onHeightChange]);

  // ── Renderizado de líneas ─────────────────────────────────────────────────

  const renderLine = (line, i) => {
    switch (line.type) {
      case 'cmd':
        // Línea cosmética generada por el frontend (Windows CMD)
        return (
          <div key={i} className="terminal-panel__line terminal-panel__line--cmd">
            <span className="terminal-panel__prompt">{line.prompt}&nbsp;</span>
            <span className="terminal-panel__command">{line.command}</span>
          </div>
        );

      case 'out': {
        // Detectar si es una línea de prompt del servidor SSH (con PTY)
        const parsed = parseLine(line);
        if (parsed) {
          return (
            <div key={i} className="terminal-panel__line terminal-panel__line--cmd">
              <span className="terminal-panel__prompt">
                {parsed.host}{parsed.sigil}&nbsp;
              </span>
              {parsed.cmd && (
                <span className="terminal-panel__command">{parsed.cmd}</span>
              )}
            </div>
          );
        }
        return (
          <div key={i} className="terminal-panel__line terminal-panel__line--out">
            {line.text}
          </div>
        );
      }

      case 'blank':
        return <div key={i} className="terminal-panel__line terminal-panel__line--blank" />;

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
  };

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
            : <ChevronUp size={13} strokeWidth={2} />
          }
        </button>
      </div>

      {isOpen && (
        <div className="terminal-panel__body" ref={bodyRef}>
          {lines.length > 0 ? (
            lines.map(renderLine)
          ) : (
            <p className="terminal-panel__placeholder">
              $&nbsp;<span className="terminal-panel__cursor">▌</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}