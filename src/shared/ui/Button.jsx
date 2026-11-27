import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/cn";

const base =
  "inline-flex items-center justify-center gap-2 font-black uppercase tracking-wide select-none " +
  "transition-all duration-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
  "disabled:opacity-50 disabled:pointer-events-none";

const variantes = {
  primary: "bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 hover:-translate-y-0.5",
  success: "bg-success text-success-foreground shadow-lg shadow-success/20 hover:bg-success/90 hover:-translate-y-0.5",
  destructive: "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20 hover:bg-destructive/90",
  secondary: "bg-white/5 text-muted-foreground border border-white/10 hover:bg-white/10 hover:text-foreground",
  outline: "border border-primary/30 bg-primary/10 text-accent-foreground hover:bg-primary/20",
  ghost: "text-muted-foreground hover:bg-white/5 hover:text-foreground",
};

const tamanos = {
  sm: "min-h-touch px-3 text-micro rounded-xl",
  md: "min-h-touch px-4 py-3 text-xs rounded-xl",
  lg: "min-h-[3.25rem] px-6 py-4 text-sm rounded-2xl",
};

/**
 * Botón base. Siempre mide al menos 44 px de alto (objetivo táctil).
 * `cargando` muestra un spinner y deshabilita el botón.
 */
export const Button = forwardRef(function Button(
  { variante = "primary", tamano = "md", cargando = false, className, children, disabled, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cn(base, variantes[variante], tamanos[tamano], className)}
      {...props}
    >
      {cargando ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : children}
    </button>
  );
});

/** Botón cuadrado de 44 × 44 px para íconos. Requiere `etiqueta` (aria-label). */
export const IconButton = forwardRef(function IconButton(
  { etiqueta, variante = "ghost", className, children, type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(base, variantes[variante], "h-touch w-touch shrink-0 rounded-xl normal-case", className)}
      {...props}
    >
      {children}
    </button>
  );
});
