import React from 'react';
import { Server } from 'lucide-react';
import EmptyState from '../../utils/empty-state';
import './overview.css';

export default function Overview() {
  return (
    <main className="content-area" role="main">
      <EmptyState
        icon={<Server size={28} strokeWidth={1.5} />}
        title="Sin instancia configurada"
        description="Configura tu conexión SSH para comenzar a monitorear y automatizar tu instancia remota."
        mascot
      />
    </main>
  );
}
