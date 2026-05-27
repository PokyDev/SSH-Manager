import React from 'react';
import { FileCode2 } from 'lucide-react';
import EmptyState from '../../utils/empty-state';
import './scripts.css';

export default function Scripts() {
  return (
    <main className="content-area" role="main">
      <EmptyState
        icon={<FileCode2 size={28} strokeWidth={1.5} />}
        title="Sin scripts creados"
        description="Crea tu primer script para ejecutarlo remotamente en tu instancia via SSH."
        mascot
      />
    </main>
  );
}
