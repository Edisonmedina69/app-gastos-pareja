import { useEffect, useId, useRef } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { useBloquearScroll } from "../hooks/useBloquearScroll";

const anchos = { sm: "sm:max-w-sm", md: "sm:max-w-md", lg: "sm:max-w-lg" };

/**
 * Diálogo accesible y mobile-first:
 * - En celular es una hoja inferior a todo el ancho, con scroll propio y
 *   respeto del área segura (notch / barra de gestos).
 * - Desde `sm` es un diálogo centrado.
 * - Cierra con Escape o tocando el fondo, bloquea el scroll de la página,
 *   mueve el foco adentro al abrir y lo devuelve al cerrar.
 *
 * Envolverlo en <AnimatePresence> para animar la salida.
 */
export function Modal({ titulo, ariaLabel, onClose, children, ancho = "md", capa = "z-[100]", className, cerrarConFondo = true, etiquetaCerrar = "Cerrar" }) {
  const idTitulo = useId();
  const panel = useRef(null);
  useBloquearScroll(true);

  useEffect(() => {
    const previo = document.activeElement;
    const enfocable = panel.current?.querySelector("input, select, textarea, button:not([data-cerrar])");
    (enfocable || panel.current)?.focus({ preventScroll: true });
    const alTeclear = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("keydown", alTeclear);
      if (previo && typeof previo.focus === "function") previo.focus({ preventScroll: true });
    };
    // Sólo al montar/desmontar: re-enfocar en cada render robaría el foco al escribir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn("fixed inset-0 flex items-end sm:items-center justify-center sm:p-4", capa)}>
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={cerrarConFondo ? onClose : undefined}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titulo ? idTitulo : undefined}
        aria-label={!titulo ? ariaLabel : undefined}
        tabIndex={-1}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 30, stiffness: 320 }}
        className={cn(
          "surface-sheet relative w-full max-h-[92dvh] overflow-y-auto overscroll-contain outline-none",
          "rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-6",
          anchos[ancho],
          className
        )}
      >
        <div aria-hidden="true" className="sm:hidden mx-auto -mt-2 mb-3 h-1.5 w-10 rounded-full bg-white/15" />
        {onClose && (
          <button
            type="button"
            data-cerrar
            onClick={onClose}
            aria-label={etiquetaCerrar}
            className="absolute top-3 right-3 h-touch w-touch inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={20} />
          </button>
        )}
        {titulo && (
          <h2 id={idTitulo} className="pr-12 text-title-sm font-black text-foreground uppercase tracking-tight mb-4">
            {titulo}
          </h2>
        )}
        {children}
      </motion.div>
    </div>
  );
}
