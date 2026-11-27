import { forwardRef, useId } from "react";
import { cn } from "../lib/cn";

const control =
  "w-full min-h-touch bg-slate-900 border border-input rounded-xl px-4 py-3 text-base text-foreground " +
  "placeholder:text-muted-foreground/60 outline-none transition-colors " +
  "focus:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 " +
  "disabled:opacity-50 disabled:cursor-not-allowed aria-[invalid=true]:border-destructive";

/** Etiqueta en mayúsculas pequeñas, usada sobre cada campo. */
export function Label({ className, ...props }) {
  return <label className={cn("block text-micro font-black uppercase text-muted-foreground ml-1", className)} {...props} />;
}

/** Input de texto de 16 px (evita el zoom automático de iOS) y 44 px de alto. */
export const Input = forwardRef(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(control, className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(control, "appearance-none pr-10", className)} {...props}>
      {children}
    </select>
  );
});

/** Etiqueta + control + ayuda/error, con los `id` y `aria-*` conectados. */
export function Field({ label, ayuda, error, children, className }) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const hijo =
    typeof children === "function"
      ? children({ id, "aria-describedby": ayuda || error ? idAyuda : undefined, "aria-invalid": error ? true : undefined })
      : children;
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {hijo}
      {(error || ayuda) && (
        <p id={idAyuda} className={cn("text-micro ml-1", error ? "text-destructive" : "text-muted-foreground")}>
          {error || ayuda}
        </p>
      )}
    </div>
  );
}
