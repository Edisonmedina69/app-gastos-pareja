import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { rutaFormulario, resolverFormulario } from '../lib/rutasFormulario';
import { toast } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { Plus } from 'lucide-react';
import { formatearNumero } from '../../../shared/lib/formatters';
import * as deudasService from '../../../services/deudas.service';
import * as gastosProgramadosService from '../../../services/gastosProgramados.service';
import { sembrarDeudasDemo } from '../../../services/demo.service';
import { calcularSaldoEInteres } from '../lib/ciclosTarjeta';
import { cerrarCicloTarjeta as cerrarCicloTarjetaEnBase } from '../lib/cerrarCicloTarjeta';
import { IconButton, SegmentedControl } from '../../../shared/ui';
import TarjetaDeuda from './TarjetaDeuda';
import ListaGastosFijos from './ListaGastosFijos';
import ListaPrevisiones from './ListaPrevisiones';
import ModalDeuda from './modales/ModalDeuda';
import ModalAbono from './modales/ModalAbono';
import ModalCompra from './modales/ModalCompra';
import ModalGastoFijo from './modales/ModalGastoFijo';
import ModalPagarFijo from './modales/ModalPagarFijo';
import ModalPrevision from './modales/ModalPrevision';
import ModalMedioPago from './modales/ModalMedioPago';

const PESTANAS = [
  { valor: 'activas', etiqueta: 'Activas' },
  { valor: 'archivadas', etiqueta: 'Archivadas' },
  { valor: 'fijos', etiqueta: 'Fijos' },
  { valor: 'presupuestos', etiqueta: 'Previsiones' },
];

/**
 * Deudas Pro: deudas activas/archivadas, gastos fijos y previsiones.
 * Este componente sólo orquesta: filtros, pestañas y qué modal está abierto.
 * Cada modal maneja su propio formulario (ver ./modales).
 */
export default function Cuentas({
  esSuperadmin,
  usuarioActual,
  otroUsuario,
  usuarios,
  deudas,
  gastos,
  monedaGlobal,
  obtenerDatos,
  datosHogar,
  saludFinanciera,
  gastosProgramados
}) {
  const [deudaExpandida, setDeudaExpandida] = useState(null);
  const [pestanaLocal, actualizarPestana] = useState('activas');
  const location = useLocation();
  const navigate = useNavigate();
  const base = location.pathname.startsWith('/fijos') ? '/fijos' : location.pathname.startsWith('/previsiones') ? '/previsiones' : '/deudas';
  const setPestana = (valor) => {
    actualizarPestana(valor);
    navigate(valor === 'fijos' ? '/fijos' : valor === 'presupuestos' ? '/previsiones' : '/deudas');
  };
  const pestana = base === '/fijos' ? 'fijos' : base === '/previsiones' ? 'presupuestos' : pestanaLocal; // activas | archivadas | fijos | presupuestos
  // Modal abierto: { tipo: 'deuda' | 'abono' | 'compra' | 'fijo' | 'pagarFijo' | 'prevision' | 'medioPago', ...datos }
  const modal = resolverFormulario(location.pathname, deudas, gastosProgramados);
  const setModal = (valor) => navigate(valor ? rutaFormulario(valor) : base, { state: valor ? { desdeFormulario: true } : null });

  const cerrarModal = () => location.state?.desdeFormulario ? navigate(-1) : navigate(base);
  const alGuardar = () => { setModal(null); obtenerDatos(); };

  // Apertura de modales (mismos nombres que usaban las tarjetas y listas)
  const iniciarEdicionDeuda = (deuda) => setModal({ tipo: 'deuda', deuda });
  const abrirEdicionMedioPago = (item, tipo) => setModal({ tipo: 'medioPago', item, tipoItem: tipo });
  const abrirNuevoFijo = () => setModal({ tipo: 'fijo', fijo: null });
  const abrirEdicionFijo = (fijo) => setModal({ tipo: 'fijo', fijo });
  const abrirPagoFijo = (fijo) => setModal({ tipo: 'pagarFijo', fijo });
  const abrirNuevaPrevision = () => setModal({ tipo: 'prevision', prevision: null });
  const abrirEdicionPrevision = (prevision) => setModal({ tipo: 'prevision', prevision });
  const abrirAbono = (cuota, maestra) => setModal({ tipo: 'abono', pago: { cuota, maestra } });
  const abrirCompra = (tarjeta) => setModal({ tipo: 'compra', tarjeta });

  const eliminarPrevision = async (id, concepto) => {
    const nombreLimpio = concepto.replace("[PRESUPUESTO] ", "");
    if (window.confirm(`¿Seguro que querés eliminar la previsión de gasto "${nombreLimpio}"?`)) {
      try {
        const { error } = await gastosProgramadosService.eliminarGastoProgramado(id);
        if (error) throw error;
        toast.success("Previsión eliminada 🗑️");
        obtenerDatos();
      } catch (e) {
        toast.error("Error al eliminar: " + e.message);
      }
    }
  };

  const calcularGastoPrevision = (nombrePrevision, monedaPrevision) => {
    const ahora = new Date();
    const mesActual = ahora.getMonth();
    const anioActual = ahora.getFullYear();

    return gastos?.filter(g => {
      const fG = new Date(g.fecha || g.created_at);
      const coincideMes = fG.getMonth() === mesActual && fG.getFullYear() === anioActual;
      if (!coincideMes) return false;

      const coincideConcepto = g.concepto && g.concepto.startsWith(`[B: ${nombrePrevision}]`);
      const coincideMoneda = g.moneda === monedaPrevision;

      return coincideConcepto && coincideMoneda;
    }).reduce((acc, g) => acc + Number(g.monto), 0) || 0;
  };

  const obtenerNombreDestinatario = (p) => {
    if (p.para_quien === 'Ambos') return 'Ambos';
    const creador = usuarios?.find(u => u.id === p.usuario_id);
    const otro = usuarios?.find(u => u.id !== p.usuario_id);
    if (p.para_quien === 'Yo') {
      return creador ? creador.nombre : 'Yo';
    }
    if (p.para_quien === 'Pareja') {
      return otro ? otro.nombre : 'Pareja';
    }
    return p.para_quien;
  };

  const preCargarPlantillas = async () => {
    if (!datosHogar?.espacio_id || !usuarioActual?.id) return;
    const toastId = toast.loading("Cargando plantilla de supervivencia...");
    const defaults = [
      { concepto: "💧 Agua (ESSAP)", monto: 0, moneda: "PYG", dia_recurrencia: 10, categoria: "Casa", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id },
      { concepto: "⚡ Luz (ANDE)", monto: 0, moneda: "PYG", dia_recurrencia: 10, categoria: "Casa", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id },
      { concepto: "🗑️ Tasa de Basura", monto: 30000, moneda: "PYG", dia_recurrencia: 5, categoria: "Casa", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id },
      { concepto: "🌐 Internet", monto: 150000, moneda: "PYG", dia_recurrencia: 5, categoria: "Casa", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id },
      { concepto: "🛒 Supermercado / Comida", monto: 0, moneda: "PYG", dia_recurrencia: 5, categoria: "Supermercado", para_quien: "Ambos", espacio_id: datosHogar.espacio_id, usuario_id: usuarioActual.id }
    ];
    const timeoutId = setTimeout(() => {
      toast.error("Tiempo de espera agotado al pre-cargar plantilla.", { id: toastId });
    }, 8000);
    try {
      const { error } = await gastosProgramadosService.insertarGastosProgramados(defaults);
      clearTimeout(timeoutId);
      if (error) throw error;
      toast.success("¡Plantilla básica cargada! 🏠✨", { id: toastId });
      obtenerDatos();
    } catch (e) {
      clearTimeout(timeoutId);
      toast.error("Error al cargar: " + e.message, { id: toastId });
    }
  };

  const eliminarGastoFijo = async (id, concepto) => {
    if (window.confirm(`¿Eliminar la programación del gasto "${concepto}"?`)) {
      try {
        const { error } = await gastosProgramadosService.eliminarGastoProgramado(id);
        if (error) throw error;
        toast.success("Programación eliminada");
        obtenerDatos();
      } catch {
        toast.error("Error al eliminar");
      }
    }
  };

  const verificarSiFuePagadoEsteMes = (fijo) => {
    return gastos?.some(g => 
      g.concepto === `[FIJO] ${fijo.concepto}` && 
      new Date(g.fecha || g.created_at).getMonth() === new Date().getMonth() &&
      new Date(g.fecha || g.created_at).getFullYear() === new Date().getFullYear()
    );
  };

  async function cerrarCicloTarjeta(deuda, cuota) {
    if (!deuda || !cuota) return;
    const { saldoPendiente, interesGenerado } = calcularSaldoEInteres(deuda, cuota);
      
    const confirmar = window.confirm(
      `¿Confirmas cerrar este ciclo de facturación de "${deuda.titulo}"?\n\n` +
      `• Saldo no pagado: ${formatearNumero(saldoPendiente, deuda.moneda)}\n` +
      (interesGenerado > 0 ? `• Interés generado (${deuda.tasa_interes}%): ${formatearNumero(interesGenerado, deuda.moneda)}\n` : '') +
      `• Nuevo saldo inicial: ${formatearNumero(saldoPendiente + interesGenerado, deuda.moneda)}\n\n` +
      `Se generará la cuota del siguiente mes y se archivará este ciclo.`
    );
    
    if (!confirmar) return;
    
    const toastId = toast.loading("Cerrando ciclo de facturación...");
    try {
      await cerrarCicloTarjetaEnBase(deuda, cuota, datosHogar.espacio_id, usuarioActual.id);
      
      toast.success("¡Periodo cerrado y nuevo ciclo iniciado! 💳✨", { id: toastId });
      obtenerDatos();
    } catch (e) {
      toast.error("Error al cerrar ciclo: " + e.message, { id: toastId });
    }
  }

  async function deshacerCierreTarjeta(deuda, cuotaCerrada) {
    if (!deuda || !cuotaCerrada) return;
    
    const nextCuota = deuda.cuotas_detalle?.find(c => c.numero_cuota === cuotaCerrada.numero_cuota + 1 && c.estado === 'pendiente');
    if (!nextCuota) {
      toast.error("No se encontró el ciclo siguiente para deshacer.");
      return;
    }

    if (Number(nextCuota.monto_abonado) > 0) {
      toast.error("No se puede deshacer el cierre: el ciclo actual ya tiene abonos.");
      return;
    }

    const confirmar = window.confirm(
      `¿Confirmas deshacer el cierre del ciclo de la tarjeta "${deuda.titulo}"?\n\n` +
      `Se eliminará el ciclo nuevo (Cuota ${nextCuota.numero_cuota}) y se reactivará este ciclo.`
    );
    if (!confirmar) return;

    const toastId = toast.loading("Deshaciendo cierre de ciclo...");
    try {
      const { saldoPendiente: saldoPendienteOriginal, interesGenerado } = calcularSaldoEInteres(deuda, cuotaCerrada);
      const initialMontoNextCuota = saldoPendienteOriginal + interesGenerado;
      
      const comprasEnNuevoCiclo = Math.max(0, Number(nextCuota.monto_cuota) - initialMontoNextCuota);

      const nuevoMontoCuota = Number(cuotaCerrada.monto_cuota) + comprasEnNuevoCiclo;
      const { error: errRevert } = await deudasService.actualizarCuota(cuotaCerrada.id, {
        estado: 'pendiente',
        fecha_pago: null,
        pagador_id: null,
        monto_cuota: nuevoMontoCuota
      });
      
      if (errRevert) throw errRevert;

      const { error: errDel } = await deudasService.eliminarCuota(nextCuota.id);
      if (errDel) throw errDel;

      toast.success("¡Cierre deshecho exitosamente! 💳✨", { id: toastId });
      obtenerDatos();
    } catch (e) {
      toast.error("Error al deshacer cierre: " + e.message, { id: toastId });
    }
  }

  async function eliminarDeuda(maestra) {
    if (window.confirm(`¿Borrar "${maestra.titulo}"?`)) {
      await deudasService.eliminarDeuda(maestra.id);
      toast.success("Eliminada"); obtenerDatos();
    }
  }

  const verificarSiFuePagadaEsteMes = (deuda) => {
    return deuda.cuotas_detalle?.some(c => 
      c.estado === 'pagado' &&
      c.fecha_vencimiento &&
      new Date(c.fecha_vencimiento).getMonth() === new Date().getMonth() &&
      new Date(c.fecha_vencimiento).getFullYear() === new Date().getFullYear()
    ) || false;
  };

  const deudasFiltradas = deudas?.filter(d => {
    const coincideEstado = pestana === 'activas' 
      ? d.estado !== 'cerrada' 
      : d.estado === 'cerrada';
    if (!coincideEstado) return false;

    return true;
  }) || [];

  const deudasFijas = gastosProgramados?.filter(g => {
    const esFijo = !g.concepto.startsWith("[PRESUPUESTO] ");
    if (!esFijo) return false;

    return true;
  }) || [];

  const previsiones = gastosProgramados?.filter(g => {
    const esPrevision = g.concepto.startsWith("[PRESUPUESTO] ");
    if (!esPrevision) return false;

    return true;
  }) || [];



  return (
    <div className="space-y-6 pb-20">
      {!modal && location.pathname.split('/').filter(Boolean).length > 1 && <div role="status" className="glass-card"><p>No se encontró el registro.</p><button onClick={() => navigate(base)} className="mt-3 text-indigo-300 underline">Volver a deudas</button></div>}
      {!modal && location.pathname.split('/').filter(Boolean).length === 1 && <>
      <header className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <SegmentedControl etiqueta="Secciones de deudas" opciones={PESTANAS} valor={pestana} onChange={setPestana} estirar className="w-full sm:w-auto min-w-0" />
        <div className="flex gap-2 shrink-0 justify-end">
          {pestana === 'activas' && esSuperadmin && (
            <button
              type="button"
              onClick={async () => {
                if (!esSuperadmin) return;
                const toastId = toast.loading("Generando deudas demo...");
                try {
                  await sembrarDeudasDemo(datosHogar.espacio_id, usuarioActual.id, { incluirTarjeta: false });
                  toast.success("¡Deudas demo listas! 💳✨", { id: toastId });
                  obtenerDatos();
                } catch (err) {
                  toast.error("Error: " + err.message, { id: toastId });
                }
              }}
              aria-label="Cargar deudas demo"
              className="min-h-touch px-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 rounded-xl text-micro font-black uppercase flex items-center gap-1 transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ⚡ Cargar Deudas Demo
            </button>
          )}
          <IconButton
            etiqueta={pestana === 'fijos' ? 'Nuevo gasto fijo' : pestana === 'presupuestos' ? 'Nueva previsión' : 'Nueva deuda'}
            variante="primary"
            onClick={() => {
              if (pestana === 'fijos') abrirNuevoFijo();
              else if (pestana === 'presupuestos') abrirNuevaPrevision();
              else setModal({ tipo: 'deuda', deuda: null });
            }}
          >
            <Plus size={24} />
          </IconButton>
        </div>
      </header>

      <div className="space-y-4">
        {(pestana === 'activas' || pestana === 'archivadas') &&
          deudasFiltradas.map((d) => (
            <TarjetaDeuda
              key={d.id}
              d={d}
              pestana={pestana}
              datosHogar={datosHogar}
              deudaExpandida={deudaExpandida}
              setDeudaExpandida={setDeudaExpandida}
              usuarioActual={usuarioActual}
              usuarios={usuarios}
              abrirEdicionMedioPago={abrirEdicionMedioPago}
              iniciarEdicionDeuda={iniciarEdicionDeuda}
              eliminarDeuda={eliminarDeuda}
              cerrarCicloTarjeta={cerrarCicloTarjeta}
              deshacerCierreTarjeta={deshacerCierreTarjeta}
              verificarSiFuePagadaEsteMes={verificarSiFuePagadaEsteMes}
              onCargarCompra={abrirCompra}
              onAbonar={abrirAbono}
            />
          ))}

        {pestana === 'fijos' && (
          <ListaGastosFijos
            deudasFijas={deudasFijas}
            verificarSiFuePagadoEsteMes={verificarSiFuePagadoEsteMes}
            preCargarPlantillas={preCargarPlantillas}
            abrirNuevoFijo={abrirNuevoFijo}
            abrirEdicionFijo={abrirEdicionFijo}
            abrirEdicionMedioPago={abrirEdicionMedioPago}
            abrirPagoFijo={abrirPagoFijo}
            eliminarGastoFijo={eliminarGastoFijo}
          />
        )}

        {pestana === 'presupuestos' && (
          <ListaPrevisiones
            previsiones={previsiones}
            calcularGastoPrevision={calcularGastoPrevision}
            obtenerNombreDestinatario={obtenerNombreDestinatario}
            abrirNuevaPrevision={abrirNuevaPrevision}
            abrirEdicionPrevision={abrirEdicionPrevision}
            eliminarPrevision={eliminarPrevision}
          />
        )}
      </div>

      </>}
      <AnimatePresence>
        {modal?.tipo === 'deuda' && (
          <ModalDeuda key={`deuda-${modal.deuda?.id || "nueva"}`} deudaEditando={modal.deuda} usuarioActual={usuarioActual} datosHogar={datosHogar} monedaGlobal={monedaGlobal} saludFinanciera={saludFinanciera} onClose={cerrarModal} onGuardado={alGuardar} />
        )}
        {modal?.tipo === 'abono' && (
          <ModalAbono key="abono" pagoSeleccionado={modal.pago} usuarioActual={usuarioActual} datosHogar={datosHogar} monedaGlobal={monedaGlobal} onClose={cerrarModal} onGuardado={alGuardar} onEditarMedioPago={abrirEdicionMedioPago} />
        )}
        {modal?.tipo === 'compra' && (
          <ModalCompra key="compra" compraSeleccionada={modal.tarjeta} usuarioActual={usuarioActual} datosHogar={datosHogar} onClose={cerrarModal} onGuardado={alGuardar} />
        )}
        {modal?.tipo === 'fijo' && (
          <ModalGastoFijo key={`fijo-${modal.fijo?.id || "nuevo"}`} fijo={modal.fijo} usuarioActual={usuarioActual} datosHogar={datosHogar} monedaGlobal={monedaGlobal} onClose={cerrarModal} onGuardado={alGuardar} />
        )}
        {modal?.tipo === 'pagarFijo' && (
          <ModalPagarFijo key="pagarFijo" gastoFijoAPagar={modal.fijo} usuarioActual={usuarioActual} otroUsuario={otroUsuario} datosHogar={datosHogar} onClose={cerrarModal} onGuardado={alGuardar} onEditarMedioPago={abrirEdicionMedioPago} />
        )}
        {modal?.tipo === 'prevision' && (
          <ModalPrevision key={`prevision-${modal.prevision?.id || "nueva"}`} prevision={modal.prevision} usuarioActual={usuarioActual} otroUsuario={otroUsuario} datosHogar={datosHogar} monedaGlobal={monedaGlobal} onClose={cerrarModal} onGuardado={alGuardar} />
        )}
        {modal?.tipo === 'medioPago' && (
          <ModalMedioPago key={`mp-${modal.item.id}`} item={modal.item} tipo={modal.tipoItem} onClose={cerrarModal} onGuardado={alGuardar} />
        )}
      </AnimatePresence>
    </div>
  );
}
