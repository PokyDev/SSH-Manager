import React, { useEffect, useRef, useState } from 'react';
import './slide-message-card.css';

/* ============================================================
   Definición de variantes de mensaje
   Escalar aquí para agregar nuevos tipos en el futuro.
   ============================================================ */
export const MESSAGE_VARIANTS = {
  emptyState: {
    modifier: 'empty-state',
    label: 'En Desarrollo',
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M5 2.5C3.5 2.5 2.5 3.5 2.5 5v1.5C2.5 7.3 2 8 1 8c1 0 1.5.7 1.5 1.5V11c0 1.5 1 2.5 2.5 2.5" />
        <path d="M11 2.5c1.5 0 2.5 1 2.5 2.5v1.5c0 .8.5 1.5 1.5 1.5-1 0-1.5.7-1.5 1.5V11c0 1.5-1 2.5-2.5 2.5" />
        <circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
};

/* ============================================================
   Posiciones válidas
   ============================================================ */
export const VALID_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/* ============================================================
   Duración de las animaciones (debe coincidir con el CSS)
   ============================================================ */
export const ANIMATION_DURATION_ENTER = 250; // ms
export const ANIMATION_DURATION_EXIT  = 200; // ms

/* ============================================================
   SlideMessageCard — componente visual puro
   ============================================================

   Props:
   ├── message  {string}  — Clave de variante: 'emptyState'
   ├── text     {string}  — Texto personalizado (opcional)
   ├── position {string}  — 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
   ├── duration {number}  — Duración visible en ms
   ├── offsetX  {number}  — Distancia en px al borde horizontal cercano (default: 20)
   ├── offsetY  {number}  — Distancia en px al borde vertical cercano (default: 20)
   └── onDone   {func}    — Callback al finalizar el ciclo completo de animación
*/
export default function SlideMessageCard({
  message  = 'emptyState',
  text,
  position = 'top-left',
  duration = 2000,
  offsetX  = 20,
  offsetY  = 20,
  onDone,
}) {
  const safePosition = VALID_POSITIONS.includes(position) ? position : 'top-left';
  const variant      = MESSAGE_VARIANTS[message] ?? MESSAGE_VARIANTS.emptyState;
  const displayText  = text ?? 'Funcionalidad en Desarrollo';

  /* --- Ciclo de vida: 'entering' → 'visible' → 'exiting' → onDone() --- */
  const [animState, setAnimState] = useState('entering');
  const exitTimerRef = useRef(null);
  const exitAnimRef  = useRef(null);

  useEffect(() => {
    const enterTimer = setTimeout(() => {
      setAnimState('visible');
    }, ANIMATION_DURATION_ENTER);

    exitTimerRef.current = setTimeout(() => {
      setAnimState('exiting');

      exitAnimRef.current = setTimeout(() => {
        onDone?.();
      }, ANIMATION_DURATION_EXIT);

    }, ANIMATION_DURATION_ENTER + duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimerRef.current);
      clearTimeout(exitAnimRef.current);
    };
  }, [duration, onDone]);

  /* --- Clases BEM compuestas --- */
  const rootClasses = [
    'slide-message',
    `slide-message--${safePosition}`,
    animState === 'entering' ? 'slide-message--entering' : '',
    animState === 'exiting'  ? 'slide-message--exiting'  : '',
  ]
    .filter(Boolean)
    .join(' ');

  const cardClasses = [
    'slide-message__card',
    `slide-message--${variant.modifier}`,
  ].join(' ');

  return (
    <div
      className={rootClasses}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={{
        '--sm-offset-x': `${offsetX}px`,
        '--sm-offset-y': `${offsetY}px`,
      }}
    >
      <div className={cardClasses}>

        <div className="slide-message__icon" aria-hidden="true">
          {variant.icon}
        </div>

        <div className="slide-message__body">
          <span className="slide-message__label">{variant.label}</span>
          <span className="slide-message__text">{displayText}</span>
        </div>

        <div className="slide-message__progress" aria-hidden="true">
          <div
            className="slide-message__progress-bar"
            style={{
              animationDuration: `${duration}ms`,
              animationDelay: `${ANIMATION_DURATION_ENTER}ms`,
            }}
          />
        </div>

      </div>
    </div>
  );
}