// Auth, RPC, Storage y Edge reales; exclusivamente el stack efímero del runner.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID, createHash } from 'node:crypto';

const [, , localDir, container] = process.argv;
assert(container?.startsWith('supabase_db_etapa3-test-'), 'Solo stack efímero etapa3-test-*');
const status = JSON.parse(execFileSync('npx', ['--yes', 'supabase@3.4.0', 'status', '--workdir', localDir, '-o', 'json'], { encoding: 'utf8' }));
const base = status.API_URL, anon = status.ANON_KEY, service = status.SERVICE_ROLE_KEY;
assert(base.startsWith('http://127.0.0.1:55521'));
const sql = query => execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'], { input: query, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
async function req(path, token, body, method = 'POST', more = {}) {
  const r = await fetch(`${base}${path}`, { method, headers: { apikey: anon, authorization: `Bearer ${token}`, 'x-app-version': '2', 'Content-Type': 'application/json', ...more }, body: body === undefined ? undefined : (body instanceof Uint8Array ? body : JSON.stringify(body)) });
  const raw = await r.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = raw; }
  return { ok: r.ok, data, status: r.status };
}
const must = r => { assert(r.ok, JSON.stringify(r.data)); return r.data; };
const fail = r => { assert(!r.ok || r.data?.error, `Se aceptó una solicitud inválida: ${r.status}`); };
const rpc = (user, name, body) => req(`/rest/v1/rpc/${name}`, user.token, body);
const pdf = new TextEncoder().encode('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF\n');
const png = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jC1sAAAAASUVORK5CYII=', 'base64'));
const corrida = randomUUID().slice(0, 8);
let checks = 0;
const ok = msg => { checks++; console.log(`OK comprobantes: ${msg}`); };
async function usuario(n) {
  const email = `comprobante-${n}-${corrida}@example.invalid`, password = 'solo-qa-comprobantes-123';
  const u = must(await req('/auth/v1/admin/users', service, { email, password, email_confirm: true }, 'POST', { apikey: service }));
  sql(`insert into public.perfiles(id,nombre) values('${u.id}','Comprobantes ${n}') on conflict(id) do update set nombre=excluded.nombre; insert into public.org_piloto_usuarios values('${u.id}');`);
  const login = must(await req('/auth/v1/token?grant_type=password', anon, { email, password }));
  return { id: u.id, token: login.access_token };
}
async function org(user, name) {
  user.org = must(await rpc(user, 'crear_organizacion', { p_nombre: name, p_version: 2 }));
  must(await rpc(user, 'seleccionar_espacio', { p_espacio_id: user.org }));
  user.miembro = sql(`select id from public.espacio_miembros where usuario_id='${user.id}' and espacio_id='${user.org}';`);
}
const ana = await usuario('ana'), otro = await usuario('otro'), lector = await usuario('lector');
await org(ana, 'Comprobantes A QA'); await org(otro, 'Comprobantes B QA');
const inv = must(await rpc(ana, 'crear_invitacion_org', { p_espacio_id_esperado: ana.org, p_rol: 'lectura', p_max_usos: 1 }));
const invitacion = Array.isArray(inv) ? inv[0] : inv;
must(await rpc(lector, 'aceptar_invitacion_org', { p_token: invitacion.token, p_version: 2 }));
must(await rpc(lector, 'seleccionar_espacio', { p_espacio_id: ana.org }));
lector.org = ana.org;
lector.miembro = sql(`select id from public.espacio_miembros where usuario_id='${lector.id}' and espacio_id='${ana.org}';`);
const cuenta = must(await rpc(ana, 'crear_cuenta_org', { p_espacio_id_esperado: ana.org, p_nombre: 'Custodia comprobantes', p_tipo: 'socio', p_moneda: 'PYG', p_titular_miembro_id: ana.miembro }));
const caja = must(await rpc(ana, 'crear_cuenta_org', { p_espacio_id_esperado: ana.org, p_nombre: 'Caja comprobantes', p_tipo: 'efectivo', p_moneda: 'PYG' }));
const reserva = async (user = ana, tipo = 'financiacion_socio', extra = {}) => must(await rpc(user, 'reservar_comprobante_org', {
  p_espacio_id_esperado: user.org, p_tipo: tipo, p_miembro_id: user.miembro,
  p_nombre: '../../Recibo <privado>.pdf', p_mime: 'application/pdf', p_bytes: pdf.length, ...extra,
}));
const subir = (r, bytes = pdf, user = ana, extra = {}) => req(`/storage/v1/object/org-comprobantes/${r.object_path}`, user.token, bytes, 'POST', { 'Content-Type': r.mime, ...extra });
const edge = (user, r, accion = 'verificar') => req('/functions/v1/comprobantes', user.token, { espacioId: user.org, adjuntoId: r.id, accion });
const pago = (r, key = randomUUID(), extra = {}, user = ana) => rpc(user, 'registrar_pago_personal_socio_org', {
  p_espacio_id_esperado: user.org, p_idempotencia: key, p_miembro_id: user.miembro,
  p_cuenta_socio_id: cuenta, p_importe: 100, p_comprobante_id: r?.id ?? null,
  p_tasa_base: 1, p_fuente_tasa: 'manual_confirmada', p_fecha_efectiva: '2026-11-27', p_motivo: 'Pago personal QA', ...extra,
});
const cantidad = () => sql(`select count(*) from public.org_operaciones where espacio_id='${ana.org}';`);

fail(await pago(null));
fail(await rpc(ana, 'registrar_pago_personal_socio_org', { p_espacio_id_esperado: ana.org, p_idempotencia: randomUUID(), p_miembro_id: ana.miembro, p_cuenta_socio_id: cuenta, p_importe: 100 }));
assert.equal(cantidad(), '0'); ok('RPC sin comprobante y firma anterior rechazan sin mover dinero');
const vacio = await reserva(); fail(await pago(vacio)); fail(await edge(ana, vacio)); assert.equal(cantidad(), '0');
ok('reserva sin objeto no se verifica ni consume');
fail(await req(`/storage/v1/object/org-comprobantes/${ana.org}/tesoreria/${randomUUID()}.pdf`, ana.token, pdf, 'POST', { 'Content-Type': 'application/pdf' }));
fail(await subir(vacio, pdf, otro));
fail(await rpc(lector, 'reservar_comprobante_org', { p_espacio_id_esperado: ana.org, p_tipo: 'financiacion_socio', p_miembro_id: lector.miembro, p_nombre: 'x.pdf', p_mime: 'application/pdf', p_bytes: pdf.length }));
ok('Storage RLS exige reserva propia y permiso efectivo');

const falso = await reserva(); must(await subir(falso, new Uint8Array(pdf.length).fill(65)));
fail(await edge(ana, falso)); fail(await pago(falso));
const truncado = await reserva(ana, 'financiacion_socio', { p_bytes: pdf.length - 8 }); must(await subir(truncado, pdf.slice(0, -8))); fail(await edge(ana, truncado));
const tamanoFalso = await reserva(ana, 'financiacion_socio', { p_bytes: pdf.length + 1 }); must(await subir(tamanoFalso)); fail(await edge(ana, tamanoFalso));
fail(await reservaRechazada(10485761));
async function reservaRechazada(size) { return rpc(ana, 'reservar_comprobante_org', { p_espacio_id_esperado: ana.org, p_tipo: 'financiacion_socio', p_miembro_id: ana.miembro, p_nombre: 'grande.pdf', p_mime: 'application/pdf', p_bytes: size }); }
const grande = await reserva(); fail(await subir(grande, new Uint8Array(10485761)));
assert.equal(cantidad(), '0'); ok('contenido falso, truncado, tamaño declarado falso y >10 MiB rechazados');

fail(await req('/rest/v1/org_adjuntos', ana.token, { ...vacio, estado: 'listo', sha256: 'a'.repeat(64) }));
fail(await req(`/rest/v1/org_adjuntos?id=eq.${vacio.id}`, ana.token, { estado: 'listo' }, 'PATCH'));
fail(await rpc(ana, 'confirmar_comprobante_servidor_org', { p_espacio: ana.org, p_adjunto: vacio.id, p_actor: ana.id, p_sesion: ana.id, p_sha256: 'a'.repeat(64), p_bytes: pdf.length, p_mime: 'application/pdf' }));
ok('cliente no puede falsificar estado, hash ni confirmación del servidor');

const documento = await reserva(); must(await subir(documento)); must(await edge(ana, documento));
const guardado = sql(`select estado||':'||sha256 from public.org_adjuntos where id='${documento.id}';`);
assert.equal(guardado, `listo:${createHash('sha256').update(pdf).digest('hex')}`);
const extranjero = await reserva(otro); must(await subir(extranjero, pdf, otro)); must(await edge(otro, extranjero));
fail(await pago(extranjero)); fail(await edge(otro, documento));
ok('descarga real verificada por hash y cruce entre espacios rechazado');

// Cambio de contexto entre subida y confirmación; la reserva sigue recuperable al volver.
const hogar = must(await rpc(ana, 'crear_espacio', { p_nombre_espacio: 'Hogar comprobantes QA' }));
must(await rpc(ana, 'seleccionar_espacio', { p_espacio_id: hogar }));
fail(await edge(ana, documento)); fail(await pago(documento));
must(await rpc(ana, 'seleccionar_espacio', { p_espacio_id: ana.org })); must(await edge(ana, documento));
ok('cambiar de espacio interrumpe confirmación; volver permite retomar');

// Fallo económico posterior al consumo provisional: transacción revierte también la reserva.
fail(await pago(documento, randomUUID(), { p_importe: -1 }));
assert.equal(sql(`select estado from public.org_adjuntos where id='${documento.id}';`), 'listo'); assert.equal(cantidad(), '0');
const key = randomUUID(); const doble = await Promise.all([pago(documento, key), pago(documento, key)]);
assert.equal(must(doble[0]), must(doble[1])); assert.equal(cantidad(), '1');
fail(await pago(documento)); fail(await pago(documento, key, { p_importe: 101 }));
assert.equal(must(await pago(documento, key)), doble[0].data);
ok('fallo SQL deja listo; doble envío concurrente contabiliza una vez; reuso y cambio de contenido rechazan');

const docCarrera = await reserva(); must(await subir(docCarrera)); must(await edge(ana, docCarrera));
const carrera = await Promise.all([pago(docCarrera), pago(docCarrera)]);
assert.equal(carrera.filter(x => x.ok).length, 1); assert.equal(cantidad(), '2');
ok('dos claves concurrentes no pueden consumir el mismo comprobante');

const consulta = must(await edge(lector, documento, 'leer')); assert.equal(consulta.expiresIn, 60);
const lectura = await fetch(base + consulta.signedPath); assert(lectura.ok); assert.deepEqual(new Uint8Array(await lectura.arrayBuffer()), pdf);
fail(await edge(otro, documento, 'leer'));
const publica = await fetch(`${base}/storage/v1/object/public/org-comprobantes/${documento.object_path}`); assert(!publica.ok);
fail(await req(`/storage/v1/object/sign/org-comprobantes/${documento.object_path}`, ana.token, { expiresIn: 999999 }));
ok('lectura autorizada con enlace de 60 s; público, otro espacio y firma directa denegados');

fail(await req(`/storage/v1/object/org-comprobantes/${documento.object_path}`, ana.token, pdf, 'PUT', { 'Content-Type': 'application/pdf' }));
fail(await subir(documento, pdf, ana, { 'x-upsert': 'true' }));
await req('/storage/v1/object/org-comprobantes', ana.token, { prefixes: [documento.object_path] }, 'DELETE');
fail(await rpc(ana, 'descartar_comprobante_org', { p_espacio_id_esperado: ana.org, p_adjunto_id: documento.id }));
for (const query of [
  `delete from storage.objects where bucket_id='org-comprobantes' and name='${documento.object_path}'`,
  `update storage.objects set metadata='{}' where bucket_id='org-comprobantes' and name='${documento.object_path}'`,
  `delete from public.org_adjuntos where id='${documento.id}'`,
  `update public.org_adjuntos set estado='listo' where id='${documento.id}'`,
]) assert.throws(() => sql(query));
const intacto = must(await edge(ana, documento, 'leer')); assert.deepEqual(new Uint8Array(await (await fetch(base + intacto.signedPath)).arrayBuffer()), pdf);
ok('consumido conserva bytes y metadatos frente a borrado, upsert, sustitución y SQL privilegiado');

for (const tipo of ['reembolso_socio', 'retiro_socio']) {
  const r = await reserva(ana, tipo, tipo === 'retiro_socio' ? { p_mime: 'image/png', p_bytes: png.length } : {});
  must(await subir(r, tipo === 'retiro_socio' ? png : pdf)); must(await edge(ana, r));
  const args = { p_espacio_id_esperado: ana.org, p_idempotencia: randomUUID(), p_tipo: tipo, p_miembro_id: ana.miembro, p_cuenta_id: caja, p_importe: 20, p_comprobante_id: r.id, p_tasa_base: 1, p_motivo: 'Salida QA', p_confirmar_saldo_insuficiente: true };
  const id = must(await rpc(ana, 'registrar_movimiento_socio_org', args));
  assert.equal(must(await rpc(ana, 'registrar_movimiento_socio_org', args)), id);
}
assert.equal(sql(`select sum(importe_deuda_firmado) from public.org_movimientos_socios where espacio_id='${ana.org}';`), '160.000000');
assert.equal(sql(`select sum(importe_firmado) from public.org_apuntes where espacio_id='${ana.org}' and cuenta_id='${cuenta}';`), '0.000000');
ok('pago, reembolso PDF y retiro PNG exitosos, idempotentes y conciliados');

must(await rpc(ana, 'revertir_org', { p_espacio_id_esperado: ana.org, p_idempotencia: randomUUID(), p_operacion_id: doble[0].data, p_motivo: 'Reversión QA' }));
assert.equal(sql(`select estado from public.org_adjuntos where id='${documento.id}';`), 'consumido');
must(await edge(ana, documento, 'leer')); fail(await pago(documento));
ok('reversión conserva el comprobante y no lo libera para reutilizar');

const revocado = await reserva(); must(await subir(revocado));
sql(`update public.miembro_permisos set permitido=false where miembro_id='${ana.miembro}' and recurso='gastos' and accion='pagar';`);
fail(await edge(ana, revocado)); fail(await pago(documento, key));
sql(`update public.miembro_permisos set permitido=true where miembro_id='${ana.miembro}' and recurso='gastos' and accion='pagar';`);
must(await edge(ana, revocado));
sql(`update public.miembro_permisos set permitido=false where miembro_id='${lector.miembro}' and recurso='finanzas' and accion='ver';`);
fail(await edge(lector, documento, 'leer'));
sql(`update public.miembro_permisos set permitido=true where miembro_id='${lector.miembro}' and recurso='finanzas' and accion='ver';`);
sql(`update public.espacio_miembros set activo=false where id='${lector.miembro}';`);
fail(await edge(lector, documento, 'leer'));
ok('revocación de permiso afecta confirmación, reintento y lectura; baja deniega lectura nueva');

const descartable = await reserva(); must(await subir(descartable)); must(await edge(ana, descartable));
must(await rpc(ana, 'descartar_comprobante_org', { p_espacio_id_esperado: ana.org, p_adjunto_id: descartable.id }));
fail(await edge(ana, descartable)); fail(await pago(descartable));
const borrado = await req('/storage/v1/object/org-comprobantes', service, { prefixes: [descartable.object_path] }, 'DELETE', { apikey: service }); must(borrado);
ok('descartar primero cierra consumo y permite limpieza privilegiada solo del objeto descartado');

const carreraA = await reserva(), carreraB = await reserva();
for (const r of [carreraA, carreraB]) { must(await subir(r)); must(await edge(ana, r)); }
const session = JSON.parse(Buffer.from(ana.token.split('.')[1], 'base64url')).session_id;
execFileSync('python3', ['supabase/tests/comprobantes_concurrencia.py', container, ana.org, ana.id, session, ana.miembro, cuenta, carreraA.id, carreraB.id], { stdio: 'inherit' });
ok('carreras de consumo contra descarte/limpieza preservan atomicidad en ambos órdenes');

const viejoId = randomUUID();
sql(`insert into public.org_adjuntos(id,espacio_id,tipo_operacion,miembro_id,object_path,nombre_original,mime,bytes,subido_por,created_at)
  values('${viejoId}','${ana.org}','financiacion_socio','${ana.miembro}','${ana.org}/tesoreria/${viejoId}.pdf','Viejo QA.pdf','application/pdf',${pdf.length},'${ana.id}',now()-interval '25 hours')`);
fail(await rpc(ana, 'descartar_reservas_vencidas_org', { p_limite: 100 }));
const limpiados = must(await req('/rest/v1/rpc/descartar_reservas_vencidas_org', service, { p_limite: 100 }, 'POST', { apikey: service }));
assert(limpiados.some(r => r.adjunto_id === viejoId));
assert(!limpiados.some(r => [documento.id, revocado.id].includes(r.adjunto_id)));
assert.equal(sql(`select estado from public.org_adjuntos where id='${viejoId}'`), 'descartado');
ok('limpieza exclusiva servidor descarta solo vencidos de 24 h sin tocar consumidos ni reservas vigentes');

await req('/auth/v1/logout?scope=global', ana.token, undefined);
fail(await edge(ana, revocado));
ok('sesión cerrada no verifica comprobantes aunque conserve JWT');
console.log(`OK: ${checks} grupos de pruebas reales Auth/Storage/RLS/Edge, sin producción.`);
