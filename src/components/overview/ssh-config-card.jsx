import React, { useState, useRef, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { KeyRound, FolderOpen, Pencil, Save, Plug, Wifi } from 'lucide-react';
import { useSshStore, TEST_STATUS, STATUS_LABELS } from '../../stores/use-ssh-store';
import { useTerminalStore } from '../../stores/use-terminal-store';
import { simulateSshConnection } from '../../utils/ssh-connection-simulator';
import './ssh-config-card.css';

const DEFAULT_CONNECTION = 'ubuntu@ec2-3-223-213-238.compute-1.amazonaws.com';

export default function SshConfigCard() {
  const [pemPath, setPemPath]               = useState(() => localStorage.getItem('dm-pem-path') || '');
  const [connectionString, setConnectionString] = useState(() => localStorage.getItem('dm-connection-string') || DEFAULT_CONNECTION);
  const [isEditingConn, setIsEditingConn]   = useState(false);

  const testStatus   = useSshStore((s) => s.testStatus);
  const errorMessage = useSshStore((s) => s.errorMessage);
  const setTestStatus      = useSshStore((s) => s.setTestStatus);
  const setErrorMessage    = useSshStore((s) => s.setErrorMessage);
  const scheduleReady      = useSshStore((s) => s.scheduleReady);
  const scheduleIdle       = useSshStore((s) => s.scheduleIdle);
  const cancelScheduledReset = useSshStore((s) => s.cancelScheduledReset);

  const cancelRef = useRef(null);

  useEffect(() => { localStorage.setItem('dm-pem-path', pemPath); }, [pemPath]);
  useEffect(() => { localStorage.setItem('dm-connection-string', connectionString); }, [connectionString]);

  useEffect(() => {
    return () => {
      cancelRef.current?.();
    };
  }, []);

  const connInputRef = useRef(null);

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

  const handleEditConn = useCallback(() => {
    setIsEditingConn(true);
    setTimeout(() => connInputRef.current?.focus(), 0);
  }, []);

  const handleSaveConn = useCallback(() => {
    setIsEditingConn(false);
  }, []);

  const handleTestConnection = useCallback(async () => {
    if (testStatus === TEST_STATUS.TESTING) return;

    cancelScheduledReset();
    cancelRef.current?.();

    setTestStatus(TEST_STATUS.TESTING);
    setErrorMessage('');

    const { clearTerminal, addLine, setActive, requestOpen } = useTerminalStore.getState();
    clearTerminal();
    requestOpen();
    setActive(true);

    cancelRef.current = simulateSshConnection({
      pemPath,
      connectionString,
      onLine: addLine,
      onDone: () => {
        setActive(false);
      },
    });

    try {
      await invoke('ssh_test_connection', {
        pemPath,
        connectionString,
      });

      setTestStatus(TEST_STATUS.SUCCESS);
      scheduleReady();
    } catch (err) {
      cancelRef.current?.();
      const { addLine: addLineNow, setActive: setActiveNow } = useTerminalStore.getState();
      const message = err?.message ?? String(err);
      setErrorMessage(message);
      setTestStatus(TEST_STATUS.ERROR);
      addLineNow({ type: 'blank' });
      addLineNow({ type: 'error', text: `Connection error: ${message}` });
      setActiveNow(false);
      scheduleIdle();
    }
  }, [testStatus, pemPath, connectionString, setTestStatus, setErrorMessage, scheduleReady, scheduleIdle, cancelScheduledReset]);

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

        <div
          className={`ssh-config-card__status ssh-config-card__status--${testStatus}`}
          role="status"
          aria-live="polite"
          aria-label={`Estado de conexión: ${STATUS_LABELS[testStatus]}`}
        >
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
              placeholder="usuario@host o ssh -i key.pem usuario@host"
              aria-label="Cadena de conexión SSH"
            />
            <button
              className={`ssh-config-field__btn${isEditingConn ? ' ssh-config-field__btn--save' : ' ssh-config-field__btn--icon-only'}`}
              onClick={isEditingConn ? handleSaveConn : handleEditConn}
              title={isEditingConn ? 'Guardar cadena de conexión' : 'Editar cadena de conexión'}
              aria-label={isEditingConn ? 'Guardar cadena de conexión' : 'Editar cadena de conexión'}
            >
              {isEditingConn ? (
                <>
                  <Save size={14} strokeWidth={1.5} aria-hidden="true" />
                  Guardar
                </>
              ) : (
                <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div
        className={`ssh-config-card__error-wrap${testStatus === TEST_STATUS.ERROR && errorMessage ? ' ssh-config-card__error-wrap--visible' : ''}`}
        aria-hidden={!(testStatus === TEST_STATUS.ERROR && errorMessage)}
      >
        <p className="ssh-config-card__error-msg" role="alert" aria-live="assertive">
          {errorMessage}
        </p>
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

        <button
          className={`ssh-config-card__btn-test${isTesting ? ' ssh-config-card__btn-test--testing' : ''}`}
          onClick={handleTestConnection}
          disabled={isTesting}
          aria-label="Probar conexión SSH"
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