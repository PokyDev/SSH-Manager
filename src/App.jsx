import React, { useEffect } from 'react';

import './styles/tokens.css';
import './styles/global.css';

import Titlebar from './layout/titlebar';
import Landing from './pages/landing';

/* ── Gestión de tema ── */
function applyTheme(theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  /* Activar transición suave antes de cambiar el tema */
  root.classList.add('theme-transitioning');

  root.setAttribute('data-theme', resolved);

  /* Desactivar transición al terminar */
  const ms = parseInt(getComputedStyle(root).getPropertyValue('--duration-slow')) || 350;
  setTimeout(() => root.classList.remove('theme-transitioning'), ms + 50);
}

function useTheme() {
  const [theme, setTheme] = React.useState(() => {
    return localStorage.getItem('dm-theme') || 'system';
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem('dm-theme', theme);
  }, [theme]);

  /* Responder a cambios del sistema cuando el tema es 'system' */
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const toggle = () => {
    setTheme((current) => {
      const root = document.documentElement;
      const currentActual = root.getAttribute('data-theme');
      return currentActual === 'dark' ? 'light' : 'dark';
    });
  };

  return { theme, toggle };
}

export default function App() {
  const { toggle } = useTheme();

  return (
    <>
      <Titlebar title="DeployMonitor" onThemeToggle={toggle} />
      <Landing />
    </>
  );
}