import { cn } from "../lib/cn";

/** Contenedor con la superficie translúcida de la app. */
export function Card({ as: Tag = "div", interactiva = false, className, ...props }) {
  return (
    <Tag
      className={cn(
        "bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-6",
        interactiva && "transition-all duration-200 hover:bg-white/10 hover:-translate-y-0.5 hover:shadow-lg",
        className
      )}
      {...props}
    />
  );
}

/** Insignia compacta de estado. */
export function Badge({ tono = "neutral", className, ...props }) {
  const tonos = {
    neutral: "bg-white/5 text-muted-foreground border-white/10",
    primary: "bg-primary/10 text-accent-foreground border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    destructive: "bg-destructive/10 text-destructive border-destructive/20",
  };
  return (
    <span
      className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-micro font-black uppercase", tonos[tono], className)}
      {...props}
    />
  );
}

/** Bloque gris animado para estados de carga. */
export function Skeleton({ className }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-white/5", className)} />;
}
