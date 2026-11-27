import { lazy, Suspense, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { ArrowLeftRight } from 'lucide-react';
import { useEspacios } from '../features/espacios/hooks/useEspacios';
import Login from '../features/auth/components/Login';
import Espacios from '../features/espacios/components/Espacios';
import AvisoVersion from '../shared/ui/AvisoVersion';
const HogarApp = lazy(() => import('./HogarApp'));
const Organizacion = lazy(() => import('../features/organizacion/components/Organizacion'));

export default function App() {
  const contexto = useEspacios();
  const { pathname } = useLocation();
  const { session, activo, cargando } = contexto;
  const rutaEspacios = ['/espacios', '/crear-organizacion', '/invitacion'].includes(pathname);
  const datosHogar = useMemo(() => activo ? {
    ...activo.perfil, espacio_id: activo.id, espacios: activo.detalle,
    nombre_familia: activo.nombre,
    rol: activo.perfil.rol === 'superadmin' ? 'superadmin' : activo.membresia.rol_plantilla === 'admin' ? 'admin_hogar' : 'miembro',
  } : null, [activo]);
  return <div className="min-h-screen bg-background text-foreground">
    <Toaster position="top-center" /><AvisoVersion />
    {cargando ? <div role="status" className="min-h-screen flex items-center justify-center text-muted-foreground">Cargando tus espacios…</div> : !session ? <Login /> : !activo || rutaEspacios ? <Espacios key={pathname} {...contexto} errorCarga={contexto.error} /> : <>
      <div className={`sticky top-0 z-[60] flex items-center justify-between gap-3 border-b border-border bg-background px-4 py-2 ${activo.tipo === 'hogar' ? 'lg:pl-64' : 'sm:px-8 lg:px-12'}`}>
        <span className="text-sm text-muted-foreground truncate">{activo.nombre}</span>
        <Link to="/espacios" className="inline-flex items-center gap-2 min-h-touch shrink-0 px-3 rounded-xl text-primary hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"><ArrowLeftRight size={16} aria-hidden="true" />Cambiar espacio</Link>
      </div>
      <Suspense fallback={<p role="status" className="p-8 text-muted-foreground">Cargando espacio…</p>}>
        {activo.tipo === 'organizacion' ? <Organizacion key={activo.id} activo={activo} refrescarEspacios={contexto.refrescar} /> : <HogarApp key={activo.id} session={session} datosHogar={datosHogar} />}
      </Suspense>
    </>}
  </div>;
}
