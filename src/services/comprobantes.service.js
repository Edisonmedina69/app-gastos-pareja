import { supabase } from './supabaseClient';

export const reservarComprobanteOrg = (espacioId, { tipo, miembroId, nombre, mime, bytes }) =>
  supabase.rpc('reservar_comprobante_org', {
    p_espacio_id_esperado: espacioId, p_tipo: tipo, p_miembro_id: miembroId,
    p_nombre: nombre, p_mime: mime, p_bytes: bytes,
  });

export const subirComprobanteOrg = (reserva, archivo) =>
  supabase.storage.from('org-comprobantes').upload(reserva.object_path, archivo, {
    contentType: reserva.mime, upsert: false, cacheControl: '0',
  });

export const descartarComprobanteOrg = (espacioId, adjuntoId) =>
  supabase.rpc('descartar_comprobante_org', { p_espacio_id_esperado: espacioId, p_adjunto_id: adjuntoId });

export const listarReservasComprobanteOrg = (espacioId, tipo, miembroId) =>
  supabase.rpc('listar_reservas_comprobante_org', { p_espacio_id_esperado: espacioId, p_tipo: tipo, p_miembro_id: miembroId });

export async function procesarComprobanteOrg(espacioId, adjuntoId, accion = 'verificar') {
  const resultado = await supabase.functions.invoke('comprobantes', {
    body: { espacioId, adjuntoId, accion },
  });
  if (resultado.error?.context) {
    const detalle = await resultado.error.context.json().catch(() => null);
    if (detalle?.error) return { data: null, error: new Error(detalle.error) };
  }
  if (resultado.data?.signedPath?.startsWith('/storage/v1/object/sign/')) {
    resultado.data.url = `${import.meta.env.VITE_SUPABASE_URL}${resultado.data.signedPath}`;
  }
  return resultado;
}
