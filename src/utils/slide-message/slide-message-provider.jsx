import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import SlideMessageCard, { VALID_POSITIONS } from './slide-message-card';

/* ============================================================
   Context
   ============================================================ */
const SlideMessageContext = createContext(null);

/* ============================================================
   SlideMessageProvider
   ============================================================

   Muestra un único mensaje a la vez. Mientras un mensaje esté
   en pantalla, las llamadas a notify() se ignoran. Una vez que
   el mensaje termina su ciclo (entrada + visible + salida),
   se vuelven a aceptar clics.

   Coloca este provider una sola vez en la raíz de la app:

     <SlideMessageProvider>
       <App />
     </SlideMessageProvider>
*/
export function SlideMessageProvider({ children }) {
  /* Mensaje activo: null cuando no hay nada en pantalla */
  const [activeMessage, setActiveMessage] = useState(null);

  /* true mientras el mensaje actual está en pantalla (incluye animaciones) */
  const [isBusy, setIsBusy] = useState(false);

  /* Contador para IDs únicos sin dependencias externas */
  const counterRef = useRef(0);

  /* ----------------------------------------------------------
     notify({ message, text, position, duration })
     Función pública expuesta por el hook useSlideMessage.
     Si hay un mensaje en pantalla, se ignora el llamado.
     Si no, se muestra inmediatamente.
  ---------------------------------------------------------- */
  const notify = useCallback(({
    message  = 'emptyState',
    text,
    position = 'top-left',
    duration = 2000,
    offsetX  = 20,
    offsetY  = 20,
  } = {}) => {
    setIsBusy(busy => {
      if (busy) return true;

      const safePosition = VALID_POSITIONS.includes(position) ? position : 'top-left';

      setActiveMessage({
        id: counterRef.current++,
        message,
        text,
        position: safePosition,
        duration,
        offsetX,
        offsetY,
      });

      return true;
    });
  }, []);

  /* ----------------------------------------------------------
     handleDone — llamado por SlideMessageCard cuando termina
     su ciclo. Limpia el mensaje activo y libera el canal.
  ---------------------------------------------------------- */
  const handleDone = useCallback(() => {
    setActiveMessage(null);
    setIsBusy(false);
  }, []);

  /* ----------------------------------------------------------
     Render
  ---------------------------------------------------------- */
  return (
    <SlideMessageContext.Provider value={{ notify }}>
      {children}

      {/* Único punto de renderizado de SlideMessageCard en toda la app */}
      {activeMessage && (
        <SlideMessageCard
          key={activeMessage.id}
          message={activeMessage.message}
          text={activeMessage.text}
          position={activeMessage.position}
          duration={activeMessage.duration}
          offsetX={activeMessage.offsetX}
          offsetY={activeMessage.offsetY}
          onDone={handleDone}
        />
      )}
    </SlideMessageContext.Provider>
  );
}

/* ============================================================
   useSlideMessageContext — consumo interno del context.
   Los componentes externos usan useSlideMessage (re-exportado
   desde index.js), nunca este hook directamente.
   ============================================================ */
export function useSlideMessageContext() {
  const ctx = useContext(SlideMessageContext);

  if (!ctx) {
    throw new Error(
      '[SlideMessage] useSlideMessage debe usarse dentro de <SlideMessageProvider>.'
    );
  }

  return ctx;
}