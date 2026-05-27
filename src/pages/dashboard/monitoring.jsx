import React from 'react';
import { BarChart3 } from 'lucide-react';
import EmptyState from '../../utils/empty-state';
import './monitoring.css';

export default function Monitoring() {
  return (
    <main className="content-area" role="main">
      <EmptyState
        icon={<BarChart3 size={28} strokeWidth={1.5} />}
        title="Sin datos de monitoreo"
        description="Inicia el monitoreo para comenzar a recolectar métricas de CPU, memoria y disco en tiempo real."
        mascot
      />
    </main>
  );
}
