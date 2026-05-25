import React, { useEffect, useRef, useState } from 'react';
import './slide-message.css';

/* ============================================================
   Definición de variantes de mensaje
   Escalar aquí para agregar nuevos tipos en el futuro.
   ============================================================ */
const MESSAGE_VARIANTS = {
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
        {/* Llave de código — evoca "funcionalidad pendiente" */}
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
const VALID_POSITIONS = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];

/* ============================================================
   Duración de las animaciones (debe coincidir con el CSS)
   ============================================================ */
const ANIMATION_DURATION_ENTER = 250; // ms — sm-enter-*
const ANIMATION_DURATION_EXIT  = 200; // ms — sm-exit-*

/* ============================================================
   SlideMessage
   ============================================================

   Props:
   ├── message  {string}  — Clave de variante: 'emptyState' (default)
   ├── text     {string}  — Texto personalizado; si no se pasa, usa
   │                        el texto por defecto de la variante
   ├── position {string}  — 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
   └── duration {number}  — Duración visible en ms antes de desaparecer (default: 2000)
*/
export default function SlideMessage({
  message  = 'emptyState',
  text,
  position = 'top-left',
  duration = 2000,
  onDone, 
}) {
  /* --- Validaciones de prop --- */
  const safePosition = VALID_POSITIONS.includes(position) ? position : 'top-left';
  const variant      = MESSAGE_VARIANTS[message] ?? MESSAGE_VARIANTS.emptyState;
  const displayText  = text ?? 'Funcionalidad en Desarrollo';

  /* --- Ciclo de vida de la animación --- */
  // 'entering' → 'visible' → 'exiting' → (desmontado externamente)
  const [animState, setAnimState] = useState('entering');
  const exitTimerRef = useRef(null);
  const exitAnimRef  = useRef(null);

  useEffect(() => {
    // Fase 1: después de la animación de entrada, pasar a visible
    const enterTimer = setTimeout(() => {
      setAnimState('visible');
    }, ANIMATION_DURATION_ENTER);

    // Fase 2: después de la duración visible, iniciar salida
    exitTimerRef.current = setTimeout(() => {
      setAnimState('exiting');

      // Avisar que el ciclo termino
      exitAnimRef.current = setTimeout(() => {
        onDone?.();
      }, ANIMATION_DURATION_EXIT);

      }, ANIMATION_DURATION_ENTER + duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimerRef.current);
      clearTimeout(exitAnimRef.current);
    };
  }, [duration]);

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
    <div className={rootClasses} role="status" aria-live="polite" aria-atomic="true">
      <div className={cardClasses}>

        {/* Ícono de la variante */}
        <div className="slide-message__icon" aria-hidden="true">
          {variant.icon}
        </div>

        {/* Cuerpo de texto */}
        <div className="slide-message__body">
          <span className="slide-message__label">{variant.label}</span>
          <span className="slide-message__text">{displayText}</span>
        </div>

        {/* Barra de progreso de duración */}
        <div className="slide-message__progress" aria-hidden="true">
          <div
            className="slide-message__progress-bar"
            style={{ animationDuration: `${duration}ms`, animationDelay: `${ANIMATION_DURATION_ENTER}ms` }}
          />
        </div>

      </div>
    </div>
  );
}