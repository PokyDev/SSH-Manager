import React from 'react';
import {
  LayoutDashboard,
  Activity,
  FileCode2,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useNavStore } from '../stores/use-nav-store';
import './sidebar.css';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'monitoring', label: 'Monitoreo', icon: Activity },
  { id: 'scripts', label: 'Scripts', icon: FileCode2 },
  { id: 'settings', label: 'Configuración', icon: Settings },
];

export { NAV_ITEMS };

export default function Sidebar({ activeSection, onNavigate, connectionStatus, collapsed, onToggleCollapse }) {
  const goToLanding = useNavStore((s) => s.goToLanding);

  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside
      className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}`}
      aria-label="Navegación principal"
    >
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
