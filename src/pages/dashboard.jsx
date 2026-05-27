import React, { useState, useRef, useCallback } from 'react';
import {
  LayoutDashboard,
  Activity,
  FileCode2,
  Settings,
  ChevronUp,
  ChevronDown,
  Server,
  BarChart3,
  Sliders,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import EmptyState from '../utils/empty-state';
import { useNavStore } from '../stores/use-nav-store';
import './dashboard.css';

/* ── Secciones de navegación ── */
const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    emptyState: {
      icon: <Server size={28} strokeWidth={1.5} />,
      title: 'Sin instancia configurada',
      description:
        'Configura tu conexión SSH para comenzar a monitorear y automatizar tu instancia remota.',
    },
  },
  {
    id: 'monitoring',
    label: 'Monitoreo',
    icon: Activity,
    emptyState: {
      icon: <BarChart3 size={28} strokeWidth={1.5} />,
      title: 'Sin datos de monitoreo',
      description:
        'Inicia el monitoreo para comenzar a recolectar métricas de CPU, memoria y disco en tiempo real.',
    },
  },
  {
    id: 'scripts',
    label: 'Scripts',
    icon: FileCode2,
    emptyState: {
      icon: <FileCode2 size={28} strokeWidth={1.5} />,
      title: 'Sin scripts creados',
      description:
        'Crea tu primer script para ejecutarlo remotamente en tu instancia via SSH.',
    },
  },
  {
    id: 'settings',
    label: 'Configuración',
    icon: Settings,
    emptyState: {
      icon: <Sliders size={28} strokeWidth={1.5} />,
      title: 'Configuración',
      description:
        'Ajusta el tema, la conexión SSH y las preferencias de la aplicación.',
    },
  },
];

/* ── Terminal Panel ── */
const TERMINAL_MIN_H = 36;
const TERMINAL_DEFAULT_H = 220;

function TerminalPanel({ isOpen, onToggle, height, onHeightChange }) {
  const startY = useRef(0);
  const startH = useRef(0);

  const onMouseDown = useCallback((e) => {
    e.preventDefault();
    startY.current = e.clientY;
    startH.current = height;

    const onMove = (mv) => {
      const delta = startY.current - mv.clientY;
      const newH = Math.max(TERMINAL_MIN_H + 1, Math.min(startH.current + delta, window.innerHeight * 0.6));
      onHeightChange(newH);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [height, onHeightChange]);

  return (
    <div
      className="terminal-panel"
      style={{ height: isOpen ? height : TERMINAL_MIN_H }}
      aria-label="Panel de terminal"
    >
      {isOpen && (
        <div
          className="terminal-panel__resize"
          onMouseDown={onMouseDown}
          title="Arrastrar para redimensionar"
          aria-hidden="true"
        />
      )}

      <div className="terminal-panel__header">
        <div className="terminal-panel__header-left">
          {/* SVG de terminal inline para mantener la estética del panel oscuro */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="terminal-panel__header-icon" aria-hidden="true">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span className="terminal-panel__header-title">Terminal</span>
          <span className="terminal-panel__header-badge">inactivo</span>
        </div>
        <button
          className="terminal-panel__toggle"
          onClick={onToggle}
          aria-label={isOpen ? 'Colapsar terminal' : 'Expandir terminal'}
        >
          {isOpen
            ? <ChevronDown size={13} strokeWidth={2} />
            : <ChevronUp size={13} strokeWidth={2} />
          }
        </button>
      </div>

      {isOpen && (
        <div className="terminal-panel__body">
          <p className="terminal-panel__placeholder">
            $ <span className="terminal-panel__cursor">▌</span>
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Sidebar ── */
function Sidebar({ activeSection, onNavigate, connectionStatus, collapsed, onToggleCollapse }) {
  const goToLanding = useNavStore((s) => s.goToLanding);

  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}
      aria-label="Navegación principal"
    >

      {/* ── Header del sidebar: logo + botón colapsar ── */}
      <div className="sidebar__header">
        <div className="sidebar__logo">
          <svg
            className="sidebar__logo-crown"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M2 18h20" />
            <path d="M4 18V8l4 4 4-8 4 8 4-4v10" />
          </svg>
          <span className="sidebar__logo-name">
            Deploy<span className="sidebar__logo-accent">Monitor</span>
          </span>
        </div>

        <button
          className="sidebar__collapse-btn"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expandir barra de navegación' : 'Colapsar barra de navegación'}
          title={collapsed ? 'Expandir' : 'Colapsar'}
        >
          <CollapseIcon size={15} strokeWidth={1.5} />
        </button>
      </div>

      {/* ── Nav items ── */}
      <nav className="sidebar__nav" role="navigation">
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={`sidebar__item ${activeSection === id ? 'sidebar__item--active' : ''}`}
            onClick={() => onNavigate(id)}
            aria-current={activeSection === id ? 'page' : undefined}
            title={collapsed ? label : undefined}
          >
            <Icon size={18} strokeWidth={1.5} className="sidebar__item-icon" aria-hidden="true" />
            <span className="sidebar__item-label">{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Bottom: estado de conexión + logout ── */}
      <div className="sidebar__bottom">
        <div className="sidebar__status">
          <span
            className={`sidebar__status-dot ${connectionStatus === 'connected' ? 'sidebar__status-dot--connected' : ''}`}
            aria-hidden="true"
          />
          <span className="sidebar__status-label">
            {connectionStatus === 'connected' ? 'Conectado' : 'Sin conexión'}
          </span>
        </div>

        <button
          className="sidebar__logout-btn"
          onClick={goToLanding}
          aria-label="Cerrar sesión y volver a la pantalla de inicio"
          title="Cerrar sesión"
        >
          <LogOut size={15} strokeWidth={1.5} />
        </button>
      </div>
    </aside>
  );
}

/* ── Content area ── */
function ContentArea({ section }) {
  const navItem = NAV_ITEMS.find((n) => n.id === section);
  const { icon, title, description } = navItem?.emptyState ?? {};

  return (
    <main className="content-area" role="main">
      <EmptyState icon={icon} title={title} description={description} mascot />
    </main>
  );
}

/* ── Dashboard root ── */
export default function Dashboard() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(TERMINAL_DEFAULT_H);
  const [connectionStatus] = useState('disconnected');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

  return (
    <div className="dashboard">
      <Sidebar
        activeSection={activeSection}
        onNavigate={setActiveSection}
        connectionStatus={connectionStatus}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />

      <div className="dashboard__main">
        <ContentArea section={activeSection} />
        <TerminalPanel
          isOpen={terminalOpen}
          onToggle={() => setTerminalOpen((v) => !v)}
          height={terminalHeight}
          onHeightChange={setTerminalHeight}
        />
      </div>
    </div>
  );
}