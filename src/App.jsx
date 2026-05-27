import React, { useEffect } from 'react';

import './styles/tokens.css';
import './styles/global.css';

import Titlebar from './layout/titlebar';
import Landing from './pages/landing';
import Dashboard from './pages/dashboard';
import { useNavStore } from './stores/use-nav-store';

/* ── Gestión de tema ── */
function applyTheme(theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme;

  root.classList.add('theme-transitioning');
  root.setAttribute('data-theme', resolved);

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

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const toggle = () => {
    setTheme(() => {
      const currentActual = document.documentElement.getAttribute('data-theme');
      return currentActual === 'dark' ? 'light' : 'dark';
    });
  };

  return { theme, toggle };
}

export default function App() {
  const { toggle } = useTheme();
  const { view, phase } = useNavStore();

  const transitionClass =
    phase === 'exit'  ? 'view-exit'  :
    phase === 'enter' ? 'view-enter' :
    '';

  return (
    <>
      <Titlebar title="DeployMonitor" onThemeToggle={toggle} />

      <div className={`view-wrapper ${transitionClass}`}>
        {view === 'landing'   && <Landing />}
        {view === 'dashboard' && <Dashboard />}
      </div>
    </>
  );
}