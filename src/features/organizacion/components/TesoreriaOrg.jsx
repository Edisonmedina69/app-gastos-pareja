import { AdjuntarComprobanteOrg, VerComprobanteOrg } from './ComprobanteOrg';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowLeftRight, Plus, RotateCcw, Wallet } from 'lucide-react';
import { Badge, Button, Field, Input, Modal, Select } from '../../../shared/ui';
import {
  MONEDAS_ORG,
  TIPOS_CUENTA_ORG,
  TIPOS_OPERACION_ORG,
  formatearMonedaOrg,
  parsearImporteOrg,
  validarTasaBaseOrg,
  validarTransferenciaOrg,
} from '../lib/tesoreria';

function generarUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function hoyIso() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function PantallaFormularioOrg({ titulo, descripcion, onVolver, resumen, children }) {
  return (
    <section aria-label={titulo} className="space-y-6">
      <header className="flex items-start gap-3">
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver"
          className="min-h-touch min-w-touch rounded-xl border border-border flex items-center justify-center hover:bg-muted shrink-0"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-title-md font-semibold text-foreground">{titulo}</h2>
          {descripcion && <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{descripcion}</p>}
        </div>
      </header>
      <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-8">{children}</div>
        <aside
          aria-label="Resumen del registro"
          className="rounded-2xl border border-border bg-card p-5 sm:p-6 xl:sticky xl:top-20"
        >
          <h3 className="font-semibold text-foreground mb-3">Resumen</h3>
          {resumen}
          <p className="mt-4 text-xs text-muted-foreground border-t border-border pt-3">
            Los registros se validan y contabilizan en servidor de forma atómica.
          </p>
        </aside>
      </div>
    </section>
  );
}

export function VistaCuentas({
  cuentas,
  puedeCrearCuenta,
  puedeTransferir,
}) {
  const totalesPorMoneda = useMemo(() => {
    const mapa = { PYG: 0, USD: 0, BRL: 0, baseTotal: 0 };
    for (const c of cuentas) {
      if (!c.activa) continue;
      mapa[c.moneda] = (mapa[c.moneda] || 0) + Number(c.saldo || 0);
      mapa.baseTotal += Number(c.saldo_base_historico || 0);
    }
    return mapa;
  }, [cuentas]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-title-md font-semibold text-foreground">Cuentas de tesorería</h2>
          <p className="text-muted-foreground mt-1">
            Todas las cuentas arrancan en cero. El saldo se calcula únicamente desde los apuntes contabilizados.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {puedeTransferir && cuentas.filter(c => c.activa).length >= 2 && (
            <Link
              to="/org/transferencias/nueva"
              className="min-h-touch inline-flex items-center gap-2 px-4 rounded-xl border border-border text-foreground font-semibold hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <ArrowLeftRight size={16} aria-hidden="true" />
              Transferir o cambiar moneda
            </Link>
          )}
          {puedeCrearCuenta && (
            <Link
              to="/org/cuentas/nueva"
              className="min-h-touch inline-flex items-center gap-2 px-4 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
            >
              <Plus size={16} aria-hidden="true" />
              Nueva cuenta
            </Link>
          )}
        </div>
      </div>

      <section
        aria-label="Posición consolidada por moneda"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 border-y border-border py-5"
      >
        <div>
          <p className="text-sm text-muted-foreground">Disponible en PYG</p>
          <p className="text-xl font-bold tabular-nums mt-1">{formatearMonedaOrg(totalesPorMoneda.PYG, 'PYG')}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Disponible en USD</p>
          <p className="text-xl font-bold tabular-nums mt-1">{formatearMonedaOrg(totalesPorMoneda.USD, 'USD')}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Disponible en BRL</p>
          <p className="text-xl font-bold tabular-nums mt-1">{formatearMonedaOrg(totalesPorMoneda.BRL, 'BRL')}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Equivalente histórico base (PYG)</p>
          <p className="text-xl font-bold tabular-nums mt-1">{formatearMonedaOrg(totalesPorMoneda.baseTotal, 'PYG')}</p>
        </div>
      </section>

      {cuentas.length === 0 ? (
        <section className="rounded-2xl border border-border p-8 sm:p-10">
          <Wallet size={28} className="text-primary mb-4" aria-hidden="true" />
          <h3 className="text-lg font-semibold mb-2">Todavía no hay cuentas registradas</h3>
          <p className="text-muted-foreground max-w-prose mb-6">
            Creá las cuentas operativas de banco, billetera, efectivo o las cuentas de custodia empresarial por socio. Todas inician con saldo cero.
          </p>
          {puedeCrearCuenta && (
            <Link
              to="/org/cuentas/nueva"
              className="min-h-touch inline-flex items-center gap-2 px-4 rounded-xl bg-primary text-primary-foreground font-semibold"
            >
              <Plus size={16} aria-hidden="true" />
              Crear primera cuenta
            </Link>
          )}
        </section>
      ) : (
        <>
          <ul className="md:hidden divide-y divide-border rounded-2xl border border-border">
            {cuentas.map(c => (
              <li key={c.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link to={`/org/cuentas/${c.id}`} className="font-semibold text-foreground hover:underline">
                      {c.nombre}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {TIPOS_CUENTA_ORG[c.tipo] || c.tipo}
                      {c.titular_nombre ? ` · ${c.titular_nombre}` : ''}
                      {` · ${c.moneda}`}
                    </p>
                  </div>
                  <p className="font-bold tabular-nums text-right">
                    {formatearMonedaOrg(c.saldo, c.moneda)}
                    {c.moneda !== 'PYG' && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        Base: {formatearMonedaOrg(c.saldo_base_historico, 'PYG')}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    {c.cantidad_movimientos || 0} apuntes
                  </span>
                  <Link
                    to={`/org/cuentas/${c.id}`}
                    className="inline-flex min-h-touch items-center text-sm text-primary underline underline-offset-4"
                  >
                    Ver movimientos
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          <div className="hidden md:block overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
                  <th className="py-3.5 px-4 font-semibold">Cuenta</th>
                  <th className="py-3.5 px-4 font-semibold">Tipo / Titular</th>
                  <th className="py-3.5 px-4 font-semibold">Moneda</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Saldo actual</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Equivalente histórico PYG</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-sm">
                {cuentas.map(c => (
                  <tr key={c.id} className="hover:bg-muted/20">
                    <td className="py-4 px-4 font-semibold text-foreground">
                      <Link to={`/org/cuentas/${c.id}`} className="hover:underline underline-offset-4">
                        {c.nombre}
                      </Link>
                      {c.referencia && <p className="text-xs text-muted-foreground font-normal mt-0.5">{c.referencia}</p>}
                    </td>
                    <td className="py-4 px-4 text-muted-foreground">
                      {TIPOS_CUENTA_ORG[c.tipo] || c.tipo}
                      {c.titular_nombre ? ` · ${c.titular_nombre}` : ''}
                      {!c.activa && <Badge tono="warning" className="ml-2">Inactiva</Badge>}
                    </td>
                    <td className="py-4 px-4 font-medium">{c.moneda}</td>
                    <td className="py-4 px-4 text-right font-semibold tabular-nums">
                      {formatearMonedaOrg(c.saldo, c.moneda)}
                    </td>
                    <td className="py-4 px-4 text-right text-muted-foreground tabular-nums">
                      {formatearMonedaOrg(c.saldo_base_historico, 'PYG')}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <Link
                        to={`/org/cuentas/${c.id}`}
                        className="inline-flex min-h-touch items-center px-3 text-primary underline underline-offset-4"
                      >
                        Ver movimientos ({c.cantidad_movimientos || 0})
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export function PantallaNuevaCuenta({ miembros, alCrear }) {
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState('efectivo');
  const [moneda, setMoneda] = useState('PYG');
  const [titularId, setTitularId] = useState('');
  const [referencia, setReferencia] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const miembrosActivos = useMemo(() => miembros.filter(m => m.activo), [miembros]);

  async function enviar(e) {
    e.preventDefault();
    setError('');
    if (!nombre.trim()) {
      setError('Ingresá el nombre de la cuenta.');
      return;
    }
    if (tipo === 'socio' && !titularId) {
      setError('Seleccioná el socio titular de los fondos en custodia.');
      return;
    }
    setOcupado(true);
    try {
      const id = await alCrear({
        nombre: nombre.trim(),
        tipo,
        moneda,
        titularMiembroId: tipo === 'socio' ? titularId : null,
        referencia: referencia.trim() || null,
      });
      if (id) navigate(`/org/cuentas/${id}`);
      else navigate('/org/cuentas');
    } catch (err) {
      setError(err.message || 'No pudimos crear la cuenta.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <PantallaFormularioOrg
      titulo="Nueva cuenta de organización"
      descripcion="Cada cuenta opera en una sola moneda y arranca con saldo 0. Para cuentas de tipo socio, representa únicamente fondos de la organización bajo custodia de esa persona (nunca su saldo bancario personal)."
      onVolver={() => navigate('/org/cuentas')}
      resumen={
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Cuenta: <strong className="text-foreground">{nombre.trim() || 'Sin nombre'}</strong>
          </p>
          <p className="text-muted-foreground">
            Tipo: <strong className="text-foreground">{TIPOS_CUENTA_ORG[tipo]}</strong>
          </p>
          <p className="text-muted-foreground">
            Moneda: <strong className="text-foreground">{moneda}</strong>
          </p>
          <p className="text-muted-foreground">
            Saldo inicial: <strong className="text-foreground">{formatearMonedaOrg(0, moneda)}</strong> (fijo en cero)
          </p>
        </div>
      }
    >
      <form onSubmit={enviar} className="space-y-6">
        {error && (
          <p role="alert" className="p-4 rounded-xl border border-destructive/30 text-destructive text-sm">
            {error}
          </p>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nombre de la cuenta" ayuda="Ej: Caja operativa PYG, Banco Itaú USD o Custodia Ana PYG.">
            {props => (
              <Input
                {...props}
                name="nombre"
                required
                maxLength={100}
                value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Caja operativa PYG"
              />
            )}
          </Field>
          <Field label="Tipo de cuenta">
            {props => (
              <Select
                {...props}
                name="tipo"
                value={tipo}
                onChange={e => {
                  setTipo(e.target.value);
                  if (e.target.value !== 'socio') setTitularId('');
                }}
              >
                {Object.entries(TIPOS_CUENTA_ORG).map(([clave, etiqueta]) => (
                  <option key={clave} value={clave}>
                    {etiqueta}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Moneda de la cuenta" ayuda="La moneda es inmutable una vez creada la cuenta.">
            {props => (
              <Select {...props} name="moneda" value={moneda} onChange={e => setMoneda(e.target.value)}>
                {MONEDAS_ORG.map(m => (
                  <option key={m} value={m}>
                    {m === 'PYG' ? 'PYG — Guaraní (base)' : m === 'USD' ? 'USD — Dólar estadounidense' : 'BRL — Real brasileño'}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {tipo === 'socio' && (
            <Field label="Socio titular en custodia" ayuda="Obligatorio para cuentas de custodia de socio.">
              {props => (
                <Select
                  {...props}
                  name="titular_miembro_id"
                  required
                  value={titularId}
                  onChange={e => setTitularId(e.target.value)}
                >
                  <option value="">Seleccioná un integrante activo…</option>
                  {miembrosActivos.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
          <Field
            className="md:col-span-2"
            label="Referencia o alias (opcional)"
            ayuda="Número de cuenta, alias o descripción breve (sin contraseñas ni claves)."
          >
            {props => (
              <Input
                {...props}
                name="referencia"
                maxLength={160}
                value={referencia}
                onChange={e => setReferencia(e.target.value)}
                placeholder="Ej: Alias PIX o Nro. de cuenta"
              />
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
          <Button type="submit" cargando={ocupado}>
            Crear cuenta en cero
          </Button>
          <Button variante="secondary" disabled={ocupado} onClick={() => navigate('/org/cuentas')}>
            Cancelar
          </Button>
        </div>
      </form>
    </PantallaFormularioOrg>
  );
}

export function PantallaDetalleCuenta({
  cuenta,
  apuntes,
  operacionesPorId,
  puedeTransferir,
  puedeRevertir,
  alRevertir,
}) {
  const navigate = useNavigate();
  const puedeAnular = [...operacionesPorId.values()].some(puedeRevertir);
  const [revertirOp, setRevertirOp] = useState(null);
  const [motivoReversion, setMotivoReversion] = useState('');
  const [idempotenciaRev, setIdempotenciaRev] = useState(() => generarUuid());
  const [errorRev, setErrorRev] = useState('');
  const [ocupado, setOcupado] = useState(false);

  if (!cuenta) {
    return (
      <section className="space-y-4">
        <p className="text-muted-foreground">La cuenta solicitada no existe o no pertenece a este espacio.</p>
        <Button variante="secondary" onClick={() => navigate('/org/cuentas')}>
          Volver a cuentas
        </Button>
      </section>
    );
  }

  async function confirmarReversion(e) {
    e.preventDefault();
    if (!motivoReversion.trim()) {
      setErrorRev('Ingresá el motivo de la reversión.');
      return;
    }
    setOcupado(true);
    setErrorRev('');
    try {
      await alRevertir({
        idempotencia: idempotenciaRev,
        operacionId: revertirOp.id,
        motivo: motivoReversion.trim(),
      });
      setRevertirOp(null);
      setMotivoReversion('');
      setIdempotenciaRev(generarUuid());
    } catch (err) {
      setErrorRev(err.message || 'No se pudo revertir la operación.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate('/org/cuentas')}
            aria-label="Volver a cuentas"
            className="min-h-touch min-w-touch rounded-xl border border-border flex items-center justify-center hover:bg-muted shrink-0"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-title-md font-semibold text-foreground">{cuenta.nombre}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {TIPOS_CUENTA_ORG[cuenta.tipo] || cuenta.tipo}
              {cuenta.titular_nombre ? ` · Titular: ${cuenta.titular_nombre}` : ''}
              {` · Moneda ${cuenta.moneda}`}
              {cuenta.referencia ? ` · ${cuenta.referencia}` : ''}
            </p>
          </div>
        </div>
        {puedeTransferir && (
          <Link
            to="/org/transferencias/nueva"
            className="min-h-touch inline-flex items-center gap-2 px-4 rounded-xl bg-primary text-primary-foreground font-semibold"
          >
            <ArrowLeftRight size={16} aria-hidden="true" />
            Nueva transferencia
          </Link>
        )}
      </div>

      <section className="grid gap-4 sm:grid-cols-3 border-y border-border py-5">
        <div>
          <p className="text-sm text-muted-foreground">Saldo calculado ({cuenta.moneda})</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{formatearMonedaOrg(cuenta.saldo, cuenta.moneda)}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Equivalente histórico base (PYG)</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{formatearMonedaOrg(cuenta.saldo_base_historico, 'PYG')}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Apuntes contabilizados</p>
          <p className="text-2xl font-bold tabular-nums mt-1">{cuenta.cantidad_movimientos || 0}</p>
        </div>
      </section>

      <section>
        <h3 className="text-lg font-semibold mb-3">Libro de movimientos de la cuenta</h3>
        <p className="text-sm text-muted-foreground mb-5">
          Los apuntes contabilizados son inmutables. Para corregir un asiento se registra una reversión referenciada con su motivo.
        </p>
        {apuntes.length === 0 ? (
          <p className="py-8 text-muted-foreground border-t border-border">
            Esta cuenta aún no registra movimientos. Su saldo parte de 0.
          </p>
        ) : (
          <>
            <ul className="md:hidden divide-y divide-border rounded-2xl border border-border">
              {apuntes.map(a => {
                const op = operacionesPorId.get(a.operacion_id);
                const yaRevertida = op && Array.from(operacionesPorId.values()).some(o => o.reversa_de === op.id);
                const esPositivo = Number(a.importe_firmado) > 0;
                return (
                  <li key={a.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">
                          {TIPOS_OPERACION_ORG[op?.tipo] || op?.tipo || 'Asiento'}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {op?.fecha_efectiva || new Date(a.created_at).toLocaleDateString('es-PY')}
                          {` · Tasa ${Number(a.tasa_base).toLocaleString('es-PY', { maximumFractionDigits: 4 })}`}
                        </p>
                      </div>
                      <p className={`font-bold tabular-nums text-right ${esPositivo ? 'text-success' : 'text-foreground'}`}>
                        {esPositivo ? '+' : ''}
                        {formatearMonedaOrg(a.importe_firmado, cuenta.moneda)}
                        <span className="block text-xs font-normal text-muted-foreground">
                          Base: {esPositivo ? '+' : ''}
                          {formatearMonedaOrg(a.importe_base_firmado, 'PYG')}
                        </span>
                      </p>
                    </div>
                    {op?.motivo && <p className="text-xs text-muted-foreground">{op.motivo}</p>}
                    <div className="flex items-center justify-between pt-1">
                      <div>
                        {yaRevertida && <Badge tono="warning">Revertida</Badge>}
                        {op?.reversa_de && <Badge tono="neutral">Reversa #{String(op.reversa_de).slice(0, 8)}</Badge>}
                      </div>
                      {puedeRevertir(op) && op && op.tipo !== 'reversion' && !yaRevertida && (
                        <Button
                          variante="secondary"
                          tamano="sm"
                          onClick={() => {
                            setErrorRev('');
                            setMotivoReversion('');
                            setIdempotenciaRev(generarUuid());
                            setRevertirOp(op);
                          }}
                        >
                          <RotateCcw size={14} aria-hidden="true" />
                          Revertir
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden md:block overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
                    <th className="py-3.5 px-4 font-semibold">Fecha</th>
                    <th className="py-3.5 px-4 font-semibold">Operación / Motivo</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Importe ({cuenta.moneda})</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Tasa base</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Equivalente base (PYG)</th>
                    {puedeAnular && <th className="py-3.5 px-4 font-semibold text-right">Acción</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {apuntes.map(a => {
                    const op = operacionesPorId.get(a.operacion_id);
                    const yaRevertida = op && Array.from(operacionesPorId.values()).some(o => o.reversa_de === op.id);
                    const esPositivo = Number(a.importe_firmado) > 0;
                    return (
                      <tr key={a.id} className="hover:bg-muted/20">
                        <td className="py-4 px-4 whitespace-nowrap tabular-nums">
                          {op?.fecha_efectiva || new Date(a.created_at).toLocaleDateString('es-PY')}
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-semibold text-foreground">
                            {TIPOS_OPERACION_ORG[op?.tipo] || op?.tipo || 'Asiento'}
                          </span>
                          {yaRevertida && (
                            <Badge tono="warning" className="ml-2">
                              Revertida
                            </Badge>
                          )}
                          {op?.reversa_de && (
                            <Badge tono="neutral" className="ml-2">
                              Reversa #{String(op.reversa_de).slice(0, 8)}
                            </Badge>
                          )}
                          {op?.motivo && <p className="text-xs text-muted-foreground mt-0.5">{op.motivo}</p>}
                        </td>
                        <td
                          className={`py-4 px-4 text-right font-semibold tabular-nums ${
                            esPositivo ? 'text-success' : 'text-foreground'
                          }`}
                        >
                          {esPositivo ? '+' : ''}
                          {formatearMonedaOrg(a.importe_firmado, cuenta.moneda)}
                        </td>
                        <td className="py-4 px-4 text-right text-muted-foreground tabular-nums">
                          {Number(a.tasa_base).toLocaleString('es-PY', { maximumFractionDigits: 4 })}
                        </td>
                        <td className="py-4 px-4 text-right text-muted-foreground tabular-nums">
                          {esPositivo ? '+' : ''}
                          {formatearMonedaOrg(a.importe_base_firmado, 'PYG')}
                        </td>
                        {puedeAnular && (
                          <td className="py-4 px-4 text-right">
                            {puedeRevertir(op) && op && op.tipo !== 'reversion' && !yaRevertida && (
                              <Button
                                variante="secondary"
                                tamano="sm"
                                onClick={() => {
                                  setErrorRev('');
                                  setMotivoReversion('');
                                  setIdempotenciaRev(generarUuid());
                                  setRevertirOp(op);
                                }}
                              >
                                <RotateCcw size={14} aria-hidden="true" />
                                Revertir
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {revertirOp && (
        <Modal titulo="Revertir operación contabilizada" onClose={() => setRevertirOp(null)}>
          <form onSubmit={confirmarReversion} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Se creará un contraasiento referenciado a esta operación ({TIPOS_OPERACION_ORG[revertirOp.tipo] || revertirOp.tipo}) conservando las tasas históricas originales. El registro original no se borra.
            </p>
            {errorRev && (
              <p role="alert" className="p-3 rounded-xl border border-destructive/30 text-destructive text-sm">
                {errorRev}
              </p>
            )}
            <Field label="Motivo de la reversión" ayuda="Obligatorio para la auditoría.">
              {props => (
                <Input
                  {...props}
                  name="motivo_reversion"
                  required
                  maxLength={300}
                  value={motivoReversion}
                  onChange={e => setMotivoReversion(e.target.value)}
                  placeholder="Ej: Monto o cuenta cargada por error"
                />
              )}
            </Field>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button type="submit" variante="destructive" cargando={ocupado}>
                Confirmar reversión
              </Button>
              <Button variante="secondary" disabled={ocupado} onClick={() => setRevertirOp(null)}>
                Cancelar
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

export function PantallaNuevaTransferencia({ cuentas, alTransferir }) {
  const navigate = useNavigate();
  const cuentasActivas = useMemo(() => cuentas.filter(c => c.activa), [cuentas]);
  const [origenId, setOrigenId] = useState(() => cuentasActivas[0]?.id || '');
  const [destinoId, setDestinoId] = useState(() => cuentasActivas[1]?.id || '');
  const [importeOrigen, setImporteOrigen] = useState('');
  const [importeDestino, setImporteDestino] = useState('');
  const [tasaOrigenBase, setTasaOrigenBase] = useState('');
  const [tasaDestinoBase, setTasaDestinoBase] = useState('');
  const [tasaConfirmada, setTasaConfirmada] = useState(false);
  const [fechaEfectiva, setFechaEfectiva] = useState(hoyIso);
  const [motivo, setMotivo] = useState('');
  const [confirmarSaldoInsuficiente, setConfirmarSaldoInsuficiente] = useState(false);
  const [idempotencia] = useState(() => generarUuid());
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cuentaOrigen = cuentasActivas.find(c => c.id === origenId);
  const cuentaDestino = cuentasActivas.find(c => c.id === destinoId);
  const esCambio = cuentaOrigen && cuentaDestino && cuentaOrigen.moneda !== cuentaDestino.moneda;
  const requiereTasaOrigen = cuentaOrigen && cuentaOrigen.moneda !== 'PYG';
  const requiereTasaDestino = cuentaDestino && cuentaDestino.moneda !== 'PYG' && esCambio;

  const impOrigNum = cuentaOrigen ? parsearImporteOrg(importeOrigen, cuentaOrigen.moneda) : NaN;
  const saldoInsuficiente =
    cuentaOrigen && Number.isFinite(impOrigNum) && impOrigNum > 0 && Number(cuentaOrigen.saldo || 0) < impOrigNum;

  async function enviar(e) {
    e.preventDefault();
    setError('');

    if ((requiereTasaOrigen || requiereTasaDestino) && !tasaConfirmada) {
      setError('Confirmá explícitamente la tasa manual en PYG antes de registrar una operación en moneda extranjera.');
      return;
    }

    const validacion = validarTransferenciaOrg({
      cuentaOrigen,
      cuentaDestino,
      importeOrigen,
      importeDestino: esCambio ? importeDestino : importeOrigen,
      tasaOrigenBase: requiereTasaOrigen ? Number(tasaOrigenBase) : 1,
      tasaDestinoBase: requiereTasaDestino
        ? Number(tasaDestinoBase)
        : cuentaDestino?.moneda === 'PYG'
        ? 1
        : Number(tasaOrigenBase),
      confirmarSaldoInsuficiente,
      motivo,
    });

    if (!validacion.valida) {
      setError(validacion.error);
      return;
    }

    setOcupado(true);
    try {
      await alTransferir({
        idempotencia,
        cuentaOrigenId: cuentaOrigen.id,
        cuentaDestinoId: cuentaDestino.id,
        importeOrigen: validacion.importeOrigen,
        importeDestino: validacion.importeDestino,
        fechaEfectiva,
        tasaOrigenBase: validacion.tasaOrigenBase,
        tasaDestinoBase: validacion.tasaDestinoBase,
        fuenteTasa: 'manual_confirmada',
        motivo: motivo.trim() || null,
        confirmarSaldoInsuficiente,
      });
      navigate(`/org/cuentas/${cuentaDestino.id}`);
    } catch (err) {
      setError(err.message || 'No pudimos registrar la transferencia.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <PantallaFormularioOrg
      titulo="Nueva transferencia o cambio de moneda"
      descripcion="Registra dos apuntes de signo opuesto bajo una única operación atómica. Las transferencias internas y cambios de moneda no se contabilizan como ingresos ni como gastos operativos."
      onVolver={() => navigate('/org/cuentas')}
      resumen={
        <div className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Origen:{' '}
            <strong className="text-foreground">
              {cuentaOrigen ? `${cuentaOrigen.nombre} (${cuentaOrigen.moneda})` : '—'}
            </strong>
          </p>
          <p className="text-muted-foreground">
            Destino:{' '}
            <strong className="text-foreground">
              {cuentaDestino ? `${cuentaDestino.nombre} (${cuentaDestino.moneda})` : '—'}
            </strong>
          </p>
          <p className="text-muted-foreground">
            Modalidad:{' '}
            <strong className="text-foreground">
              {esCambio ? `Cambio de moneda (${cuentaOrigen.moneda} → ${cuentaDestino.moneda})` : 'Transferencia misma moneda'}
            </strong>
          </p>
          <p className="text-xs text-muted-foreground pt-2">
            Clave de idempotencia activa: un doble clic o reintento de red no duplicará la operación.
          </p>
        </div>
      }
    >
      <form onSubmit={enviar} className="space-y-6">
        {error && (
          <p role="alert" className="p-4 rounded-xl border border-destructive/30 text-destructive text-sm">
            {error}
          </p>
        )}
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Cuenta de origen (salida)">
            {props => (
              <Select {...props} name="cuenta_origen_id" value={origenId} onChange={e => setOrigenId(e.target.value)}>
                {cuentasActivas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda}) · Disponible: {formatearMonedaOrg(c.saldo, c.moneda)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Cuenta de destino (entrada)">
            {props => (
              <Select {...props} name="cuenta_destino_id" value={destinoId} onChange={e => setDestinoId(e.target.value)}>
                {cuentasActivas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.moneda}) · Disponible: {formatearMonedaOrg(c.saldo, c.moneda)}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field
            label={`Importe de salida (${cuentaOrigen?.moneda || 'PYG'})`}
            ayuda={cuentaOrigen?.moneda === 'PYG' ? 'Sin decimales para PYG.' : 'Hasta 2 decimales.'}
          >
            {props => (
              <Input
                {...props}
                name="importe_origen"
                required
                inputMode="decimal"
                value={importeOrigen}
                onChange={e => setImporteOrigen(e.target.value)}
                placeholder={cuentaOrigen?.moneda === 'PYG' ? 'Ej: 400000' : 'Ej: 100.00'}
              />
            )}
          </Field>

          {esCambio && (
            <Field
              label={`Importe acreditado en destino (${cuentaDestino?.moneda})`}
              ayuda={cuentaDestino?.moneda === 'PYG' ? 'Sin decimales para PYG.' : 'Hasta 2 decimales.'}
            >
              {props => (
                <Input
                  {...props}
                  name="importe_destino"
                  required
                  inputMode="decimal"
                  value={importeDestino}
                  onChange={e => setImporteDestino(e.target.value)}
                  placeholder={cuentaDestino?.moneda === 'PYG' ? 'Ej: 750000' : 'Ej: 100.00'}
                />
              )}
            </Field>
          )}

          {requiereTasaOrigen && (
            <Field
              label={`Tasa manual confirmada (PYG por 1 ${cuentaOrigen.moneda})`}
              ayuda="Obligatoria. Prohibido usar 1 como fallback."
            >
              {props => (
                <Input
                  {...props}
                  name="tasa_origen_base"
                  required
                  inputMode="decimal"
                  value={tasaOrigenBase}
                  onChange={e => setTasaOrigenBase(e.target.value)}
                  placeholder={cuentaOrigen.moneda === 'USD' ? 'Ej: 7500' : 'Ej: 1500'}
                />
              )}
            </Field>
          )}

          {requiereTasaDestino && (
            <Field
              label={`Tasa manual confirmada (PYG por 1 ${cuentaDestino.moneda})`}
              ayuda="Obligatoria. Unidades de PYG por 1 unidad de moneda destino."
            >
              {props => (
                <Input
                  {...props}
                  name="tasa_destino_base"
                  required
                  inputMode="decimal"
                  value={tasaDestinoBase}
                  onChange={e => setTasaDestinoBase(e.target.value)}
                  placeholder={cuentaDestino.moneda === 'USD' ? 'Ej: 7500' : 'Ej: 1500'}
                />
              )}
            </Field>
          )}

          {(requiereTasaOrigen || requiereTasaDestino) && (
            <label className="flex min-h-touch items-center gap-3 text-sm text-foreground md:col-span-2">
              <input
                type="checkbox"
                name="confirmar_tasa_manual"
                checked={tasaConfirmada}
                onChange={e => setTasaConfirmada(e.target.checked)}
                className="w-5 h-5 accent-primary"
              />
              Confirmo que la tasa ingresada en PYG es la tasa real pactada para esta operación.
            </label>
          )}

          <Field label="Fecha efectiva">
            {props => (
              <Input
                {...props}
                name="fecha_efectiva"
                type="date"
                required
                value={fechaEfectiva}
                onChange={e => setFechaEfectiva(e.target.value)}
              />
            )}
          </Field>

          <Field
            label={saldoInsuficiente ? 'Motivo (obligatorio por saldo insuficiente)' : 'Concepto o referencia (opcional)'}
            ayuda="Las comisiones bancarias se registran como gasto separado, nunca como diferencia oculta."
          >
            {props => (
              <Input
                {...props}
                name="motivo"
                maxLength={300}
                required={Boolean(saldoInsuficiente)}
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Ej: Reposición de caja desde custodia o compra de divisas"
              />
            )}
          </Field>

          {saldoInsuficiente && (
            <div
              role="region"
              aria-label="Alerta de saldo insuficiente"
              className="rounded-xl border border-warning/40 bg-warning/10 p-4 space-y-3 md:col-span-2"
            >
              <p className="text-sm font-semibold text-foreground">
                Saldo insuficiente en {cuentaOrigen.nombre} (disponible:{' '}
                {formatearMonedaOrg(cuentaOrigen.saldo, cuentaOrigen.moneda)}).
              </p>
              <label className="flex min-h-touch items-center gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  name="confirmar_saldo_insuficiente"
                  checked={confirmarSaldoInsuficiente}
                  onChange={e => setConfirmarSaldoInsuficiente(e.target.checked)}
                  className="w-5 h-5 accent-primary"
                />
                Autorizo registrar el movimiento con descubierto temporal y dejé constancia del motivo.
              </label>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
          <Button type="submit" cargando={ocupado}>
            Confirmar transferencia
          </Button>
          <Button variante="secondary" disabled={ocupado} onClick={() => navigate('/org/cuentas')}>
            Cancelar
          </Button>
        </div>
      </form>
    </PantallaFormularioOrg>
  );
}

export function VistaSocios({
  espacioId,
  reporteSocios,
  cuentas,
  miembros,
  operaciones,
  movimientosSocios,
  miembroActualId,
  puedePagarGasto,
  puedeOperarSocios,
  puedeRevertir,
  alRegistrarPagoPersonal,
  alRegistrarMovimientoSocio,
  alRevertir,
}) {
  const puedeAnular = operaciones.some(puedeRevertir);
  const [modoFormulario, setModoFormulario] = useState(null); // 'pago_personal' | 'reembolso_socio' | 'retiro_socio'
  const [miembroId, setMiembroId] = useState(miembroActualId || '');
  const [cuentaId, setCuentaId] = useState('');
  const [importe, setImporte] = useState('');
  const [tasaBase, setTasaBase] = useState('');
  const [tasaConfirmada, setTasaConfirmada] = useState(false);
  const [fechaEfectiva, setFechaEfectiva] = useState(hoyIso);
  const [motivo, setMotivo] = useState('');
  const [confirmarSaldo, setConfirmarSaldo] = useState(false);
  const [idempotencia, setIdempotencia] = useState(() => generarUuid());
  const [comprobanteId, setComprobanteId] = useState(null);
  const [errorForm, setErrorForm] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const cuentasSocioElegido = useMemo(
    () => cuentas.filter(c => c.activa && c.tipo === 'socio' && c.titular_miembro_id === miembroId),
    [cuentas, miembroId]
  );
  const cuentasEmpresaActivas = useMemo(() => cuentas.filter(c => c.activa), [cuentas]);
  const cuentaSeleccionada = useMemo(
    () => cuentas.find(c => c.id === cuentaId),
    [cuentas, cuentaId]
  );
  const operacionesPorId = useMemo(() => new Map(operaciones.map(o => [o.id, o])), [operaciones]);
  const miembrosPorId = useMemo(() => new Map(miembros.map(m => [m.id, m])), [miembros]);

  function abrirFormulario(modo, socioPreseleccionado = miembroActualId) {
    const mId = socioPreseleccionado || miembros[0]?.id || '';
    setComprobanteId(null);
    setModoFormulario(modo);
    setMiembroId(mId);
    if (modo === 'pago_personal') {
      const cSocio = cuentas.find(c => c.activa && c.tipo === 'socio' && c.titular_miembro_id === mId);
      setCuentaId(cSocio?.id || '');
    } else {
      const cEmp = cuentas.find(c => c.activa && c.tipo !== 'socio') || cuentas.find(c => c.activa);
      setCuentaId(cEmp?.id || '');
    }
    setImporte('');
    setTasaBase('');
    setTasaConfirmada(false);
    setMotivo('');
    setConfirmarSaldo(false);
    setErrorForm('');
    setIdempotencia(generarUuid());
  }

  async function enviarMovimientoSocio(e) {
    e.preventDefault();
    setErrorForm('');
    if (!cuentaSeleccionada) {
      setErrorForm('Seleccioná una cuenta activa.');
      return;
    }
    const imp = parsearImporteOrg(importe, cuentaSeleccionada.moneda);
    if (!Number.isFinite(imp) || imp <= 0) {
      setErrorForm(`Ingresá un importe válido en ${cuentaSeleccionada.moneda}.`);
      return;
    }
    const requiereTasa = cuentaSeleccionada.moneda !== 'PYG';
    if (requiereTasa && !tasaConfirmada) {
      setErrorForm('Confirmá la tasa manual en PYG antes de continuar.');
      return;
    }
    const valTasa = validarTasaBaseOrg(
      cuentaSeleccionada.moneda,
      requiereTasa ? Number(tasaBase) : 1
    );
    if (!valTasa.valida) {
      setErrorForm(valTasa.error);
      return;
    }
    if (!motivo.trim()) {
      setErrorForm('El concepto o motivo es obligatorio.');
      return;
    }

    if (!comprobanteId) { setErrorForm('Adjuntá y verificá el comprobante antes de confirmar.'); return; }
    if (ocupado) return;
    setOcupado(true);
    try {
      if (modoFormulario === 'pago_personal') {
        await alRegistrarPagoPersonal({
          idempotencia,
          comprobanteId,
          miembroId,
          cuentaSocioId: cuentaSeleccionada.id,
          importe: imp,
          tasaBase: valTasa.tasa,
          fuenteTasa: 'manual_confirmada',
          fechaEfectiva,
          motivo: motivo.trim(),
        });
      } else {
        await alRegistrarMovimientoSocio({
          idempotencia,
          comprobanteId,
          tipo: modoFormulario,
          miembroId,
          cuentaId: cuentaSeleccionada.id,
          importe: imp,
          tasaBase: valTasa.tasa,
          fuenteTasa: 'manual_confirmada',
          fechaEfectiva,
          motivo: motivo.trim(),
          confirmarSaldoInsuficiente: confirmarSaldo,
        });
      }
      setModoFormulario(null);
    } catch (err) {
      setErrorForm(err.message || 'No pudimos registrar la operación del socio.');
    } finally {
      setOcupado(false);
    }
  }

  if (modoFormulario) {
    const titulo =
      modoFormulario === 'pago_personal'
        ? 'Registrar pago con dinero personal del socio'
        : modoFormulario === 'reembolso_socio'
        ? 'Reembolsar deuda al socio desde caja'
        : 'Registrar retiro personal de socio';

    return (
      <PantallaFormularioOrg
        titulo={titulo}
        onVolver={() => setModoFormulario(null)}
        resumen={
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              Operación: <strong className="text-foreground">{titulo}</strong>
            </p>
            <p className="text-muted-foreground">
              Efecto contable:{' '}
              <strong className="text-foreground">
                {modoFormulario === 'pago_personal'
                  ? 'Custodia neta sin cambio (+financiación y −gasto) y aumenta lo que la empresa debe al socio.'
                  : modoFormulario === 'reembolso_socio'
                  ? 'Reduce caja empresarial y reduce lo que la empresa debe al socio, sin repetir gasto.'
                  : 'Reduce caja empresarial y aumenta lo que el socio debe a la empresa.'}
              </strong>
            </p>
          </div>
        }
      >
        <form onSubmit={enviarMovimientoSocio} className="space-y-6">
          {errorForm && (
            <p role="alert" className="p-4 rounded-xl border border-destructive/30 text-destructive text-sm">
              {errorForm}
            </p>
          )}
          <fieldset disabled={ocupado} className="grid gap-5 md:grid-cols-2">
            <Field label="Socio">
              {props => (
                <Select
                  {...props}
                  name="miembro_id"
                  value={miembroId}
                  onChange={e => {
                    const nuevoId = e.target.value;
                    setComprobanteId(null);
                    setMiembroId(nuevoId);
                    if (modoFormulario === 'pago_personal') {
                      const cSocio = cuentas.find(c => c.activa && c.tipo === 'socio' && c.titular_miembro_id === nuevoId);
                      setCuentaId(cSocio?.id || '');
                    }
                  }}
                >
                  {miembros
                    .filter(m => m.activo && (puedeOperarSocios || m.id === miembroActualId))
                    .map(m => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                </Select>
              )}
            </Field>

            <Field
              label={
                modoFormulario === 'pago_personal'
                  ? 'Cuenta de custodia del socio'
                  : 'Cuenta empresarial de salida'
              }
              ayuda={
                modoFormulario === 'pago_personal' && cuentasSocioElegido.length === 0
                  ? 'Este socio aún no tiene una cuenta de tipo socio. Creala primero en Cuentas.'
                  : undefined
              }
            >
              {props => (
                <Select
                  {...props}
                  name="cuenta_id"
                  required
                  value={cuentaId}
                  onChange={e => setCuentaId(e.target.value)}
                >
                  <option value="">Seleccioná una cuenta…</option>
                  {(modoFormulario === 'pago_personal' ? cuentasSocioElegido : cuentasEmpresaActivas).map(c => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.moneda}) · Saldo: {formatearMonedaOrg(c.saldo, c.moneda)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            <Field label={`Importe (${cuentaSeleccionada?.moneda || 'PYG'})`}>
              {props => (
                <Input
                  {...props}
                  name="importe"
                  required
                  inputMode="decimal"
                  value={importe}
                  onChange={e => setImporte(e.target.value)}
                  placeholder={cuentaSeleccionada?.moneda === 'PYG' ? 'Ej: 100000' : 'Ej: 50.00'}
                />
              )}
            </Field>

            <Field label="Fecha efectiva">
              {props => (
                <Input
                  {...props}
                  name="fecha_efectiva"
                  type="date"
                  required
                  value={fechaEfectiva}
                  onChange={e => setFechaEfectiva(e.target.value)}
                />
              )}
            </Field>

            {cuentaSeleccionada && cuentaSeleccionada.moneda !== 'PYG' && (
              <>
                <Field
                  label={`Tasa manual confirmada (PYG por 1 ${cuentaSeleccionada.moneda})`}
                  ayuda="Obligatoria. Prohibido usar 1 como fallback."
                >
                  {props => (
                    <Input
                      {...props}
                      name="tasa_base"
                      required
                      inputMode="decimal"
                      value={tasaBase}
                      onChange={e => setTasaBase(e.target.value)}
                      placeholder="Ej: 7500"
                    />
                  )}
                </Field>
                <label className="flex min-h-touch items-center gap-3 text-sm text-foreground">
                  <input
                    type="checkbox"
                    name="confirmar_tasa_socio"
                    checked={tasaConfirmada}
                    onChange={e => setTasaConfirmada(e.target.checked)}
                    className="w-5 h-5 accent-primary"
                  />
                  Confirmo la tasa manual en PYG para este movimiento.
                </label>
              </>
            )}

            <Field
              className="md:col-span-2"
              label="Concepto o motivo"
              ayuda="Queda registrado en la operación y en la auditoría."
            >
              {props => (
                <Input
                  {...props}
                  name="motivo"
                  required
                  maxLength={300}
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder={
                    modoFormulario === 'pago_personal'
                      ? 'Ej: Pago de multa o trámite con dinero personal'
                      : modoFormulario === 'reembolso_socio'
                      ? 'Ej: Reembolso de gasto pagado por el socio'
                      : 'Ej: Retiro personal a cuenta'
                  }
                />
              )}
            </Field>

            {modoFormulario !== 'pago_personal' && (
              <label className="flex min-h-touch items-center gap-3 text-sm text-muted-foreground md:col-span-2">
                <input
                  type="checkbox"
                  name="confirmar_saldo_insuficiente"
                  checked={confirmarSaldo}
                  onChange={e => setConfirmarSaldo(e.target.checked)}
                  className="w-5 h-5 accent-primary"
                />
                Autorizar excepción si el saldo disponible en la cuenta seleccionada es insuficiente.
              </label>
            )}
          </fieldset>

          <AdjuntarComprobanteOrg key={`${modoFormulario}-${miembroId}-${idempotencia}`}
            espacioId={espacioId} tipo={modoFormulario === 'pago_personal' ? 'financiacion_socio' : modoFormulario}
            miembroId={miembroId} bloqueado={ocupado} alVerificar={setComprobanteId} />
          <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
            <Button type="submit" cargando={ocupado} disabled={!comprobanteId}>
              Confirmar operación
            </Button>
            <Button variante="secondary" disabled={ocupado} onClick={() => setModoFormulario(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      </PantallaFormularioOrg>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-title-md font-semibold text-foreground">Custodia y cuenta corriente de socios</h2>
          <p className="text-muted-foreground mt-1 max-w-3xl">
            Las tres columnas se muestran por separado y sin compensación automática: fondos de la empresa en custodia del socio, lo que la empresa le debe al socio y lo que el socio le debe a la empresa.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {puedePagarGasto && (
            <Button variante="secondary" onClick={() => abrirFormulario('pago_personal')}>
              Pago personal de socio
            </Button>
          )}
          {puedeOperarSocios && (
            <>
              <Button variante="secondary" onClick={() => abrirFormulario('reembolso_socio')}>
                Reembolsar a socio
              </Button>
              <Button variante="primary" onClick={() => abrirFormulario('retiro_socio')}>
                Retiro de socio
              </Button>
            </>
          )}
        </div>
      </div>

      <ul className="md:hidden divide-y divide-border rounded-2xl border border-border">
        {reporteSocios.map(fila => (
          <li key={`${fila.miembro_id}-${fila.moneda}`} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">
                {fila.socio_nombre}
                {!fila.activo && <Badge tono="warning" className="ml-2">Inactivo</Badge>}
              </span>
              <span className="text-xs font-semibold uppercase text-muted-foreground">{fila.moneda}</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Custodia</p>
                <p className="font-semibold tabular-nums mt-0.5">
                  {formatearMonedaOrg(fila.custodia, fila.moneda)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Empresa le debe</p>
                <p className="font-semibold tabular-nums text-warning mt-0.5">
                  {formatearMonedaOrg(fila.empresa_debe_al_socio, fila.moneda)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Socio le debe</p>
                <p className="font-semibold tabular-nums text-primary mt-0.5">
                  {formatearMonedaOrg(fila.socio_debe_a_empresa, fila.moneda)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden md:block overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
              <th className="py-3.5 px-4 font-semibold">Socio</th>
              <th className="py-3.5 px-4 font-semibold">Moneda</th>
              <th className="py-3.5 px-4 font-semibold text-right">Custodia (fondos empresa)</th>
              <th className="py-3.5 px-4 font-semibold text-right">La empresa le debe</th>
              <th className="py-3.5 px-4 font-semibold text-right">El socio le debe</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {reporteSocios.map(fila => (
              <tr key={`${fila.miembro_id}-${fila.moneda}`} className="hover:bg-muted/20">
                <td className="py-4 px-4 font-semibold text-foreground">
                  {fila.socio_nombre}
                  {!fila.activo && <Badge tono="warning" className="ml-2">Inactivo</Badge>}
                </td>
                <td className="py-4 px-4 font-medium">{fila.moneda}</td>
                <td className="py-4 px-4 text-right font-semibold tabular-nums">
                  {formatearMonedaOrg(fila.custodia, fila.moneda)}
                </td>
                <td className="py-4 px-4 text-right font-semibold tabular-nums text-warning">
                  {formatearMonedaOrg(fila.empresa_debe_al_socio, fila.moneda)}
                </td>
                <td className="py-4 px-4 text-right font-semibold tabular-nums text-primary">
                  {formatearMonedaOrg(fila.socio_debe_a_empresa, fila.moneda)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section>
        <h3 className="text-lg font-semibold mb-3">Historial de movimientos de deuda con socios</h3>
        {movimientosSocios.length === 0 ? (
          <p className="py-6 text-muted-foreground border-t border-border">
            No hay préstamos, reembolsos ni retiros registrados todavía. Todos los saldos parten de cero.
          </p>
        ) : (
          <>
            <ul className="md:hidden divide-y divide-border rounded-2xl border border-border">
              {movimientosSocios.map(ms => {
                const op = operacionesPorId.get(ms.operacion_id);
                const socio = miembrosPorId.get(ms.miembro_id);
                const yaRevertida = op && operaciones.some(o => o.reversa_de === op.id);
                const aFavorSocio = Number(ms.importe_deuda_firmado) > 0;
                return (
                  <li key={ms.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">
                          {socio?.nombre || 'Socio'} · <span className="capitalize">{ms.clase}</span>
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {op?.fecha_efectiva || new Date(ms.created_at).toLocaleDateString('es-PY')}
                        </p>
                      </div>
                      <p className="font-bold tabular-nums text-right">
                        {aFavorSocio ? '+' : ''}
                        {formatearMonedaOrg(ms.importe_deuda_firmado, ms.moneda)}
                      </p>
                    </div>
                    <VerComprobanteOrg espacioId={espacioId} adjuntoId={op?.comprobante_id} />
                    {op?.motivo && <p className="text-xs text-muted-foreground">{op.motivo}</p>}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">
                        {aFavorSocio ? 'Empresa debe al socio' : 'Reduce deuda / Socio debe'}
                      </span>
                      {puedeRevertir(op) && op && op.tipo !== 'reversion' && !yaRevertida && (
                        <Button
                          variante="secondary"
                          tamano="sm"
                          onClick={async () => {
                            await alRevertir({
                              idempotencia: generarUuid(),
                              operacionId: op.id,
                              motivo: `Reversión de ${ms.clase}`,
                            });
                          }}
                        >
                          <RotateCcw size={14} aria-hidden="true" />
                          Revertir
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="hidden md:block overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-xs uppercase text-muted-foreground">
                    <th className="py-3.5 px-4 font-semibold">Fecha</th>
                    <th className="py-3.5 px-4 font-semibold">Socio</th>
                    <th className="py-3.5 px-4 font-semibold">Operación / Motivo</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Variación deuda</th>
                    {puedeAnular && <th className="py-3.5 px-4 font-semibold text-right">Acción</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-sm">
                  {movimientosSocios.map(ms => {
                    const op = operacionesPorId.get(ms.operacion_id);
                    const socio = miembrosPorId.get(ms.miembro_id);
                    const yaRevertida = op && operaciones.some(o => o.reversa_de === op.id);
                    const aFavorSocio = Number(ms.importe_deuda_firmado) > 0;
                    return (
                      <tr key={ms.id} className="hover:bg-muted/20">
                        <td className="py-4 px-4 whitespace-nowrap tabular-nums">
                          {op?.fecha_efectiva || new Date(ms.created_at).toLocaleDateString('es-PY')}
                        </td>
                        <td className="py-4 px-4 font-semibold">{socio?.nombre || 'Socio'}</td>
                        <td className="py-4 px-4">
                          <span className="font-medium capitalize">{ms.clase}</span>
                          {yaRevertida && <Badge tono="warning" className="ml-2">Revertida</Badge>}
                          <VerComprobanteOrg espacioId={espacioId} adjuntoId={op?.comprobante_id} />
                    {op?.motivo && <p className="text-xs text-muted-foreground mt-0.5">{op.motivo}</p>}
                        </td>
                        <td className="py-4 px-4 text-right font-semibold tabular-nums">
                          {aFavorSocio ? '+' : ''}
                          {formatearMonedaOrg(ms.importe_deuda_firmado, ms.moneda)}
                          <span className="block text-xs font-normal text-muted-foreground">
                            {aFavorSocio ? 'Empresa debe al socio' : 'Reduce deuda / Socio debe'}
                          </span>
                        </td>
                        {puedeAnular && (
                          <td className="py-4 px-4 text-right">
                            {puedeRevertir(op) && op && op.tipo !== 'reversion' && !yaRevertida && (
                              <Button
                                variante="secondary"
                                tamano="sm"
                                onClick={async () => {
                                  await alRevertir({
                                    idempotencia: generarUuid(),
                                    operacionId: op.id,
                                    motivo: `Reversión de ${ms.clase}`,
                                  });
                                }}
                              >
                                <RotateCcw size={14} aria-hidden="true" />
                                Revertir
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
