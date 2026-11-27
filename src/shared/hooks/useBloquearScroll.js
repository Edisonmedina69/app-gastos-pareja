import { useEffect } from "react";

let bloqueos = 0;

/** Evita que el fondo se desplace mientras haya al menos un modal abierto. */
export function useBloquearScroll(activo = true) {
  useEffect(() => {
    if (!activo) return;
    bloqueos += 1;
    document.body.style.overflow = "hidden";
    return () => {
      bloqueos -= 1;
      if (bloqueos === 0) document.body.style.overflow = "";
    };
  }, [activo]);
}
