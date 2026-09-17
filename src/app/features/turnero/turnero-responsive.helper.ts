/**
 * Helper PURO para la detección de viewport responsive del turnero.
 *
 * Calcula cuántas tarjetas son visibles por sección según el ancho del
 * viewport (breakpoint md de Tailwind = 768px):
 *   - Móvil (≤767px): 2 tarjetas
 *   - Escritorio (≥768px): 4 tarjetas
 *
 * No tiene estado de Angular-Lifecycle. El componente lo invoca en
 * ngOnInit/ngOnDestroy y pasa un callback para actualizar su propiedad.
 */

/** Breakpoint md de Tailwind (768px). */
const BREAKPOINT_MD = 768;

/**
 * Inicializa el media query responsive y notifica al componente del estado
 * actual del viewport.
 *
 * @param esMovilCb - Callback que se ejecuta cuando cambia el tamaño del
 *   viewport. Recibe `true` si es móvil (≤767px), `false` si es escritorio.
 * @returns Función de cleanup para eliminar los listeners.
 */
export function initTarjetasResponsive(
  esMovilCb: (movil: boolean) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  const mq = window.matchMedia(`(max-width: ${BREAKPOINT_MD - 1}px)`);

  const handler = () => {
    esMovilCb(mq.matches);
  };

  // Aplicar estado actual
  handler();

  mq.addEventListener('change', handler);

  // Retornar cleanup
  return () => {
    mq.removeEventListener('change', handler);
  };
}
