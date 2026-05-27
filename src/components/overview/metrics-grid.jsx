import React, { useState, useEffect, useRef } from 'react';
import { Activity, Cpu, MemoryStick, HardDrive, Gauge } from 'lucide-react';
import MetricCard from './metric-card';
import './metrics-grid.css';

/*
  metrics-grid.jsx
  Grid de métricas con datos hardcodeados — DeployMonitor

  Los datos son simulados: se genera un historial inicial y cada 4 segundos
  se añade un nuevo punto que "evoluciona" levemente el valor anterior,
  dando sensación de monitoreo en vivo.

  TODO: cuando el backend implemente monitor_get_latest / monitor:metrics_update,
  reemplazar `useSimulatedMetrics` por un hook que suscriba al Tauri Event.
*/

function generateHistory(base, spread, length = 25) {
  const history = [];
  let current = base;
  for (let i = 0; i < length; i++) {
    const delta = (Math.random() - 0.5) * spread;
    current = Math.max(0, Math.min(100, current + delta));
    history.push(Math.round(current * 10) / 10);
  }
  return history;
}

function useSimulatedMetrics() {
  const initialMetrics = useRef({
    cpu:   { value: 34, history: generateHistory(34, 12) },
    mem:   { value: 61, history: generateHistory(61, 6) },
    disk:  { value: 48, history: generateHistory(48, 3) },
    load:  { value: 1.2, history: generateHistory(1.2, 0.4).map(v => Math.max(0, v)) },
  });

  const [metrics, setMetrics] = useState(initialMetrics.current);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics((prev) => {
        const evolve = (old, spread, min = 0, max = 100) => {
          const delta = (Math.random() - 0.5) * spread;
          const newVal = Math.max(min, Math.min(max, old.value + delta));
          const rounded = Math.round(newVal * 10) / 10;
          return {
            value: rounded,
            history: [...old.history.slice(1), rounded],
          };
        };

        return {
          cpu:  evolve(prev.cpu,  10),
          mem:  evolve(prev.mem,  4),
          disk: evolve(prev.disk, 1.5),
          load: evolve(prev.load, 0.3, 0, 8),
        };
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return metrics;
}

export default function MetricsGrid() {
  const { cpu, mem, disk, load } = useSimulatedMetrics();

  const loadPct = Math.round((load.value / 8) * 100);
  const loadHistory = load.history.map((v) => Math.round((v / 8) * 100));

  return (
    <section aria-label="Métricas del sistema">
      <div className="metrics-grid__header">
        <div className="metrics-grid__title-group">
          <Activity
            size={14}
            strokeWidth={1.5}
          />
          <h3 className="metrics-grid__title">Métricas del sistema</h3>
        </div>
        <span className="metrics-grid__hint">datos de muestra</span>
      </div>

      <div className="metrics-grid__cards">
        <MetricCard
          icon={<Cpu size={13} strokeWidth={1.5} />}
          label="CPU"
          value={cpu.value}
          unit="%"
          data={cpu.history}
          threshold={{ warning: 70, critical: 90 }}
          showProgress
          maxValue={100}
        />

        <MetricCard
          icon={<MemoryStick size={13} strokeWidth={1.5} />}
          label="Memoria"
          value={mem.value}
          unit="%"
          sub="de 7.8 GB"
          data={mem.history}
          threshold={{ warning: 75, critical: 90 }}
          showProgress
          maxValue={100}
        />

        <MetricCard
          icon={<HardDrive size={13} strokeWidth={1.5} />}
          label="Disco"
          value={disk.value}
          unit="%"
          sub="de 80 GB"
          data={disk.history}
          threshold={{ warning: 80, critical: 95 }}
          showProgress
          maxValue={100}
        />

        <MetricCard
          icon={<Gauge size={13} strokeWidth={1.5} />}
          label="Load Avg"
          value={load.value}
          unit=""
          sub="1 min"
          data={loadHistory}
          threshold={{ warning: 60, critical: 80 }}
        />
      </div>
    </section>
  );
}