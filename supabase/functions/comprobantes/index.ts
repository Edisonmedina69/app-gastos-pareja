import { validarArchivo } from './validar.ts';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const base = Deno.env.get('SUPABASE_URL')!;
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization = req.headers.get('authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Iniciá sesión nuevamente.' }, 401);
    const auth = await fetch(`${base}/auth/v1/user`, { headers: { apikey: anon, authorization } });
    if (!auth.ok) return json({ error: 'Sesión inválida o vencida.' }, 401);
    const user = await auth.json();
    // Auth ya verificó firma y vencimiento; el session_id también se revalida en Postgres.
    const encoded = authorization.slice(7).split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(encoded));
    if (!uuid.test(claims.session_id || '')) return json({ error: 'Sesión inválida.' }, 401);
    const body = await req.json();
    if (!uuid.test(body.espacioId || '') || !uuid.test(body.adjuntoId || '') || !['verificar', 'leer'].includes(body.accion)) {
      return json({ error: 'Solicitud de comprobante inválida.' }, 400);
    }
    const rpc = async (name: string, args: unknown, privileged = false) => {
      const res = await fetch(`${base}/rest/v1/rpc/${name}`, {
        method: 'POST', headers: { apikey: privileged ? service : anon,
          authorization: privileged ? `Bearer ${service}` : authorization,
          'Content-Type': 'application/json', 'x-app-version': '2' },
        body: JSON.stringify(args),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || 'No pudimos autorizar el comprobante.');
      }
      return res.status === 204 ? null : res.json();
    };
    const args = { p_espacio_id_esperado: body.espacioId, p_adjunto_id: body.adjuntoId };
    const reserva = await rpc(body.accion === 'leer' ? 'obtener_lectura_comprobante_org' : 'obtener_reserva_comprobante_org', args);
    const path = reserva.object_path.split('/').map(encodeURIComponent).join('/');
    if (body.accion === 'leer') {
      const res = await fetch(`${base}/storage/v1/object/sign/org-comprobantes/${path}`, {
        method: 'POST', headers: { apikey: service, authorization: `Bearer ${service}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn: 60 }),
      });
      if (!res.ok) throw new Error('El documento no está disponible. Reintentá.');
      const signed = await res.json();
      return json({ signedPath: `/storage/v1${signed.signedURL}`, expiresIn: 60 });
    }
    const res = await fetch(`${base}/storage/v1/object/authenticated/org-comprobantes/${path}`, {
      headers: { apikey: service, authorization: `Bearer ${service}` },
    });
    if (!res.ok || !res.body) throw new Error('La subida no está completa. Reintentá subir o verificar el archivo.');
    // Lectura acotada aunque un metadato o Content-Length fuese falso.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 10485760) { await reader.cancel(); throw new Error('El archivo supera 10 MiB.'); }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
    validarArchivo(bytes, reserva.mime, Number(reserva.bytes));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
    await rpc('confirmar_comprobante_servidor_org', {
      p_espacio: body.espacioId, p_adjunto: body.adjuntoId, p_actor: user.id, p_sesion: claims.session_id,
      p_sha256: sha, p_bytes: size, p_mime: reserva.mime,
    }, true);
    return json({ id: reserva.id, estado: 'listo' });
  } catch (error) {
    // No registrar JWT, URLs, nombres ni contenido financiero.
    return json({ error: error instanceof Error ? error.message : 'No pudimos procesar el comprobante.' }, 400);
  }
});
