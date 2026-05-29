import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';

// ── Mapeo del payload del backend al formato interno del store ────────────────
//
// El backend emite: { type: "out" | "error" | "blank", text?: string }
// El store maneja:  { type: "out" | "error" | "blank" | "cmd" | "idle" }
//
// "out", "error" y "blank" vienen exclusivamente del backend.
// "cmd" e "idle" los genera el frontend directamente via addLine().
//
// Nota: el backend usa exec (sin shell interactivo) para los comandos, por lo
// que nunca llegan líneas de prompt ni ecos de comandos. El mapeo es directo.

function backendLineToStoreLine(payload) {
  switch (payload.type) {
    case 'out':
      return { type: 'out', text: payload.text ?? '' };
    case 'error':
      return { type: 'error', text: payload.text ?? '' };
    case 'ansi':
      return { type: 'ansi', text: payload.text ?? '' };
    case 'blank':
      return { type: 'blank' };
    default:
      return { type: 'out', text: String(payload.text ?? '') };
  }
}

// ── Guarda contra doble registro del listener ─────────────────────────────────
//
// React StrictMode (desarrollo) monta → desmonta → monta de nuevo.
// Como `startListening` es async, la guarda síncrona `_isListening` no basta:
// stopListening() la resetea antes de que el primer `await listen()` resuelva,
// permitiendo que se registre un SEGUNDO listener y cada línea se duplique.
//
// Solución: contador de generación. Cada startListening incrementa la generación
// y captura su valor. Si al resolver el await la generación cambió (porque
// pasó un ciclo unmount/mount), el listener obsoleto se descarta de inmediato.

let _isListening = false;
let _generation = 0;

// ── Store ─────────────────────────────────────────────────────────────────────

export const useTerminalStore = create((set, get) => ({
  lines: [],
  isActive: false,
  openRequested: false,
  _unlisten: null,

  addLine: (line) => set((state) => ({ lines: [...state.lines, line] })),
  setActive: (active) => set({ isActive: active }),
  clearTerminal: () => set({ lines: [] }),
  requestOpen: () => set({ openRequested: true }),
  clearOpenRequest: () => set({ openRequested: false }),

  typeCommand: (prompt, command, speed = 30) => {
    return new Promise((resolve) => {
      const targetIndex = get().lines.length;
      set((state) => ({
        lines: [...state.lines, { type: 'cmd', prompt, command: '', cursor: true }],
      }));

      let charIndex = 0;
      const interval = setInterval(() => {
        charIndex++;
        if (charIndex > command.length) {
          clearInterval(interval);
          set((state) => {
            const lines = [...state.lines];
            if (lines[targetIndex]) {
              lines[targetIndex] = { ...lines[targetIndex], command, cursor: false };
            }
            return { lines };
          });
          resolve();
          return;
        }
        const currentCommand = command.slice(0, charIndex);
        set((state) => {
          const lines = [...state.lines];
          if (lines[targetIndex]) {
            lines[targetIndex] = { ...lines[targetIndex], command: currentCommand };
          }
          return { lines };
        });
      }, speed);
    });
  },

  // Suscribirse al evento `terminal:line` emitido por el backend.
  // Debe llamarse una sola vez al montar la app (desde App.jsx).
  startListening: async () => {
    if (_isListening) return;
    _isListening = true;
    const gen = ++_generation;

    try {
      const unlisten = await listen('terminal:line', (event) => {
        const line = backendLineToStoreLine(event.payload);
        set((state) => ({ lines: [...state.lines, line] }));
      });

      if (gen !== _generation) {
        unlisten();
        return;
      }

      set({ _unlisten: unlisten });
    } catch {
      if (gen === _generation) {
        _isListening = false;
      }
    }
  },

  // Liberar el listener (útil en hot-reload de desarrollo).
  stopListening: () => {
    _isListening = false;
    _generation++;
    const { _unlisten } = get();
    if (_unlisten) {
      _unlisten();
      set({ _unlisten: null });
    }
  },
}));