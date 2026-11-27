import { useCallback, useEffect, useRef, useState } from 'react';
import { escucharCambiosSesion, obtenerSesion } from '../../../services/auth.service';
import { fijarContextoEspacio, listarMisEspacios, obtenerEspacioActivo, obtenerEspacio, obtenerIdentidad, obtenerMembresia, seleccionarEspacio } from '../../../services/espacios.service';

/** Identidad y contexto viven fuera de cualquier cargador financiero. */
export function useEspacios() {
  const [estado, setEstado] = useState({ session: null, espacios: [], activo: null, cargando: true, error: '' });
  const secuencia = useRef(0);
  const canal = useRef(null);
  const sesionActual = useRef(null);

  const cargar = useCallback(async (session, eleccion) => {
    const numero = ++secuencia.current;
    fijarContextoEspacio(null);
    setEstado(s => ({ ...s, session, activo: null, cargando: true, error: '' }));
    try {
      if (!session) {
        if (numero === secuencia.current) setEstado({ session: null, espacios: [], activo: null, cargando: false, error: '' });
        return;
      }
      if (eleccion) {
        const { error } = await seleccionarEspacio(eleccion);
        if (error) throw error;
      }
      const [lista, contexto, identidad] = await Promise.all([
        listarMisEspacios(), obtenerEspacioActivo(), obtenerIdentidad(session.user.id),
      ]);
      if (lista.error || contexto.error || identidad.error) throw lista.error || contexto.error || identidad.error;
      const espacios = lista.data || [];
      const elegido = espacios.find(e => e.id === contexto.data);
      let activo = null;
      if (elegido) {
        const [detalle, membresias] = await Promise.all([obtenerEspacio(elegido.id), obtenerMembresia(elegido.id)]);
        if (detalle.error || membresias.error) throw detalle.error || membresias.error;
        const membresia = membresias.data?.find(m => m.usuario_id === session.user.id);
        if (membresia) activo = {
          ...elegido, detalle: detalle.data, membresia,
          perfil: identidad.data || { id: session.user.id, nombre: 'Integrante', rol: 'miembro' },
        };
      }
      if (numero !== secuencia.current) return;
      fijarContextoEspacio(activo?.id || null);
      setEstado({ session, espacios, activo, cargando: false, error: '' });
    } catch (e) {
      if (numero === secuencia.current) setEstado(s => ({ ...s, activo: null, cargando: false, error: e.message || 'No pudimos cargar tus espacios. Reintentá.' }));
    }
  }, []);

  useEffect(() => {
    let vigente = true;
    const actualizar = session => {
      if (!vigente) return;
      sesionActual.current = session;
      cargar(session);
    };
    obtenerSesion().then(({ data }) => actualizar(data.session));
    const { data: { subscription } } = escucharCambiosSesion((evento, session) => {
      // No hacer llamadas Supabase dentro del lock de onAuthStateChange.
      if (evento !== 'TOKEN_REFRESHED') setTimeout(() => actualizar(session), 0);
      else sesionActual.current = session;
    });
    canal.current = new BroadcastChannel('nandefinanza-espacio');
    canal.current.onmessage = ({ data }) => {
      if (data.usuario !== sesionActual.current?.user.id) return;
      if (data.tipo === 'cambiando') {
        secuencia.current += 1;
        fijarContextoEspacio(null);
        setEstado(s => ({ ...s, activo: null, cargando: true }));
      } else cargar(sesionActual.current);
    };
    // Revalidar al volver de otra pestaña/dispositivo; sin persistir el ID como autoridad.
    const alVolver = () => { if (document.visibilityState === 'visible') cargar(sesionActual.current); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vigente = false;
      secuencia.current += 1;
      subscription.unsubscribe();
      canal.current.close();
      document.removeEventListener('visibilitychange', alVolver);
      fijarContextoEspacio(null);
    };
  }, [cargar]);

  const seleccionar = useCallback(async id => {
    canal.current?.postMessage({ tipo: 'cambiando', usuario: sesionActual.current?.user.id });
    await cargar(sesionActual.current, id);
    canal.current?.postMessage({ tipo: 'actualizar', usuario: sesionActual.current?.user.id });
  }, [cargar]);
  const refrescar = useCallback(() => cargar(sesionActual.current), [cargar]);
  return { ...estado, seleccionar, refrescar };
}
