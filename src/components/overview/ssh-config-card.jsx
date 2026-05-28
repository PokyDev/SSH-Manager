import React, { useState, useRef, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { KeyRound, FolderOpen, Pencil, Save, Plug, Wifi } from 'lucide-react';
import './ssh-config-card.css';

/*
  ssh-config-card.jsx
  Card de configuración de conexión SSH — DeployMonitor

  Funcionalidad:
  - Campo .pem:  solo lectura; botón "Explorar" abre el file picker nativo de Tauri.
                 La ruta seleccionada se muestra en el input pero el archivo
                 nunca sale del proceso nativo de Rust.
  - Campo SSH:   solo lectura por defecto con valor inicial `DEFAULT_CONNECTION`.
                 Botón "Editar" lo habilita, "Guardar" lo cierra.
- Botón "Probar Conexión": invoca el comando Tauri `ssh_test_connection`.
                  Si la conexión es exitosa: muestra "Conexión Verificada" 3 s,
                  luego transita a "Ya puedes Conectarte" (estado READY permanente).
                  Si falla, muestra ERROR durante 3 s y vuelve a IDLE.
  - Botón "Conectar": diseño listo; lógica pendiente de backend.
*/

// ── Valor por defecto del campo de conexión ───────────────────────────
// Se muestra sólo el tramo `usuario@host`; el archivo .pem se gestiona
// de forma separada con el file picker.
const DEFAULT_CONNECTION = 'ubuntu@ec2-3-223-213-238.compute-1.amazonaws.com';

// ── Estados del test de conexión ──────────────────────────────────────
const TEST_STATUS = {
  IDLE:    'idle',
  TESTING: 'testing',
  SUCCESS: 'success',
  READY:   'ready',
  ERROR:   'error',
};

const STATUS_LABELS = {
  [TEST_STATUS.IDLE]:    'Sin verificar',
  [TEST_STATUS.TESTING]: 'Verificando...',
  [TEST_STATUS.SUCCESS]: 'Conexión Verificada',
  [TEST_STATUS.READY]:   'Ya puedes Conectarte',
  [TEST_STATUS.ERROR]:   'Sin conexión',
};

export default function SshConfigCard() {
  const [pemPath, setPemPath]               = useState(() => localStorage.getItem('dm-pem-path') || '');
  const [connectionString, setConnectionString] = useState(() => localStorage.getItem('dm-connection-string') || DEFAULT_CONNECTION);
  const [isEditingConn, setIsEditingConn]   = useState(false);
  const [testStatus, setTestStatus]         = useState(TEST_STATUS.IDLE);
  const [errorMessage, setErrorMessage]     = useState('');

  useEffect(() => { localStorage.setItem('dm-pem-path', pemPath); }, [pemPath]);
  useEffect(() => { localStorage.setItem('dm-connection-string', connectionString); }, [connectionString]);

  const connInputRef  = useRef(null);
  const resetTimerRef = useRef(null);

  // ── Abrir file picker nativo para .pem ────────────────────────────
  // El archivo .pem nunca se lee aquí: solo recibimos la ruta del
  // proceso nativo vía tauri-plugin-dialog y la mostramos al usuario.
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

  // ── Editar / guardar cadena de conexión ───────────────────────────
  const handleEditConn = useCallback(() => {
    setIsEditingConn(true);
    setTimeout(() => connInputRef.current?.focus(), 0);
  }, []);

  const handleSaveConn = useCallback(() => {
    setIsEditingConn(false);
  }, []);

  // ── Probar conexión (lógica real via Tauri) ───────────────────────
  const handleTestConnection = useCallback(async () => {
    if (testStatus === TEST_STATUS.TESTING) return;

    // Cancelar cualquier reset pendiente de un test anterior
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);

    setTestStatus(TEST_STATUS.TESTING);
    setErrorMessage('');

    try {
      // Invoca el comando Rust `ssh_test_connection`.
      // El backend lee el .pem desde disco y autentica; nunca devuelve
      // el contenido del archivo al renderer.
      await invoke('ssh_test_connection', {
        pemPath,
        connectionString,
      });

      // Éxito: mostrar "Conexión Verificada" 3 s, luego transitar a "Ya puedes Conectarte"
      setTestStatus(TEST_STATUS.SUCCESS);

      resetTimerRef.current = setTimeout(() => {
        setTestStatus(TEST_STATUS.READY);
      }, 3000);
    } catch (err) {
      // El backend serializa los errores como { code, message }.
      // Guardamos el mensaje para mostrarlo si se necesita en el futuro.
      const message = err?.message ?? String(err);
      setErrorMessage(message);
      setTestStatus(TEST_STATUS.ERROR);

      // Volver a IDLE tras 3 s para que el usuario pueda reintentar
      resetTimerRef.current = setTimeout(() => {
        setTestStatus(TEST_STATUS.IDLE);
        setErrorMessage('');
      }, 3000);
    }
  }, [testStatus, pemPath, connectionString]);

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
              placeholder="usuario@host-o-ip"
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