import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2, Copy, Users } from 'lucide-react';
import { Button, Field, Input, Select, Modal } from '../../../shared/ui';
import { actualizarMiembro, crearInvitacion, listarIntegrantes, listarInvitaciones, listarPermisos, revocarInvitacion, salirDeEspacio } from '../../../services/espacios.service';

const roles = { admin: 'Administrador', miembro: 'Miembro', contador: 'Contador', lectura: 'Lectura' };
const recursos = ['finanzas', 'gastos', 'ingresos', 'cuentas', 'socios', 'catalogos', 'recurrencias', 'integrantes'];
const acciones = ['ver', 'crear', 'editar', 'anular', 'pagar', 'cobrar', 'configurar', 'invitar'];
const nombres = { finanzas: 'Finanzas', gastos: 'Gastos', ingresos: 'Ingresos', cuentas: 'Cuentas', socios: 'Socios', catalogos: 'Catálogos', recurrencias: 'Recurrencias', integrantes: 'Integrantes' };

export default function Organizacion({ activo, refrescarEspacios }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [datos, setDatos] = useState({ miembros: [], permisos: [], invitaciones: [] });
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [token, setToken] = useState(null);
  const [confirmar, setConfirmar] = useState(null);
  const esAdmin = activo.membresia.rol_plantilla === 'admin';
  const propios = datos.permisos.filter(p => p.miembro_id === activo.membresia.id);
  const puedeVer = propios.some(p => p.recurso === 'finanzas' && p.accion === 'ver' && p.permitido);
  const puedeInvitar = propios.some(p => p.recurso === 'integrantes' && p.accion === 'invitar' && p.permitido);
  const editando = pathname.match(/^\/org\/integrantes\/([^/]+)$/)?.[1];
  const miembro = datos.miembros.find(m => m.id === editando);
  const invitando = pathname === '/org/invitaciones/nueva';
  const integrantes = pathname === '/org/integrantes';

  const cargar = useCallback(async () => {
    const [miembros, permisos, invitaciones] = await Promise.all([
      listarIntegrantes(activo.id), listarPermisos(activo.id), esAdmin ? listarInvitaciones(activo.id) : Promise.resolve({ data: [] }),
    ]);
    if (miembros.error || permisos.error || invitaciones.error) throw miembros.error || permisos.error || invitaciones.error;
    return { miembros: miembros.data || [], permisos: permisos.data || [], invitaciones: invitaciones.data || [] };
  }, [activo.id, esAdmin]);
  useEffect(() => {
    let vigente = true;
    cargar().then(d => { if (vigente) { setDatos(d); setCargando(false); } }).catch(e => { if (vigente) { setError(e.message); setCargando(false); } });
    return () => { vigente = false; };
  }, [cargar, pathname]);

  async function ejecutar(fn, exito) {
    setOcupado(true); setError(''); setMensaje('');
    try {
      const { error } = await fn();
      if (error) throw error;
      setDatos(await cargar());
      setMensaje(exito);
      return true;
    } catch (e) { setError(e.message); return false; }
    finally { setOcupado(false); }
  }
  async function invitar(e) {
    e.preventDefault();
    const valores = new FormData(e.currentTarget);
    await ejecutar(async () => {
      const r = await crearInvitacion(activo.id, valores.get('rol'), Number(valores.get('usos')));
      if (!r.error) setToken(r.data[0]);
      return r;
    }, 'Invitación creada. Copiá el código o enlace antes de salir de esta pantalla.');
  }
  async function guardarPermisos(e) {
    e.preventDefault();
    const campos = new FormData(e.currentTarget);
    const permisos = recursos.flatMap(recurso => acciones.map(accion => ({ recurso, accion, permitido: campos.has(`${recurso}.${accion}`) })));
    await ejecutar(() => actualizarMiembro(activo.id, miembro.id, { permisos }), 'Permisos guardados. El cambio ya está activo.');
  }
  async function copiar(texto) {
    try { await navigator.clipboard.writeText(texto); setMensaje('Copiado. Compartilo con la persona que vas a invitar.'); }
    catch { setError('No pudimos copiar. Seleccioná el código y copialo manualmente.'); }
  }
  const listaMiembros = <ul className="divide-y divide-border">{datos.miembros.map(m => <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-5">
    <div className="min-w-0"><p className="font-semibold text-foreground break-words">{m.nombre}{m.usuario_id === activo.perfil.id ? ' (vos)' : ''}</p><p className="text-sm text-muted-foreground">{roles[m.rol_plantilla]}{!m.activo && ' · Inactivo'}</p></div>
    {esAdmin && <Link to={`/org/integrantes/${m.id}`} className="inline-flex min-h-touch items-center px-3 text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">Gestionar</Link>}
  </li>)}</ul>;

  return <main className="w-full px-4 py-8 sm:px-8 lg:px-12 max-w-[120rem] mx-auto">
    <header className="flex flex-wrap items-start justify-between gap-5 mb-8"><div className="min-w-0"><h1 className="text-title-lg font-bold text-foreground break-words">{activo.nombre}</h1><p className="text-muted-foreground mt-2">Organización · Guaraní (PYG) · Hasta 10 integrantes</p></div><Building2 className="text-primary shrink-0" size={32} aria-hidden="true" /></header>
    <nav aria-label="Organización" className="flex flex-wrap gap-2 border-b border-border pb-4 mb-8">
      {[['/org/resumen', 'Resumen', pathname === '/org/resumen' || pathname === '/'], ['/org/integrantes', 'Integrantes', pathname.startsWith('/org/integrantes')]].map(([ruta, texto, activa]) => <Link key={ruta} to={ruta} aria-current={activa ? 'page' : undefined} className={`min-h-touch inline-flex items-center px-4 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${activa ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>{texto}</Link>)}
      {puedeInvitar && <Link to="/org/invitaciones/nueva" aria-current={invitando ? 'page' : undefined} className={`min-h-touch inline-flex items-center px-4 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${invitando ? 'bg-primary text-primary-foreground' : 'text-primary hover:bg-muted'}`}>Invitar integrantes</Link>}
    </nav>
    {error && <p role="alert" className="mb-6 p-4 rounded-xl border border-destructive/30 text-destructive">{error}</p>}
    {mensaje && <p role="status" className="mb-6 text-foreground">{mensaje}</p>}
    {cargando ? <p role="status" className="text-muted-foreground">Cargando integrantes y permisos…</p> : invitando ? <section className="max-w-2xl">
      <h2 className="text-title-md font-semibold mb-3">Invitar al equipo</h2><p className="text-muted-foreground mb-7">El código y el enlace permiten unirse durante 7 días. Podés revocarlos en cualquier momento.</p>
      {!puedeInvitar ? <p>No tenés permiso para invitar.</p> : <form onSubmit={invitar} className="space-y-6">
        <Field label="Permisos iniciales">{props => <Select {...props} name="rol" defaultValue="lectura">{Object.entries(roles).filter(([rol]) => esAdmin || rol === 'lectura').map(([rol, texto]) => <option key={rol} value={rol}>{texto}</option>)}</Select>}</Field>
        <Field label="Personas que pueden usar esta invitación" ayuda="Cada aceptación consume un uso.">{props => <Input {...props} name="usos" type="number" min="1" max="10" defaultValue="1" required />}</Field>
        <Button type="submit" cargando={ocupado}>Generar invitación</Button>
      </form>}
      {token && <div className="mt-8 border border-border rounded-xl p-5 space-y-4"><p className="font-semibold">Guardá esta invitación</p><p className="text-sm text-muted-foreground">El código se muestra una sola vez. Vence el {new Date(token.vence_at).toLocaleDateString('es-PY')}.</p><Input aria-label="Código generado" value={token.token} readOnly onFocus={e => e.target.select()} /><div className="flex flex-wrap gap-3"><Button variante="secondary" onClick={() => copiar(token.token)}><Copy size={16} aria-hidden="true" />Copiar código</Button><Button variante="secondary" onClick={() => copiar(`${window.location.origin}/invitacion#token=${token.token}`)}>Copiar enlace</Button></div></div>}
    </section> : editando ? <section className="max-w-6xl">
      {!esAdmin ? <p>Solo administradores pueden gestionar integrantes.</p> : !miembro ? <p>El integrante ya no está disponible.</p> : <>
        <h2 className="text-title-md font-semibold mb-2">Permisos de {miembro.nombre}</h2><p className="text-muted-foreground mb-7">Aplicá una plantilla o ajustá permisos individuales. Los cambios tienen efecto inmediato.</p>
        <div className="flex flex-wrap gap-3 mb-8">{Object.entries(roles).map(([rol, texto]) => <Button key={rol} variante="secondary" disabled={ocupado} onClick={() => setConfirmar({ tipo: 'plantilla', miembro, rol, texto: `Aplicar la plantilla ${texto} a ${miembro.nombre} reemplaza sus permisos actuales.` })}>Aplicar {texto}</Button>)}</div>
        <form key={JSON.stringify(datos.permisos.filter(p => p.miembro_id === miembro.id))} onSubmit={guardarPermisos}>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">{recursos.map(recurso => <fieldset key={recurso} className="border-t border-border pt-4"><legend className="text-lg font-semibold pr-3">{nombres[recurso]}</legend><div className="grid grid-cols-2 gap-x-3">{acciones.map(accion => <label key={accion} className="flex min-h-touch items-center gap-2 text-sm capitalize"><input type="checkbox" name={`${recurso}.${accion}`} className="w-5 h-5 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" defaultChecked={datos.permisos.some(p => p.miembro_id === miembro.id && p.recurso === recurso && p.accion === accion && p.permitido)} />{accion}</label>)}</div></fieldset>)}</div>
          <div className="flex flex-wrap gap-3 mt-8"><Button type="submit" cargando={ocupado}>Guardar permisos</Button><Button variante="secondary" onClick={() => navigate('/org/integrantes')}>Volver a integrantes</Button><Button variante="destructive" disabled={ocupado} onClick={() => setConfirmar({ tipo: 'activo', miembro, texto: `${miembro.activo ? 'Desactivar' : 'Reactivar'} a ${miembro.nombre} en esta organización.` })}>{miembro.activo ? 'Desactivar integrante' : 'Reactivar integrante'}</Button></div>
        </form>
      </>}
    </section> : integrantes ? <div className="grid gap-12 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"><section><h2 className="text-title-md font-semibold mb-3">Integrantes</h2>{listaMiembros}{!puedeVer && !esAdmin && <p className="text-muted-foreground">No tenés acceso al equipo. Pedí al administrador que revise tus permisos.</p>}</section>
      {esAdmin && <section><h2 className="text-title-md font-semibold mb-3">Invitaciones</h2>{datos.invitaciones.length === 0 ? <p className="text-muted-foreground py-5">No hay invitaciones. Generá una para sumar personas.</p> : <ul className="divide-y divide-border">{datos.invitaciones.map(i => <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-5"><div><p className="font-semibold">{roles[i.rol]} · {i.usos}/{i.max_usos} usos</p><p className="text-sm text-muted-foreground">{i.revocada_at ? 'Revocada' : new Date(i.vence_at) <= new Date() ? 'Vencida' : `Vence ${new Date(i.vence_at).toLocaleDateString('es-PY')}`}</p></div>{!i.revocada_at && <Button variante="secondary" disabled={ocupado} onClick={() => setConfirmar({ tipo: 'revocar', id: i.id, texto: 'Revocar esta invitación impide nuevas aceptaciones. Las personas que ya se unieron conservan su membresía.' })}>Revocar</Button>}</li>)}</ul>}</section>}
    </div> : <div className="grid gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="border border-border rounded-2xl px-6 py-10 sm:p-10"><Users size={32} className="text-primary mb-6" aria-hidden="true" /><h2 className="text-title-md font-semibold mb-3">Tu equipo ya tiene un espacio</h2><p className="text-muted-foreground max-w-prose">{puedeVer ? 'Por ahora podés organizar integrantes y permisos. El resumen financiero estará disponible cuando se habilite la tesorería.' : 'Tu membresía está activa. No tenés permiso para ver finanzas; pedí al administrador que revise tus permisos.'}</p>{puedeInvitar && <Link to="/org/invitaciones/nueva" className="inline-flex min-h-touch items-center mt-6 text-primary underline underline-offset-4">Invitar a una persona</Link>}</section>
      <section><h2 className="text-title-md font-semibold mb-3">Integrantes del equipo</h2>{listaMiembros}</section>
    </div>}
    <footer className="mt-12 border-t border-border pt-6"><Button variante="ghost" disabled={ocupado} onClick={() => setConfirmar({ tipo: 'salir', texto: 'Salir de esta organización desactiva solo tu membresía aquí. Tus otros espacios siguen disponibles.' })}>Salir de esta organización</Button></footer>
    {confirmar && <Modal titulo="Confirmar cambio" onClose={() => setConfirmar(null)}><p className="text-muted-foreground mb-6">{confirmar.texto}</p><div className="flex flex-wrap gap-3"><Button variante="destructive" cargando={ocupado} onClick={async () => {
      const cambio = confirmar;
      const ok = await ejecutar(() => cambio.tipo === 'revocar' ? revocarInvitacion(activo.id, cambio.id) : cambio.tipo === 'salir' ? salirDeEspacio(activo.id) : actualizarMiembro(activo.id, cambio.miembro.id, cambio.tipo === 'plantilla' ? { plantilla: cambio.rol } : { activo: !cambio.miembro.activo }), 'Cambio guardado.');
      if (ok) { setConfirmar(null); if (cambio.tipo === 'salir' || cambio.miembro?.id === activo.membresia.id) await refrescarEspacios(); }
    }}>Confirmar</Button><Button variante="secondary" disabled={ocupado} onClick={() => setConfirmar(null)}>Cancelar</Button></div></Modal>}
  </main>;
}
