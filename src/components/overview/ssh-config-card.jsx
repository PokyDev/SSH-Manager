import React, { useState, useRef, useCallback } from 'react';
import { KeyRound, FolderOpen, Pencil, Save, Plug, Wifi } from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import './ssh-config-card.css';

/*
  ssh-config-card.jsx
  Card de configuración de conexión SSH — DeployMonitor

  Funcionalidad:
  - Campo .pem:  solo lectura; botón "Explorar" abre el file picker nativo de Tauri.
  - Campo SSH:   solo lectura por defecto; botón "Editar" lo habilita, "Guardar" lo cierra.
  - Botón "Probar Conexión": simula un test SSH (mock). Cuando el backend implemente
    `ssh_test_connection`, reemplazar el bloque `simulateTest()` por:
      const result = await invoke('ssh_test_connection', { pemPath, connectionString });
  - Botón "Conectar": diseño listo; lógica pendiente de backend.
*/

/* ── Estado del test ── */
const TEST_STATUS = {
  IDLE:    'idle',
  TESTING: 'testing',
  SUCCESS: 'success',
  ERROR:   'error',
};

const STATUS_LABELS = {
  [TEST_STATUS.IDLE]:    'Sin verificar',
  [TEST_STATUS.TESTING]: 'Verificando...',
  [TEST_STATUS.SUCCESS]: 'Conexión OK',
  [TEST_STATUS.ERROR]:   'Sin conexión',
};

export default function SshConfigCard() {
  const [pemPath, setPemPath]                 = useState('');
  const [connectionString, setConnectionString] = useState('');
  const [isEditingConn, setIsEditingConn]     = useState(false);
  const [testStatus, setTestStatus]           = useState(TEST_STATUS.IDLE);
  const connInputRef = useRef(null);
  const resetTimerRef = useRef(null);

  /* ── Abrir file picker nativo para .pem ── */
  const handleBrowsePem = useCallback(async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          { name: 'PEM Key', extensions: ['pem'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (typeof selected === 'string') {
        setPemPath(selected);
      }
    } catch (err) {
      console.error('File picker error:', err);
    }
  }, []);

  /* ── Editar cadena de conexión ── */
  const handleEditConn = useCallback(() => {
    setIsEditingConn(true);
    setTimeout(() => connInputRef.current?.focus(), 0);
  }, []);

  const handleSaveConn = useCallback(() => {
    setIsEditingConn(false);
  }, []);

  /* ── Test de conexión (mock) ──
     TODO: reemplazar por invoke('ssh_test_connection', { pemPath, connectionString })
     cuando el comando Tauri esté implementado en el backend.
  ── */
  const simulateTest = useCallback(() => {
    return new Promise((resolve) => {
      // Simula éxito si ambos campos tienen valor, error en caso contrario.
      const hasConfig = pemPath.trim() !== '' && connectionString.trim() !== '';
      setTimeout(() => resolve(hasConfig), 1800);
    });
  }, [pemPath, connectionString]);

  const handleTestConnection = useCallback(async () => {
    if (testStatus === TEST_STATUS.TESTING) return;

    // Cancelar cualquier reset pendiente
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    setTestStatus(TEST_STATUS.TESTING);
    const success = await simulateTest();
    setTestStatus(success ? TEST_STATUS.SUCCESS : TEST_STATUS.ERROR);

    // Volver a idle tras 3 segundos
    resetTimerRef.current = setTimeout(() => {
      setTestStatus(TEST_STATUS.IDLE);
    }, 3000);
  }, [testStatus, simulateTest]);

  const isTesting = testStatus === TEST_STATUS.TESTING;

  return (
    <div className="ssh-config-card">
      {/* ── Header ── */}
      <div className="ssh-config-card__header">
        <div className="ssh-config-card__title-group">
          <KeyRound
            size={16}
            strokeWidth={1.5}
            className="ssh-config-card__title-icon"
            aria-hidden="true"
          />
          <h2 className="ssh-config-card__title">Conexión SSH</h2>
        </div>

        <div className={`ssh-config-card__status ssh-config-card__status--${testStatus}`}>
          <span
            className={`ssh-config-card__status-dot ssh-config-card__status-dot--${testStatus}`}
            aria-hidden="true"
          />
          <span className="ssh-config-card__status-label">
            {STATUS_LABELS[testStatus]}
          </span>
        </div>
      </div>

      {/* ── Campos ── */}
      <div className="ssh-config-card__fields">
        {/* Ruta .pem */}
        <div className="ssh-config-field">
          <label className="ssh-config-field__label" htmlFor="pem-path">
            Clave privada (.pem)
          </label>
          <div className="ssh-config-field__row">
            <input
              id="pem-path"
              type="text"
              className="ssh-config-field__input"
              value={pemPath}
              readOnly
              placeholder="Selecciona tu archivo .pem..."
              aria-label="Ruta al archivo de clave privada .pem"
            />
            <button
              className="ssh-config-field__btn"
              onClick={handleBrowsePem}
              title="Explorar archivos"
              aria-label="Seleccionar archivo .pem"
            >
              <FolderOpen size={14} strokeWidth={1.5} aria-hidden="true" />
              Explorar
            </button>
          </div>
        </div>

        {/* Cadena de conexión */}
        <div className="ssh-config-field">
          <label className="ssh-config-field__label" htmlFor="conn-string">
            Cadena de conexión
          </label>
          <div className="ssh-config-field__row">
            <input
              id="conn-string"
              ref={connInputRef}
              type="text"
              className={`ssh-config-field__input${isEditingConn ? ' ssh-config-field__input--editable' : ''}`}
              value={connectionString}
              readOnly={!isEditingConn}
              onChange={(e) => setConnectionString(e.target.value)}
              placeholder="usuario@host-o-ip"
              aria-label="Cadena de conexión SSH"
            />
            {!isEditingConn ? (
              <button
                className="ssh-config-field__btn ssh-config-field__btn--icon-only"
                onClick={handleEditConn}
                title="Editar cadena de conexión"
                aria-label="Editar cadena de conexión"
              >
                <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
              </button>
            ) : (
              <button
                className="ssh-config-field__btn ssh-config-field__btn--save"
                onClick={handleSaveConn}
                title="Guardar cadena de conexión"
                aria-label="Guardar cadena de conexión"
              >
                <Save size={14} strokeWidth={1.5} aria-hidden="true" />
                Guardar
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="ssh-config-card__actions">
        <button
          className="ssh-config-card__btn-connect"
          aria-label="Conectar a la instancia SSH"
          /* TODO: invocar ssh_connect cuando el backend esté listo */
        >
          <Plug size={14} strokeWidth={1.5} aria-hidden="true" />
          Conectar
        </button>

        {/*<div className="ssh-config-card__actions-divider" aria-hidden="true" />*/}

        <button
          className={`ssh-config-card__btn-test${isTesting ? ' ssh-config-card__btn-test--testing' : ''}`}
          onClick={handleTestConnection}
          disabled={isTesting}
          aria-label="Probar conexión SSH"
          aria-live="polite"
        >
          {isTesting ? (
            <>
              <span className="btn-spinner" aria-hidden="true" />
              Verificando
            </>
          ) : (
            <>
              <Wifi size={14} strokeWidth={1.5} aria-hidden="true" />
              Probar conexión
            </>
          )}
        </button>
      </div>
    </div>
  );
}