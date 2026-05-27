import React from 'react';
import SshConfigCard from '../../components/overview/ssh-config-card';
import MetricsGrid from '../../components/overview/metrics-grid';
import './overview.css';

/*
  overview.jsx
  Sección principal del Dashboard — DeployMonitor

  Estructura:
    1. Configuración SSH  (SshConfigCard)
    2. Divisor
    3. Métricas del sistema (MetricsGrid con datos simulados)
*/

export default function Overview() {
  return (
    <main className="content-area" role="main" aria-label="Vista general del dashboard">
      <div className="overview">
        {/* ── Bloque 1: Configuración SSH ── */}
        <section aria-label="Configuración de conexión SSH">
          <SshConfigCard />
        </section>

        <div className="overview__divider" aria-hidden="true" />

        {/* ── Bloque 2: Métricas ── */}
        <MetricsGrid />
      </div>
    </main>
  );
}