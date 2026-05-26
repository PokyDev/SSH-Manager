/* ============================================================
   slide-message — exports públicos
   ============================================================

   Importar desde cualquier parte del proyecto:

     import { SlideMessageProvider, useSlideMessage } from '../utils/slide-message';

   SlideMessageCard NO se exporta aquí intencionalmente:
   es un detalle interno del provider. Los componentes externos
   nunca deben montarlo directamente.
   ============================================================ */

export { SlideMessageProvider }   from './slide-message-provider';
export { useSlideMessage }        from './use-slide-message';