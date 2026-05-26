import { useSlideMessage } from '@poky-dev/slide-message';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './controls.css';

const appWindow = getCurrentWindow();

export default function Controls() {
  const { notify } = useSlideMessage();

  return (
    <div className="controls">
      <button
        className="controls__btn controls__btn--theme"
        title="Tema"
        aria-label="Tema"
        onClick={() => notify({ position: 'top-right', offsetY: 56 })}
      >
        <svg width="14" height="14" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="3.5" fill="currentColor" />
          <line x1="8" y1="0.5" x2="8" y2="3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="8" y1="13" x2="8" y2="15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="0.5" y1="8" x2="3" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="13" y1="8" x2="15.5" y2="8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="2.7" y1="2.7" x2="4.5" y2="4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="11.5" y1="11.5" x2="13.3" y2="13.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="2.7" y1="13.3" x2="4.5" y2="11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="11.5" y1="4.5" x2="13.3" y2="2.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <button
        className="controls__btn controls__btn--minimize"
        onClick={() => appWindow.minimize()}
        title="Minimizar"
        aria-label="Minimizar"
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1.5" rx="0.75" fill="currentColor" />
        </svg>
      </button>

      <button
        className="controls__btn controls__btn--maximize"
        onClick={() => appWindow.toggleMaximize()}
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
        className="controls__btn controls__btn--close"
        onClick={() => appWindow.close()}
        title="Cerrar"
        aria-label="Cerrar"
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}