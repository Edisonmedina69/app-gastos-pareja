import { useEffect, useRef, useState } from 'react';
import { Button, Field, Input, Select } from '../../../shared/ui';
import { descartarComprobanteOrg, listarReservasComprobanteOrg, procesarComprobanteOrg, reservarComprobanteOrg, subirComprobanteOrg } from '../../../services/comprobantes.service';
import { vigenciaContexto } from '../../../services/espacios.service';

export function AdjuntarComprobanteOrg({ espacioId, tipo, miembroId, bloqueado, alVerificar }) {
  const [archivo, setArchivo] = useState(null);
  const [reserva, setReserva] = useState(null);
  const [reservas, setReservas] = useState([]);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const enCurso = useRef(false);
  const montado = useRef(true);
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
  useEffect(() => {
    let vigente = true;
    listarReservasComprobanteOrg(espacioId, tipo, miembroId).then(r => {
      if (vigente && !r.error) setReservas(r.data || []);
    });
    return () => { vigente = false; };
  }, [espacioId, tipo, miembroId]);
  const ocupado = estado === 'Reservando…' || estado === 'Subiendo…' || estado === 'Verificando…';

  async function preparar() {
    if ((!archivo && !reserva) || enCurso.current) return;
    enCurso.current = true;
    const contextoVigente = vigenciaContexto();
    const vigente = () => montado.current && contextoVigente();
    setError('');
    try {
      if (archivo && (!['application/pdf', 'image/jpeg', 'image/png'].includes(archivo.type) || archivo.size < 1 || archivo.size > 10485760)) {
        throw new Error('Elegí un PDF, JPG o PNG de hasta 10 MiB.');
      }
      let actual = reserva;
      if (!actual) {
        setEstado('Reservando…');
        const r = await reservarComprobanteOrg(espacioId, { tipo, miembroId, nombre: archivo.name, mime: archivo.type, bytes: archivo.size });
        if (r.error) throw r.error;
        if (!vigente()) return;
        actual = r.data;
        setReserva(actual);
      }
      setEstado('Subiendo…');
      const subida = archivo ? await subirComprobanteOrg(actual, archivo) : {};
      if (!vigente()) return;
      // Si se perdió el acuse de subida, verificar el objeto existente permite retomar sin sobrescribir.
      setEstado('Verificando…');
      const verificado = await procesarComprobanteOrg(espacioId, actual.id);
      if (!vigente()) return;
      if (verificado.error) throw verificado.error;
      if (!verificado.data?.id) throw subida.error || new Error('No pudimos verificar el archivo. Reintentá.');
      setEstado('Comprobante verificado');
      alVerificar(actual.id);
    } catch (err) {
      if (vigente()) { setError(err.message || 'Falló la subida. Reintentá con el mismo archivo.'); setEstado(''); }
    } finally { enCurso.current = false; }
  }

  async function cambiarArchivo(e) {
    const nuevo = e.target.files?.[0] || null;
    alVerificar(null);
    setError('');
    setEstado('');
    setArchivo(nuevo);
    const anterior = reserva;
    setReserva(null);
    if (anterior) {
      const r = await descartarComprobanteOrg(espacioId, anterior.id);
      if (r.error && montado.current) setError('No se pudo descartar la reserva anterior. Conservamos su archivo; podés continuar con el nuevo.');
    }
  }

  async function descartar() {
    if (!reserva || enCurso.current) return;
    const r = await descartarComprobanteOrg(espacioId, reserva.id);
    if (r.error) { setError(r.error.message); return; }
    setReservas(lista => lista.filter(item => item.id !== reserva.id));
    setReserva(null); setArchivo(null); setEstado(''); setError(''); alVerificar(null);
  }

  return <div className="space-y-3 min-w-0">
    {reservas.length > 0 && <Field label="Retomar un comprobante pendiente" ayuda="Recuperá una subida anterior. Si el archivo no llegó a subirse, elegilo de nuevo debajo.">
      {props => <Select {...props} value={reserva?.id || ''} disabled={bloqueado || ocupado} onChange={e => {
        setReserva(reservas.find(r => r.id === e.target.value) || null);
        setArchivo(null); setEstado(''); setError(''); alVerificar(null);
      }}>
        <option value="">Adjuntar un archivo nuevo</option>
        {reservas.map(r => <option key={r.id} value={r.id}>{r.nombre_original} · {r.estado === 'listo' ? 'Verificado' : 'Pendiente'}</option>)}
      </Select>}
    </Field>}
    <Field label="Comprobante obligatorio" ayuda="PDF, JPG o PNG · hasta 10 MiB. Se conserva junto a la operación.">
      {props => <Input {...props} type="file" name="comprobante" accept="application/pdf,image/jpeg,image/png"
        disabled={bloqueado || ocupado} onChange={cambiarArchivo} />}
    </Field>
    <Button variante="secondary" disabled={(!archivo && !reserva) || bloqueado || ocupado || estado === 'Comprobante verificado'} onClick={preparar}>
      {ocupado ? estado : error ? 'Reintentar subida y verificación' : !archivo && reserva ? 'Verificar comprobante reservado' : 'Subir y verificar comprobante'}
    </Button>
    {reserva && <Button variante="secondary" disabled={bloqueado || ocupado} onClick={descartar}>Descartar comprobante pendiente</Button>}
    {estado && <p role="status" className="text-sm text-muted-foreground">{estado}</p>}
    {error && <p role="alert" className="text-sm text-destructive break-words">{error}</p>}
  </div>;
}

export function VerComprobanteOrg({ espacioId, adjuntoId }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (url) { const timer = setTimeout(() => setUrl(''), 55000); return () => clearTimeout(timer); } }, [url]);
  if (!adjuntoId) return null;
  async function abrir() {
    setOcupado(true); setError('');
    const vigente = vigenciaContexto();
    try {
      const r = await procesarComprobanteOrg(espacioId, adjuntoId, 'leer');
      if (r.error) throw r.error;
      if (vigente()) setUrl(r.data.url);
    } catch (err) { if (vigente()) setError(err.message || 'No pudimos abrir el comprobante. Reintentá.'); }
    finally { setOcupado(false); }
  }
  return <span className="inline-flex flex-wrap items-center gap-2">
    <Button variante="secondary" tamano="sm" cargando={ocupado} onClick={abrir}>Consultar comprobante</Button>
    {url && <a className="text-sm text-primary underline underline-offset-4 min-h-touch inline-flex items-center" href={url} target="_blank" rel="noopener noreferrer">Abrir documento (60 s)</a>}
    {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
  </span>;
}
