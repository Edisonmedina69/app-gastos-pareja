import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Building2, Home, ArrowRight, LogOut } from 'lucide-react';
import { Button, Field, Input } from '../../../shared/ui';
import { crearOrganizacion, aceptarInvitacion } from '../../../services/espacios.service';
import { crearEspacioPropio, unirseAEspacio } from '../../../services/hogar.service';
import { cerrarSesion } from '../../../services/auth.service';

export default function Espacios({ espacios, seleccionar, errorCarga, refrescar }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // El fragmento nunca se copia a localStorage ni a query params; se retiene en memoria si entró por /invitacion#token=...
  const [token, setToken] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [hogar, setHogar] = useState(false);
  const [unir, setUnir] = useState(false);
  const crear = pathname === '/crear-organizacion';
  const invitacion = pathname === '/invitacion';

  async function enviar(e) {
    e.preventDefault();
    const valores = new FormData(e.currentTarget);
    setOcupado(true); setError('');
    try {
      let resultado;
      if (crear) resultado = await crearOrganizacion(valores.get('nombre'));
      else if (invitacion) resultado = await aceptarInvitacion(token);
      else if (hogar) resultado = await crearEspacioPropio(valores.get('nombre'));
      else resultado = await unirseAEspacio(valores.get('codigo'));
      if (resultado.error) throw resultado.error;
      if (resultado.data?.error) throw new Error(resultado.data.error);
      const id = resultado.data?.espacio_id || resultado.data;
      if (invitacion) {
        setToken('');
        window.history.replaceState(null, '', '/invitacion');
      }
      await seleccionar(id);
      navigate('/');
    } catch (e) { setError(e.message); }
    finally { setOcupado(false); }
  }

  const formulario = crear || invitacion || hogar || unir;
  return <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8 sm:py-16">
    <div className="flex items-center justify-between gap-4 mb-10">
      <Link to="/espacios" className="font-bold text-xl text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">ÑandeFinanza</Link>
      <Button variante="ghost" onClick={() => cerrarSesion()}><LogOut size={16} aria-hidden="true" />Salir</Button>
    </div>
    <h1 className="text-title-lg font-bold text-foreground">{crear ? 'Crear organización' : invitacion ? 'Unirte a una organización' : hogar ? 'Crear hogar' : unir ? 'Unirte a un hogar' : 'Elegí tu espacio'}</h1>
    <p className="text-muted-foreground mt-3 mb-8 max-w-prose">{crear ? 'Una organización tiene su propio equipo. Tu hogar sigue disponible.' : invitacion ? 'Pegá el código o abrí el enlace que te compartió un integrante.' : formulario ? 'Organizá tus finanzas familiares en un espacio propio.' : 'Tu cuenta puede participar en hogares y organizaciones. Podés cambiar de espacio cuando quieras.'}</p>
    {(error || errorCarga) && <div role="alert" className="mb-6 text-destructive border border-destructive/30 rounded-xl p-4">{error || errorCarga}{errorCarga && <Button variante="ghost" onClick={refrescar}>Reintentar</Button>}</div>}
    {formulario ? <form onSubmit={enviar} className="space-y-6">
      {invitacion ? <Field label="Código de invitación" ayuda="Los códigos vencen a los 7 días.">{props => <Input {...props} required value={token} onChange={e => setToken(e.target.value)} autoComplete="off" spellCheck={false} />}</Field> : unir ? <Field label="Código del hogar">{props => <Input {...props} name="codigo" required autoComplete="off" />}</Field> : <Field label={crear ? 'Nombre de la organización' : 'Nombre del hogar'}>{props => <Input {...props} name="nombre" maxLength={100} required autoComplete="organization" />}</Field>}
      {crear && <div className="border-y border-border py-5 flex flex-wrap gap-x-12 gap-y-3 text-sm text-muted-foreground"><p>Moneda base <strong className="text-foreground">Guaraní · PYG</strong></p><p>Capacidad <strong className="text-foreground">10 integrantes</strong></p></div>}
      <div className="flex flex-wrap gap-3"><Button type="submit" cargando={ocupado}>{crear || hogar ? 'Crear y entrar' : 'Aceptar y entrar'}</Button><Button variante="secondary" onClick={() => { setHogar(false); setUnir(false); navigate('/espacios'); }}>Volver a espacios</Button></div>
    </form> : <>
      <ul className="divide-y divide-border border-y border-border">
        {espacios.map(espacio => {
          const Icono = espacio.tipo === 'hogar' ? Home : Building2;
          return <li key={espacio.id}><button disabled={ocupado} onClick={async () => { setOcupado(true); await seleccionar(espacio.id); navigate('/'); }} className="flex w-full min-h-touch items-center gap-4 py-6 text-left hover:bg-muted/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
            <Icono size={26} className="text-primary shrink-0" aria-hidden="true" /><span className="flex-1 min-w-0"><span className="block text-lg font-semibold text-foreground break-words">{espacio.nombre}</span><span className="text-sm text-muted-foreground">{espacio.tipo === 'hogar' ? 'Hogar' : 'Organización'}</span></span><ArrowRight size={20} className="shrink-0" aria-hidden="true" />
          </button></li>;
        })}
      </ul>
      {espacios.length === 0 && <p className="py-8 text-muted-foreground">Todavía no tenés espacios. Creá un hogar o usá una invitación para empezar.</p>}
      <div className="flex flex-wrap gap-3 mt-8"><Link className="min-h-touch inline-flex items-center px-4 rounded-xl bg-primary text-primary-foreground font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" to="/crear-organizacion">Crear organización</Link><Link className="min-h-touch inline-flex items-center px-4 rounded-xl border border-border text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" to="/invitacion">Tengo una invitación</Link></div>
      <div className="flex flex-wrap gap-4 mt-6"><Button variante="ghost" onClick={() => setHogar(true)}>Crear un hogar</Button><Button variante="ghost" onClick={() => setUnir(true)}>Unirme a un hogar</Button></div>
    </>}
  </main>;
}
