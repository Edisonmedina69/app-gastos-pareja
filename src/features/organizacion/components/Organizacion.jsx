import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Building2, Copy, Users, Wallet } from 'lucide-react';
import { Button, Field, Input, Select, Modal } from '../../../shared/ui';
import {
  actualizarMiembro,
  crearInvitacion,
  listarIntegrantes,
  listarInvitaciones,
  listarPermisos,
  revocarInvitacion,
  salirDeEspacio,
  vigenciaContexto,
} from '../../../services/espacios.service';
import {
  crearCuentaOrg,
  listarApuntesCuentaOrg,
  listarMovimientosSociosOrg,
  listarOperacionesOrg,
  listarReporteSociosOrg,
  listarSaldosCuentasOrg,
  registrarMovimientoSocioOrg,
  registrarPagoPersonalSocioOrg,
  revertirOperacionOrg,
  transferirOrg,
} from '../../../services/tesoreria.service';
import { formatearMonedaOrg, puedeRevertirOperacionOrg } from '../lib/tesoreria';
import {
  PantallaDetalleCuenta,
  PantallaNuevaCuenta,
  PantallaNuevaTransferencia,
  VistaCuentas,
  VistaSocios,
} from './TesoreriaOrg';

const roles = { admin: 'Administrador', miembro: 'Miembro', contador: 'Contador', lectura: 'Lectura' };
const recursos = ['finanzas', 'gastos', 'ingresos', 'cuentas', 'socios', 'catalogos', 'recurrencias', 'integrantes'];
const acciones = ['ver', 'crear', 'editar', 'anular', 'pagar', 'cobrar', 'configurar', 'invitar'];
const nombres = {
  finanzas: 'Finanzas',
  gastos: 'Gastos',
  ingresos: 'Ingresos',
  cuentas: 'Cuentas',
  socios: 'Socios',
  catalogos: 'Catálogos',
  recurrencias: 'Recurrencias',
  integrantes: 'Integrantes',
};

export default function Organizacion({ activo, refrescarEspacios }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [datos, setDatos] = useState({
    miembros: [],
    permisos: [],
    invitaciones: [],
    cuentas: [],
    apuntesCuenta: [],
    operaciones: [],
    reporteSocios: [],
    movimientosSocios: [],
  });
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [token, setToken] = useState(null);
  const [confirmar, setConfirmar] = useState(null);

  const esAdmin = activo.membresia.rol_plantilla === 'admin';
  const propios = datos.permisos.filter(p => p.miembro_id === activo.membresia.id);
  const tiene = (recurso, accion) =>
    propios.some(p => p.recurso === recurso && p.accion === accion && p.permitido);

  const puedeVerFinanzas = tiene('finanzas', 'ver');
  const puedeVerCuentas = puedeVerFinanzas && tiene('cuentas', 'ver');
  const puedeCrearCuenta = tiene('cuentas', 'crear');
  const puedeTransferir = tiene('cuentas', 'pagar') && tiene('cuentas', 'cobrar');
  const puedeRevertir = operacion => puedeRevertirOperacionOrg(operacion, propios);
  const puedeVerSocios = puedeVerFinanzas && tiene('socios', 'ver');
  const puedePagarGasto = tiene('gastos', 'pagar');
  const puedeOperarSocios = tiene('cuentas', 'pagar') && tiene('socios', 'pagar');
  const puedeInvitar = tiene('integrantes', 'invitar');

  const editandoMiembroId = pathname.match(/^\/org\/integrantes\/([^/]+)$/)?.[1];
  const miembro = datos.miembros.find(m => m.id === editandoMiembroId);
  const invitando = pathname === '/org/invitaciones/nueva';
  const integrantes = pathname === '/org/integrantes';
  const enCuentas = pathname === '/org/cuentas';
  const enNuevaCuenta = pathname === '/org/cuentas/nueva';
  const cuentaDetalleId =
    !enNuevaCuenta ? pathname.match(/^\/org\/cuentas\/([^/]+)$/)?.[1] : null;
  const enNuevaTransferencia = pathname === '/org/transferencias/nueva';
  const enSocios = pathname === '/org/socios';

  const cargar = useCallback(async () => {
    const esVigente = vigenciaContexto();
    const [miembros, permisos, invitaciones] = await Promise.all([
      listarIntegrantes(activo.id),
      listarPermisos(activo.id),
      esAdmin ? listarInvitaciones(activo.id) : Promise.resolve({ data: [] }),
    ]);
    if (miembros.error || permisos.error || invitaciones.error) {
      throw miembros.error || permisos.error || invitaciones.error;
    }
    const listaPermisos = permisos.data || [];
    const propiosActuales = listaPermisos.filter(p => p.miembro_id === activo.membresia.id);
    const verFin = propiosActuales.some(p => p.recurso === 'finanzas' && p.accion === 'ver' && p.permitido);
    const verCtas = verFin && propiosActuales.some(p => p.recurso === 'cuentas' && p.accion === 'ver' && p.permitido);
    const verSoc = verFin && propiosActuales.some(p => p.recurso === 'socios' && p.accion === 'ver' && p.permitido);

    const [cuentasRes, operacionesRes, sociosRes, movSociosRes, apuntesRes] = await Promise.all([
      verCtas ? listarSaldosCuentasOrg(activo.id) : Promise.resolve({ data: [] }),
      verCtas || verSoc ? listarOperacionesOrg(activo.id) : Promise.resolve({ data: [] }),
      verSoc ? listarReporteSociosOrg(activo.id) : Promise.resolve({ data: [] }),
      verSoc ? listarMovimientosSociosOrg(activo.id) : Promise.resolve({ data: [] }),
      verCtas && cuentaDetalleId ? listarApuntesCuentaOrg(activo.id, cuentaDetalleId) : Promise.resolve({ data: [] }),
    ]);
    const errTesoreria =
      cuentasRes.error || operacionesRes.error || sociosRes.error || movSociosRes.error || apuntesRes.error;
    if (errTesoreria) throw errTesoreria;
    if (!esVigente()) return null;

    return {
      miembros: miembros.data || [],
      permisos: listaPermisos,
      invitaciones: invitaciones.data || [],
      cuentas: cuentasRes.data || [],
      operaciones: operacionesRes.data || [],
      reporteSocios: sociosRes.data || [],
      movimientosSocios: movSociosRes.data || [],
      apuntesCuenta: apuntesRes.data || [],
    };
  }, [activo.id, activo.membresia.id, esAdmin, cuentaDetalleId]);

  useEffect(() => {
    let vigente = true;
    cargar()
      .then(d => {
        if (vigente && d) {
          setDatos(d);
          setCargando(false);
        }
      })
      .catch(e => {
        if (vigente) {
          setError(e.message);
          setCargando(false);
        }
      });
    return () => {
      vigente = false;
    };
  }, [cargar, pathname]);

  async function ejecutar(fn, exito) {
    setOcupado(true);
    setError('');
    setMensaje('');
    try {
      const resultado = await fn();
      if (resultado?.error) throw resultado.error;
      const nuevos = await cargar();
      if (nuevos) setDatos(nuevos);
      if (exito) setMensaje(exito);
      return resultado?.data ?? true;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setOcupado(false);
    }
  }

  async function invitar(e) {
    e.preventDefault();
    const valores = new FormData(e.currentTarget);
    try {
      await ejecutar(async () => {
        const r = await crearInvitacion(activo.id, valores.get('rol'), Number(valores.get('usos')));
        if (!r.error) setToken(r.data[0]);
        return r;
      }, 'Invitación creada. Copiá el código o enlace antes de salir de esta pantalla.');
    } catch {
      /* error ya expuesto en estado */
    }
  }

  async function guardarPermisos(e) {
    e.preventDefault();
    const campos = new FormData(e.currentTarget);
    const permisos = recursos.flatMap(recurso =>
      acciones.map(accion => ({ recurso, accion, permitido: campos.has(`${recurso}.${accion}`) }))
    );
    try {
      await ejecutar(
        () => actualizarMiembro(activo.id, miembro.id, { permisos }),
        'Permisos guardados. El cambio ya está activo.'
      );
    } catch {
      /* error ya expuesto en estado */
    }
  }

  async function copiar(texto) {
    try {
      await navigator.clipboard.writeText(texto);
      setMensaje('Copiado. Compartilo con la persona que vas a invitar.');
    } catch {
      setError('No pudimos copiar. Seleccioná el código y copialo manualmente.');
    }
  }

  const operacionesPorId = useMemo(
    () => new Map(datos.operaciones.map(o => [o.id, o])),
    [datos.operaciones]
  );

  const listaMiembros = (
    <ul className="divide-y divide-border">
      {datos.miembros.map(m => (
        <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-5">
          <div className="min-w-0">
            <p className="font-semibold text-foreground break-words">
              {m.nombre}
              {m.usuario_id === activo.perfil.id ? ' (vos)' : ''}
            </p>
            <p className="text-sm text-muted-foreground">
              {roles[m.rol_plantilla]}
              {!m.activo && ' · Inactivo'}
            </p>
          </div>
          {esAdmin && (
            <Link
              to={`/org/integrantes/${m.id}`}
              className="inline-flex min-h-touch items-center px-3 text-primary underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              Gestionar
            </Link>
          )}
        </li>
      ))}
    </ul>
  );

  const navItems = [
    ['/org/resumen', 'Resumen', pathname === '/org/resumen' || pathname === '/'],
    ...(puedeVerCuentas
      ? [
          [
            '/org/cuentas',
            'Cuentas',
            pathname.startsWith('/org/cuentas') || pathname.startsWith('/org/transferencias'),
          ],
        ]
      : []),
    ...(puedeVerSocios ? [['/org/socios', 'Socios', pathname.startsWith('/org/socios')]] : []),
    ['/org/integrantes', 'Integrantes', pathname.startsWith('/org/integrantes')],
  ];

  return (
    <main className="w-full px-4 py-8 sm:px-8 lg:px-12 max-w-[120rem] mx-auto">
      <header className="flex flex-wrap items-start justify-between gap-5 mb-8">
        <div className="min-w-0">
          <h1 className="text-title-lg font-bold text-foreground break-words">{activo.nombre}</h1>
          <p className="text-muted-foreground mt-2">Organización · Guaraní (PYG) · Hasta 10 integrantes</p>
        </div>
        <Building2 className="text-primary shrink-0" size={32} aria-hidden="true" />
      </header>

      <nav aria-label="Organización" className="flex flex-wrap gap-2 border-b border-border pb-4 mb-8">
        {navItems.map(([ruta, texto, activa]) => (
          <Link
            key={ruta}
            to={ruta}
            aria-current={activa ? 'page' : undefined}
            className={`min-h-touch inline-flex items-center px-4 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
              activa ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {texto}
          </Link>
        ))}
        {puedeInvitar && (
          <Link
            to="/org/invitaciones/nueva"
            aria-current={invitando ? 'page' : undefined}
            className={`min-h-touch inline-flex items-center px-4 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring ${
              invitando ? 'bg-primary text-primary-foreground' : 'text-primary hover:bg-muted'
            }`}
          >
            Invitar integrantes
          </Link>
        )}
      </nav>

      {error && (
        <p role="alert" className="mb-6 p-4 rounded-xl border border-destructive/30 text-destructive">
          {error}
        </p>
      )}
      {mensaje && (
        <p role="status" className="mb-6 text-foreground">
          {mensaje}
        </p>
      )}

      {cargando ? (
        <p role="status" className="text-muted-foreground">
          Cargando organización y tesorería…
        </p>
      ) : enNuevaCuenta ? (
        <PantallaNuevaCuenta
          miembros={datos.miembros}
          alCrear={payload =>
            ejecutar(() => crearCuentaOrg(activo.id, payload), 'Cuenta creada en cero.')
          }
        />
      ) : cuentaDetalleId ? (
        <PantallaDetalleCuenta
          cuenta={datos.cuentas.find(c => c.id === cuentaDetalleId)}
          apuntes={datos.apuntesCuenta}
          operacionesPorId={operacionesPorId}
          puedeTransferir={puedeTransferir}
          puedeRevertir={puedeRevertir}
          alRevertir={payload =>
            ejecutar(() => revertirOperacionOrg(activo.id, payload), 'Operación revertida.')
          }
        />
      ) : enNuevaTransferencia ? (
        <PantallaNuevaTransferencia
          cuentas={datos.cuentas}
          alTransferir={payload =>
            ejecutar(() => transferirOrg(activo.id, payload), 'Transferencia contabilizada.')
          }
        />
      ) : enCuentas ? (
        <VistaCuentas
          cuentas={datos.cuentas}
          puedeCrearCuenta={puedeCrearCuenta}
          puedeTransferir={puedeTransferir}
        />
      ) : enSocios ? (
        <VistaSocios
          reporteSocios={datos.reporteSocios}
          cuentas={datos.cuentas}
          miembros={datos.miembros}
          operaciones={datos.operaciones}
          movimientosSocios={datos.movimientosSocios}
          miembroActualId={activo.membresia.id}
          puedePagarGasto={puedePagarGasto}
          puedeOperarSocios={puedeOperarSocios}
          puedeRevertir={puedeRevertir}
          alRegistrarPagoPersonal={payload =>
            ejecutar(
              () => registrarPagoPersonalSocioOrg(activo.id, payload),
              'Pago personal del socio contabilizado.'
            )
          }
          alRegistrarMovimientoSocio={payload =>
            ejecutar(
              () => registrarMovimientoSocioOrg(activo.id, payload),
              'Movimiento con socio contabilizado.'
            )
          }
          alRevertir={payload =>
            ejecutar(() => revertirOperacionOrg(activo.id, payload), 'Operación revertida.')
          }
        />
      ) : invitando ? (
        <section className="max-w-2xl">
          <h2 className="text-title-md font-semibold mb-3">Invitar al equipo</h2>
          <p className="text-muted-foreground mb-7">
            El código y el enlace permiten unirse durante 7 días. Podés revocarlos en cualquier momento.
          </p>
          {!puedeInvitar ? (
            <p>No tenés permiso para invitar.</p>
          ) : (
            <form onSubmit={invitar} className="space-y-6">
              <Field label="Permisos iniciales">
                {props => (
                  <Select {...props} name="rol" defaultValue="lectura">
                    {Object.entries(roles)
                      .filter(([rol]) => esAdmin || rol === 'lectura')
                      .map(([rol, texto]) => (
                        <option key={rol} value={rol}>
                          {texto}
                        </option>
                      ))}
                  </Select>
                )}
              </Field>
              <Field label="Personas que pueden usar esta invitación" ayuda="Cada aceptación consume un uso.">
                {props => (
                  <Input {...props} name="usos" type="number" min="1" max="10" defaultValue="1" required />
                )}
              </Field>
              <Button type="submit" cargando={ocupado}>
                Generar invitación
              </Button>
            </form>
          )}
          {token && (
            <div className="mt-8 border border-border rounded-xl p-5 space-y-4">
              <p className="font-semibold">Guardá esta invitación</p>
              <p className="text-sm text-muted-foreground">
                El código se muestra una sola vez. Vence el{' '}
                {new Date(token.vence_at).toLocaleDateString('es-PY')}.
              </p>
              <Input
                aria-label="Código generado"
                value={token.token}
                readOnly
                onFocus={e => e.target.select()}
              />
              <div className="flex flex-wrap gap-3">
                <Button variante="secondary" onClick={() => copiar(token.token)}>
                  <Copy size={16} aria-hidden="true" />
                  Copiar código
                </Button>
                <Button
                  variante="secondary"
                  onClick={() => copiar(`${window.location.origin}/invitacion#token=${token.token}`)}
                >
                  Copiar enlace
                </Button>
              </div>
            </div>
          )}
        </section>
      ) : editandoMiembroId ? (
        <section className="max-w-6xl">
          {!esAdmin ? (
            <p>Solo administradores pueden gestionar integrantes.</p>
          ) : !miembro ? (
            <p>El integrante ya no está disponible.</p>
          ) : (
            <>
              <h2 className="text-title-md font-semibold mb-2">Permisos de {miembro.nombre}</h2>
              <p className="text-muted-foreground mb-7">
                Aplicá una plantilla o ajustá permisos individuales. Los cambios tienen efecto inmediato.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                {Object.entries(roles).map(([rol, texto]) => (
                  <Button
                    key={rol}
                    variante="secondary"
                    disabled={ocupado}
                    onClick={() =>
                      setConfirmar({
                        tipo: 'plantilla',
                        miembro,
                        rol,
                        texto: `Aplicar la plantilla ${texto} a ${miembro.nombre} reemplaza sus permisos actuales.`,
                      })
                    }
                  >
                    Aplicar {texto}
                  </Button>
                ))}
              </div>
              <form
                key={JSON.stringify(datos.permisos.filter(p => p.miembro_id === miembro.id))}
                onSubmit={guardarPermisos}
              >
                <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                  {recursos.map(recurso => (
                    <fieldset key={recurso} className="border-t border-border pt-4">
                      <legend className="text-lg font-semibold pr-3">{nombres[recurso]}</legend>
                      <div className="grid grid-cols-2 gap-x-3">
                        {acciones.map(accion => (
                          <label
                            key={accion}
                            className="flex min-h-touch items-center gap-2 text-sm capitalize"
                          >
                            <input
                              type="checkbox"
                              name={`${recurso}.${accion}`}
                              className="w-5 h-5 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                              defaultChecked={datos.permisos.some(
                                p =>
                                  p.miembro_id === miembro.id &&
                                  p.recurso === recurso &&
                                  p.accion === accion &&
                                  p.permitido
                              )}
                            />
                            {accion}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-8">
                  <Button type="submit" cargando={ocupado}>
                    Guardar permisos
                  </Button>
                  <Button variante="secondary" onClick={() => navigate('/org/integrantes')}>
                    Volver a integrantes
                  </Button>
                  <Button
                    variante="destructive"
                    disabled={ocupado}
                    onClick={() =>
                      setConfirmar({
                        tipo: 'activo',
                        miembro,
                        texto: `${miembro.activo ? 'Desactivar' : 'Reactivar'} a ${miembro.nombre} en esta organización.`,
                      })
                    }
                  >
                    {miembro.activo ? 'Desactivar integrante' : 'Reactivar integrante'}
                  </Button>
                </div>
              </form>
            </>
          )}
        </section>
      ) : integrantes ? (
        <div className="grid gap-12 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section>
            <h2 className="text-title-md font-semibold mb-3">Integrantes</h2>
            {listaMiembros}
            {!puedeVerFinanzas && !esAdmin && (
              <p className="text-muted-foreground">
                No tenés acceso al equipo. Pedí al administrador que revise tus permisos.
              </p>
            )}
          </section>
          {esAdmin && (
            <section>
              <h2 className="text-title-md font-semibold mb-3">Invitaciones</h2>
              {datos.invitaciones.length === 0 ? (
                <p className="text-muted-foreground py-5">
                  No hay invitaciones. Generá una para sumar personas.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {datos.invitaciones.map(i => (
                    <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 py-5">
                      <div>
                        <p className="font-semibold">
                          {roles[i.rol]} · {i.usos}/{i.max_usos} usos
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {i.revocada_at
                            ? 'Revocada'
                            : new Date(i.vence_at) <= new Date()
                            ? 'Vencida'
                            : `Vence ${new Date(i.vence_at).toLocaleDateString('es-PY')}`}
                        </p>
                      </div>
                      {!i.revocada_at && (
                        <Button
                          variante="secondary"
                          disabled={ocupado}
                          onClick={() =>
                            setConfirmar({
                              tipo: 'revocar',
                              id: i.id,
                              texto:
                                'Revocar esta invitación impide nuevas aceptaciones. Las personas que ya se unieron conservan su membresía.',
                            })
                          }
                        >
                          Revocar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>
      ) : (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <section className="border border-border rounded-2xl px-6 py-8 sm:p-10 space-y-6">
            <div>
              <Wallet size={32} className="text-primary mb-4" aria-hidden="true" />
              <h2 className="text-title-md font-semibold mb-2">Tesorería y saldos de caja</h2>
              <p className="text-muted-foreground max-w-prose">
                {puedeVerFinanzas
                  ? 'Gestioná cuentas operativas, custodia de socios y transferencias multimoneda PYG/USD/BRL desde cero.'
                  : 'Tu membresía está activa. No tenés permiso para ver finanzas; pedí al administrador que revise tus permisos.'}
              </p>
            </div>
            {puedeVerCuentas && (
              <div className="grid gap-4 sm:grid-cols-3 border-y border-border py-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Cuentas activas</p>
                  <p className="text-xl font-bold tabular-nums mt-1">
                    {datos.cuentas.filter(c => c.activa).length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Caja base histórica</p>
                  <p className="text-xl font-bold tabular-nums mt-1">
                    {formatearMonedaOrg(
                      datos.cuentas
                        .filter(c => c.activa)
                        .reduce((acc, c) => acc + Number(c.saldo_base_historico || 0), 0),
                      'PYG'
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase">Operaciones</p>
                  <p className="text-xl font-bold tabular-nums mt-1">{datos.operaciones.length}</p>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {puedeVerCuentas && (
                <Link
                  to="/org/cuentas"
                  className="min-h-touch inline-flex items-center gap-2 px-4 rounded-xl bg-primary text-primary-foreground font-semibold"
                >
                  <Wallet size={16} aria-hidden="true" />
                  Ver cuentas
                </Link>
              )}
              {puedeTransferir && datos.cuentas.filter(c => c.activa).length >= 2 && (
                <Link
                  to="/org/transferencias/nueva"
                  className="min-h-touch inline-flex items-center gap-2 px-4 rounded-xl border border-border text-foreground font-semibold hover:bg-muted"
                >
                  <ArrowLeftRight size={16} aria-hidden="true" />
                  Transferir
                </Link>
              )}
              {puedeVerSocios && (
                <Link
                  to="/org/socios"
                  className="min-h-touch inline-flex items-center gap-2 px-4 rounded-xl border border-border text-foreground font-semibold hover:bg-muted"
                >
                  <Users size={16} aria-hidden="true" />
                  Reporte de socios
                </Link>
              )}
              {puedeInvitar && (
                <Link
                  to="/org/invitaciones/nueva"
                  className="inline-flex min-h-touch items-center px-3 text-primary underline underline-offset-4"
                >
                  Invitar a una persona
                </Link>
              )}
            </div>
          </section>
          <section>
            <h2 className="text-title-md font-semibold mb-3">Integrantes del equipo</h2>
            {listaMiembros}
          </section>
        </div>
      )}

      <footer className="mt-12 border-t border-border pt-6">
        <Button
          variante="ghost"
          disabled={ocupado}
          onClick={() =>
            setConfirmar({
              tipo: 'salir',
              texto:
                'Salir de esta organización desactiva solo tu membresía aquí. Tus otros espacios siguen disponibles.',
            })
          }
        >
          Salir de esta organización
        </Button>
      </footer>

      {confirmar && (
        <Modal titulo="Confirmar cambio" onClose={() => setConfirmar(null)}>
          <p className="text-muted-foreground mb-6">{confirmar.texto}</p>
          <div className="flex flex-wrap gap-3">
            <Button
              variante="destructive"
              cargando={ocupado}
              onClick={async () => {
                const cambio = confirmar;
                try {
                  await ejecutar(
                    () =>
                      cambio.tipo === 'revocar'
                        ? revocarInvitacion(activo.id, cambio.id)
                        : cambio.tipo === 'salir'
                        ? salirDeEspacio(activo.id)
                        : actualizarMiembro(
                            activo.id,
                            cambio.miembro.id,
                            cambio.tipo === 'plantilla'
                              ? { plantilla: cambio.rol }
                              : { activo: !cambio.miembro.activo }
                          ),
                    'Cambio guardado.'
                  );
                  setConfirmar(null);
                  if (cambio.tipo === 'salir' || cambio.miembro?.id === activo.membresia.id) {
                    await refrescarEspacios();
                  }
                } catch {
                  /* error ya expuesto */
                }
              }}
            >
              Confirmar
            </Button>
            <Button variante="secondary" disabled={ocupado} onClick={() => setConfirmar(null)}>
              Cancelar
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
