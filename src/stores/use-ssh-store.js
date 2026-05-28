import { create } from 'zustand';

const TEST_STATUS = {
  IDLE: 'idle',
  TESTING: 'testing',
  SUCCESS: 'success',
  READY: 'ready',
  ERROR: 'error',
};

const STATUS_LABELS = {
  [TEST_STATUS.IDLE]: 'Sin verificar',
  [TEST_STATUS.TESTING]: 'Verificando...',
  [TEST_STATUS.SUCCESS]: 'Conexión Verificada',
  [TEST_STATUS.READY]: 'Ya puedes Conectarte',
  [TEST_STATUS.ERROR]: 'Sin conexión',
};

export { TEST_STATUS, STATUS_LABELS };

let _resetTimer = null;

function _clearResetTimer() {
  if (_resetTimer !== null) {
    clearTimeout(_resetTimer);
    _resetTimer = null;
  }
}

export const useSshStore = create((set) => ({
  testStatus: TEST_STATUS.IDLE,
  errorMessage: '',

  setTestStatus: (status) => set({ testStatus: status }),
  setErrorMessage: (msg) => set({ errorMessage: msg }),

  scheduleReady: () => {
    _clearResetTimer();
    _resetTimer = setTimeout(() => {
      set({ testStatus: TEST_STATUS.READY });
    }, 3000);
  },

  scheduleIdle: () => {
    _clearResetTimer();
    _resetTimer = setTimeout(() => {
      set({ testStatus: TEST_STATUS.IDLE, errorMessage: '' });
    }, 3000);
  },

  cancelScheduledReset: _clearResetTimer,
}));