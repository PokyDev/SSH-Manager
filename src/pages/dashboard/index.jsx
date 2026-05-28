import React, { useState, useCallback, useEffect } from 'react';
import Sidebar from '../../layout/sidebar';
import TerminalPanel, { TERMINAL_DEFAULT_H } from '../../layout/terminal-panel';
import { useTerminalStore } from '../../stores/use-terminal-store';
import Overview from './overview';
import Monitoring from './monitoring';
import Scripts from './scripts';
import Settings from './settings';
import './dashboard.css';

const SECTIONS = {
  dashboard: Overview,
  monitoring: Monitoring,
  scripts: Scripts,
  settings: Settings,
};

export default function Dashboard() {
  const [activeSection, setActiveSection] = useState('dashboard');
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(TERMINAL_DEFAULT_H);
  const [connectionStatus] = useState('disconnected');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const openRequested = useTerminalStore((s) => s.openRequested);
  const clearOpenRequest = useTerminalStore((s) => s.clearOpenRequest);

  useEffect(() => {
    if (openRequested) {
      setTerminalOpen(true);
      clearOpenRequest();
    }
  }, [openRequested, clearOpenRequest]);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((v) => !v), []);

  const ActiveSection = SECTIONS[activeSection] ?? Overview;

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
        <ActiveSection />
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
