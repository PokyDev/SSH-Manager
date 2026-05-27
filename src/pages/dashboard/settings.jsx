import React from 'react';
import { Sliders } from 'lucide-react';
import EmptyState from '../../utils/empty-state';
import './settings.css';

export default function Settings() {
  return (
    <main className="content-area" role="main">
      <EmptyState
        icon={<Sliders size={28} strokeWidth={1.5} />}
        title="Configuración"
        description="Ajusta el tema, la conexión SSH y las preferencias de la aplicación."
        mascot
      />
    </main>
  );
}
