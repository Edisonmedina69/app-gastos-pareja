import { cn } from "../lib/cn";

/**
 * Selector de opciones excluyentes (pestañas compactas). Se desplaza
 * horizontalmente dentro de su propio contenedor si no entra, sin generar
 * scroll horizontal en la página.
 */
export function SegmentedControl({ opciones, valor, onChange, etiqueta, className, tamano = "md", estirar = false }) {
  return (
    <div
      role="tablist"
      aria-label={etiqueta}
      className={cn("flex max-w-full overflow-x-auto no-scrollbar bg-white/5 p-1 rounded-xl border border-white/5 backdrop-blur-md", className)}
    >
      {opciones.map((op) => {
        const activa = op.valor === valor;
        return (
          <button
            key={op.valor}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => onChange(op.valor)}
            className={cn(
              "shrink-0 min-h-touch px-3 rounded-lg font-black uppercase transition-all duration-200",
              estirar && "flex-1 px-2",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tamano === "sm" ? "text-micro" : "text-[11px] sm:text-xs",
              activa ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            {op.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
