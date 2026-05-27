import React from 'react';
import './empty-state.css';

/**
 * EmptyState — componente reutilizable para secciones sin contenido.
 *
 * Props:
 *  icon        ReactNode  — ícono de Lucide (o cualquier SVG) a mostrar encima del mascot
 *  title       string     — título principal del estado vacío
 *  description string     — descripción secundaria / instrucción
 *  action      ReactNode  — botón o CTA opcional
 *  mascot      bool       — muestra el mascot logo (default: true)
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  mascot = true,
}) {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      {mascot && (
        <img
          src="/icon/ssh-manager-icon-128x128.png"
          alt=""
          className="empty-state__mascot"
          draggable={false}
          aria-hidden="true"
        />
      )}

      {icon && (
        <div className="empty-state__icon" aria-hidden="true">
          {icon}
        </div>
      )}

      <h2 className="empty-state__title">{title}</h2>

      {description && (
        <p className="empty-state__description">{description}</p>
      )}

      {action && (
        <div className="empty-state__action">
          {action}
        </div>
      )}
    </div>
  );
}