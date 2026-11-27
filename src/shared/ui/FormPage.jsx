import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';

/** Pantalla de formulario: sin fondo modal ni bloqueo del scroll del documento. */
export function FormPage({ children, onClose, ariaLabel = 'Registro', resumen }) {
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus();
    window.scrollTo(0, 0);
  }, []);
  return (
    <section className="form-page w-full max-w-7xl mx-auto" aria-label={ariaLabel}>
      <header className="mb-6 flex items-center gap-3">
        <button type="button" onClick={onClose} aria-label="Volver" className="min-h-touch min-w-touch rounded-xl border border-border flex items-center justify-center hover:bg-white/10"><ArrowLeft size={20} /></button>
        <h1 ref={heading} tabIndex={-1} className="text-title-sm font-black outline-none">{ariaLabel}</h1>
      </header>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="form-page-fields min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6">{children}</div>
        <aside aria-label="Resumen del registro" className="hidden xl:block rounded-2xl border border-border bg-card p-6 xl:sticky xl:top-6">
          <h2 className="font-bold mb-3">Resumen</h2>
          {resumen || <p className="text-sm text-muted-foreground">Revisá los datos y la moneda antes de confirmar el registro.</p>}
          <p className="mt-4 text-sm text-muted-foreground">Los cambios se guardan al confirmar. Podés volver para cancelar.</p>
        </aside>
      </div>
    </section>
  );
}
