import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { formatarInput, desformatearInput } from '../../../../shared/lib/formatters';
import { insertarGastos } from '../../../../services/gastos.service';
import * as deudasService from '../../../../services/deudas.service';
import { FormPage } from '../../../../shared/ui/FormPage';

/** Carga una compra en una tarjeta de crédito: gasto + disponible + saldo del ciclo. */
export default function ModalCompra({ compraSeleccionada, usuarioActual, datosHogar, onClose, onGuardado }) {
  const [compraConcepto, setCompraConcepto] = useState('');
  const [compraMontoFormateado, setCompraMontoFormateado] = useState('');
  const [compraCategoria, setCompraCategoria] = useState('Otros');
  const [guardando, setGuardando] = useState(false);
  async function procesarCompraTarjeta(e) {
    e.preventDefault();
    if (!compraSeleccionada || !usuarioActual || !datosHogar) return;
    const montoCompra = desformatearInput(compraMontoFormateado);
    if (!montoCompra || montoCompra <= 0) return;
  
    const toastId = toast.loading("Registrando compra con tarjeta...");
    setGuardando(true);
  
    try {
      const eid = datosHogar.espacio_id;
      const { error: errG } = await insertarGastos([{
        concepto: `${compraConcepto.trim()} (Tarjeta: ${compraSeleccionada.titulo})`,
        monto: montoCompra,
        categoria: compraCategoria,
        usuario_id: usuarioActual.id,
        pagador_id: usuarioActual.id,
        para_quien: compraSeleccionada.alcance === 'familiar' ? 'Ambos' : 'Yo',
        moneda: compraSeleccionada.moneda,
        espacio_id: eid,
        tasa_cambio: 1
      }]);
    
      if (errG) throw errG;
    
      const nuevoDisponible = Number(compraSeleccionada.linea_credito_disponible) - montoCompra;
      const { error: errDM } = await deudasService.actualizarDeuda(compraSeleccionada.id, { linea_credito_disponible: nuevoDisponible });
      
      if (errDM) throw errDM;
    
      const cuotaActual = compraSeleccionada.cuotas_detalle?.find(c => c.estado === 'pendiente');
      if (cuotaActual) {
        const nuevoMontoCuota = Number(cuotaActual.monto_cuota) + montoCompra;
        const { error: errC } = await deudasService.actualizarCuota(cuotaActual.id, { monto_cuota: nuevoMontoCuota });
        
        if (errC) throw errC;
      }
    
      toast.success("¡Compra registrada y disponible actualizado! 💳", { id: toastId });
      onGuardado();
    } catch (err) {
      toast.error("Error: " + err.message, { id: toastId });
    } finally {
      setGuardando(false);
    }
  }

  if (!compraSeleccionada) return null;
  return (
    <FormPage resumen={<><p className="font-bold">{compraConcepto || compraSeleccionada.titulo}</p><p className="text-2xl tabular-nums mt-3">{compraMontoFormateado || "0"} {compraSeleccionada.moneda}</p><p className="text-sm text-muted-foreground mt-2">{compraCategoria}</p></>} onClose={onClose} ariaLabel="Cargar compra">
      <h3 className="text-white font-bold text-lg mb-1">Cargar Compra</h3>
      <p className="text-xs text-slate-400 font-bold mb-4 uppercase tracking-wider">
        Tarjeta: {compraSeleccionada.titulo}
      </p>
      <form onSubmit={procesarCompraTarjeta} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase ml-1">Concepto / Comercio</label>
          <input 
            type="text" 
            placeholder="Ej: Supermercado, Biggie, combustible..." 
            value={compraConcepto} 
            onChange={(e) => setCompraConcepto(e.target.value)} 
            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 text-base" 
            required 
          />
        </div>
        
        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase ml-1">Monto de la Compra</label>
          <div className="relative">
            <input 
              type="text" 
              value={compraMontoFormateado} 
              onChange={(e) => setCompraMontoFormateado(formatarInput(e.target.value))} 
              className="w-full bg-slate-900 border border-white/10 rounded-2xl px-4 py-4 text-2xl font-black text-indigo-400 outline-none" 
              placeholder="0"
              required
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-black uppercase text-xs">{compraSeleccionada.moneda}</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold text-slate-400 uppercase ml-1">Categoría</label>
          <select 
            value={compraCategoria} 
            onChange={(e) => setCompraCategoria(e.target.value)} 
            className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white text-base"
          >
            {["Supermercado", "Casa", "Salud", "Transporte", "Otros"].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="flex gap-2 pt-4">
          <button 
            type="button" 
            onClick={() => { onClose(); }} 
            className="flex-1 py-4 bg-white/5 text-slate-400 font-bold rounded-2xl"
          >
            CANCELAR
          </button>
          <button 
            type="submit" 
            disabled={guardando || !compraConcepto || !compraMontoFormateado} 
            className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-lg shadow-indigo-600/30"
          >
            REGISTRAR
          </button>
        </div>
      </form>
    </FormPage>
  );
}
