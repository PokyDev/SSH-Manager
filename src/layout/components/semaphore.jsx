import React from 'react';
import './semaphore.css';

export default function Semaphore() {
  return (
    <div className="semaphore">
      <button
        className="semaphore__btn semaphore__btn--close"
        title="Cerrar"
        aria-label="Cerrar"
      />
      <button
        className="semaphore__btn semaphore__btn--minimize"
        title="Minimizar"
        aria-label="Minimizar"
      />
      <button
        className="semaphore__btn semaphore__btn--maximize"
        title="Maximizar"
        aria-label="Maximizar"
      />
    </div>
  );
}