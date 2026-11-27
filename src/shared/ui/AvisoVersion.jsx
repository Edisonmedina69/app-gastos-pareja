import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './Button';

export default function AvisoVersion() {
  const { needRefresh: [hayVersion, setHayVersion], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      // Chequear al recuperar conexión y cada hora, incluso con la PWA abierta.
      if (!registro) return;
      setInterval(() => { if (navigator.onLine) registro.update().catch(() => {}); }, 60 * 60 * 1000);
      window.addEventListener('online', () => registro.update().catch(() => {}));
    },
  });
  if (!hayVersion) return null;
  return <aside role="status" className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] max-w-md rounded-xl border border-border bg-background p-4 shadow-xl">
    <p className="text-foreground font-semibold mb-3">Hay una versión nueva, recargar</p>
    <p className="text-muted-foreground text-sm mb-4">Guardá los cambios antes de recargar.</p>
    <div className="flex gap-3"><Button onClick={() => updateServiceWorker(true)}>Recargar</Button><Button variante="secondary" onClick={() => setHayVersion(false)}>Más tarde</Button></div>
  </aside>;
}
