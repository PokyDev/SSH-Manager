import { create } from 'zustand';

let _resetTimer = null;

function _clearResetTimer() {
  if (_resetTimer !== null) {
    clearTimeout(_resetTimer);
    _resetTimer = null;
  }
}

export const CONNECTION_STATE = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
};

export const useTerminalStore = create((set, get) => ({
  lines: [],
  isActive: false,
  connectionState: CONNECTION_STATE.DISCONNECTED,
  prompt: '',
  openRequested: false,

  addLine: (line) => set((state) => ({ lines: [...state.lines, line] })),
  setActive: (active) => set({ isActive: active }),
  setConnectionState: (state) => set({ connectionState: state }),
  setPrompt: (prompt) => set({ prompt }),
  clearTerminal: () => set({ lines: [] }),
  requestOpen: () => set({ openRequested: true }),
  clearOpenRequest: () => set({ openRequested: false }),

  get isInputEnabled() {
    return get().connectionState === CONNECTION_STATE.CONNECTED;
  },

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

  startListening: () => {},
  stopListening: () => {},
}));