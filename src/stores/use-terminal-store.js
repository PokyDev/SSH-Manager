import { create } from 'zustand';

export const useTerminalStore = create((set) => ({
  lines: [],
  isActive: false,
  openRequested: false,

  addLine: (line) => set((state) => ({ lines: [...state.lines, line] })),
  setActive: (active) => set({ isActive: active }),
  clearTerminal: () => set({ lines: [] }),
  requestOpen: () => set({ openRequested: true }),
  clearOpenRequest: () => set({ openRequested: false }),
}));