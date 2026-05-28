import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
} from 'recharts';
import './metric-card.css';

/*
  metric-card.jsx
  Card de métrica individual con sparkline de Recharts — DeployMonitor

  Props:
    icon        ReactNode   — ícono de Lucide
    label       string      — nombre de la métrica (ej: "CPU")
    value       number      — valor actual
    unit        string      — unidad (ej: "%", "MB", "GB")
    sub         string      — texto secundario (ej: "de 7.8 GB")
    data        number[]    — historial de valores para la sparkline (20–30 puntos)
    threshold   object      — { warning: number, critical: number } — umbrales opcionales
    showProgress bool       — mostrar barra de progreso debajo del valor
    maxValue    number      — valor máximo para calcular % de progreso (default: 100)
*/

function getLevel(value, threshold) {
  if (!threshold) return 'normal';
  if (value >= threshold.critical) return 'critical';
  if (value >= threshold.warning) return 'warning';
  return 'normal';
}

const LEVEL_LABELS = {
  normal:   'Normal',
  warning:  'Elevado',
  critical: 'Crítico',
};

/* Tooltip custom minimalista */
function SparkTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-sm)',
      padding: '3px 8px',
      fontFamily: 'var(--font-code)',
      fontSize: '11px',
      color: 'var(--text-primary)',
      pointerEvents: 'none',
    }}>
      {payload[0].value}
    </div>
  );
}

export default function MetricCard({
  icon,
  label,
  value,
  unit = '%',
  sub,
  data = [],
  threshold,
  showProgress = false,
  maxValue = 100,
}) {
  const level = getLevel(value, threshold);

  /* Convertir array de números a formato recharts */
  const chartData = useMemo(
    () => data.map((v, i) => ({ i, v })),
    [data],
  );

  /* Color del área según nivel */
  const areaColor = level === 'critical'
    ? 'var(--color-error-light)'
    : level === 'warning'
      ? 'var(--color-gold)'
      : 'var(--color-gold)';

  const progressPct = Math.min(100, (value / maxValue) * 100);

  const gradId = label.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="metric-card">
      {/* Header */}
      <div className="metric-card__header">
        <div className="metric-card__label-group">
          {icon && (
            <span className="metric-card__icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <span className="metric-card__label">{label}</span>
        </div>
        {threshold && (
          <span className={`metric-card__badge metric-card__badge--${level}`}>
            {LEVEL_LABELS[level]}
          </span>
        )}
      </div>

      {/* Valor */}
      <div className="metric-card__value-row">
        <span className="metric-card__value">{value}</span>
        <span className="metric-card__unit">{unit}</span>
        {sub && <span className="metric-card__sub">{sub}</span>}
      </div>

      {/* Barra de progreso opcional */}
      {showProgress && (
        <div className="metric-card__progress" aria-hidden="true">
          <div
            className={`metric-card__progress-fill metric-card__progress-fill--${level}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Sparkline */}
      {chartData.length > 0 && (
        <div className="metric-card__chart" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={areaColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={areaColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <Tooltip
                content={<SparkTooltip />}
                cursor={{ stroke: areaColor, strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Area
                type="monotone"
                dataKey="v"
                stroke={areaColor}
                strokeWidth={1.5}
                fill={`url(#grad-${gradId})`}
                dot={false}
                activeDot={{ r: 3, fill: areaColor, strokeWidth: 0 }}
                isAnimationActive={true}
                animationDuration={600}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}