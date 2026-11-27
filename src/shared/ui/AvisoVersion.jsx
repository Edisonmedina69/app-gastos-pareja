import { useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './Button';

/**
 * Un SW en espera no se activa con una recarga normal: el SW anterior sigue
 * sirviendo su precache y workbox vuelve a emitir `waiting` en cada carga.
 * Por eso se activa explícitamente y se recarga recién cuando ya controla.
 */
function activarVersionEnEspera(registro) {
  const enEspera = registro?.waiting;
  if (!enEspera) return false;
  const sw = navigator.serviceWorker;
  let recargado = false;
  const recargar = () => { if (!recargado) { recargado = true; window.location.reload(); } };
  // Página controlada: cambia el controlador. Página sin control (recarga
  // forzada): no hay controllerchange, alcanza con esperar la activación.
  sw.addEventListener('controllerchange', recargar, { once: true });
  enEspera.addEventListener('statechange', () => {
    if (enEspera.state === 'activated' && !sw.controller) recargar();
  });
  enEspera.postMessage({ type: 'SKIP_WAITING' });
  return true;
}

export default function AvisoVersion() {
  const registroRef = useRef(null);
  const [aplicando, setAplicando] = useState(false);
  const { needRefresh: [hayVersion, setHayVersion] } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return;
      registroRef.current = registro;
      // Al abrir o recargar todavía no hay cambios sin guardar: aplicar la
      // versión pendiente en vez de preguntar en cada carga.
      if (activarVersionEnEspera(registro)) setAplicando(true);
      // Chequear al recuperar conexión y cada hora, incluso con la PWA abierta.
      setInterval(() => { if (navigator.onLine) registro.update().catch(() => {}); }, 60 * 60 * 1000);
      window.addEventListener('online', () => registro.update().catch(() => {}));
    },
  });
  if (!hayVersion || aplicando) return null;
  const recargar = () => {
    setAplicando(true);
    if (!activarVersionEnEspera(registroRef.current)) window.location.reload();
  };
  return <aside role="status" className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] max-w-md rounded-xl border border-border bg-background p-4 shadow-xl">
    <p className="text-foreground font-semibold mb-3">Hay una versión nueva, recargar</p>
    <p className="text-muted-foreground text-sm mb-4">Guardá los cambios antes de recargar.</p>
    <div className="flex gap-3"><Button onClick={recargar}>Recargar</Button><Button variante="secondary" onClick={() => setHayVersion(false)}>Más tarde</Button></div>
  </aside>;
}
