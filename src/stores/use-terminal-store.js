import { create } from 'zustand';
import { listen } from '@tauri-apps/api/event';

// ── Mapeo del payload del backend al formato interno del store ────────────────
//
// El backend emite: { type: "out" | "error" | "blank", text?: string }
// El store maneja:  { type: "out" | "error" | "blank" | "cmd" | "idle", ... }
//
// Solo "out", "error" y "blank" vienen del backend; "cmd" e "idle" los genera
// el frontend directamente via addLine().

function backendLineToStoreLine(payload) {
  switch (payload.type) {
    case 'out':
      return { type: 'out', text: payload.text ?? '' };
    case 'error':
      return { type: 'error', text: payload.text ?? '' };
    case 'blank':
      return { type: 'blank' };
    default:
      return { type: 'out', text: String(payload.text ?? '') };
  }
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useTerminalStore = create((set, get) => ({
  lines: [],
  isActive: false,
  openRequested: false,

  // Listener de eventos Tauri — se inicializa una sola vez desde App.jsx
  _unlisten: null,

  addLine: (line) => set((state) => ({ lines: [...state.lines, line] })),
  setActive: (active) => set({ isActive: active }),
  clearTerminal: () => set({ lines: [] }),
  requestOpen: () => set({ openRequested: true }),
  clearOpenRequest: () => set({ openRequested: false }),

  // Suscribirse al evento `terminal:line` emitido por el backend.
  // Debe llamarse una sola vez al montar la app.
  startListening: async () => {
    // Evitar doble suscripción si el store ya tiene un listener activo
    if (get()._unlisten) return;

    const unlisten = await listen('terminal:line', (event) => {
      const line = backendLineToStoreLine(event.payload);
      set((state) => ({ lines: [...state.lines, line] }));
    });

    set({ _unlisten: unlisten });
  },

  // Liberar el listener (útil en hot-reload de desarrollo)
  stopListening: () => {
    const { _unlisten } = get();
    if (_unlisten) {
      _unlisten();
      set({ _unlisten: null });
    }
  },
}));