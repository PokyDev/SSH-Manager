import { useSlideMessageContext } from './slide-message-provider';

/* ============================================================
   useSlideMessage — hook público
   ============================================================

   Uso en cualquier componente:

     const { notify } = useSlideMessage();

     notify({ message: 'emptyState', position: 'top-right', duration: 2000 });

   Parámetros de notify:
   ├── message  {string}  — Variante: 'emptyState' (default)
   ├── text     {string}  — Texto personalizado (opcional)
   ├── position {string}  — 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
   ├── duration {number}  — ms visibles antes de desaparecer (default: 2000)
   ├── offsetX  {number}  — Distancia en px al borde horizontal cercano (default: 20)
   └── offsetY  {number}  — Distancia en px al borde vertical cercano (default: 20)
*/
export function useSlideMessage() {
  const { notify } = useSlideMessageContext();
  return { notify };
}