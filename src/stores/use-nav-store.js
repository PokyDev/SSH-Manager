import { create } from 'zustand';

/*
  useNavStore — gestiona la vista activa de la aplicación.

  Vistas: 'landing' | 'dashboard'
  Fases:  'idle' | 'exit' | 'enter'

  Cualquier componente puede disparar navegación sin prop drilling.
*/

const FADE_DURATION = 380;

export const useNavStore = create((set, get) => ({
  view: 'landing',
  phase: 'idle',

  navigateTo: (target) => {
    const { view, phase } = get();
    if (view === target || phase !== 'idle') return;

    /* 1. Fase de salida */
    set({ phase: 'exit' });

    setTimeout(() => {
      /* 2. Cambiar vista + fase de entrada */
      set({ view: target, phase: 'enter' });

      setTimeout(() => {
        /* 3. Transición completa */
        set({ phase: 'idle' });
      }, FADE_DURATION);
    }, FADE_DURATION);
  },

  goToDashboard: () => get().navigateTo('dashboard'),
  goToLanding:   () => get().navigateTo('landing'),
}));