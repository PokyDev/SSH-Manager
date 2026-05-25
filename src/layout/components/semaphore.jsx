import React, { useState } from 'react';
import SlideMessage from '../utils/slide-message';
import './semaphore.css';

export default function Semaphore() {
  const [showMsg, setShowMsg] = useState(false);

  const handleUnimplemented = () => {
    if (!showMsg) setShowMsg(true); // evita duplicados si se clickea rápido
  };

  return (
    <>
      <div className="semaphore">
        <button
          className="semaphore__btn semaphore__btn--close"
          title="Cerrar"
          aria-label="Cerrar"
          onClick={handleUnimplemented}
        />
        <button
          className="semaphore__btn semaphore__btn--minimize"
          title="Minimizar"
          aria-label="Minimizar"
          onClick={handleUnimplemented}
        />
        <button
          className="semaphore__btn semaphore__btn--maximize"
          title="Maximizar"
          aria-label="Maximizar"
          onClick={handleUnimplemented}
        />
      </div>

      {showMsg && (
        <SlideMessage
          message="emptyState"
          position="top-left"
          duration={2000}
          onDone={() => setShowMsg(false)}
        />
      )}
    </>
  );
}