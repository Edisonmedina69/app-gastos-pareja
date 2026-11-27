import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Loader2, Hash } from 'lucide-react';
import * as deudasService from '../../../../services/deudas.service';
import * as gastosProgramadosService from '../../../../services/gastosProgramados.service';
import { valoresInicialesMedioPago } from '../../lib/formularios';
import { Modal } from '../../../../shared/ui/Modal';

/** Edición rápida del medio de pago y los datos de cuenta de un gasto fijo o deuda. */
export default function ModalMedioPago({ item, tipo, onClose, onGuardado }) {
  const [ini] = useState(() => valoresInicialesMedioPago(item));
  const medioPagoEditItem = { id: item.id, type: tipo };
  const [mpEditMedioPago, setMpEditMedioPago] = useState(ini.mpEditMedioPago);
  const [mpEditTipoCuenta, setMpEditTipoCuenta] = useState(ini.mpEditTipoCuenta);
  const [mpEditAlias, setMpEditAlias] = useState(ini.mpEditAlias);
  const [mpEditNroCuenta, setMpEditNroCuenta] = useState(ini.mpEditNroCuenta);
  const [mpEditNombreTitular, setMpEditNombreTitular] = useState(ini.mpEditNombreTitular);
  const [mpEditCiTitular, setMpEditCiTitular] = useState(ini.mpEditCiTitular);
  const [mpGuardando, setMpGuardando] = useState(false);

  const guardarMedioPago = async (e) => {
    e.preventDefault();
    if (!medioPagoEditItem || mpGuardando) return;
    setMpGuardando(true);
    const toastId = toast.loading("Actualizando medio de pago...");
    try {
      const actualizar = medioPagoEditItem.type === 'gasto_fijo'
        ? gastosProgramadosService.actualizarGastoProgramado
        : deudasService.actualizarDeuda;
      const { error } = await actualizar(medioPagoEditItem.id, {
          medio_pago: mpEditMedioPago,
          tipo_cuenta: mpEditMedioPago === 'transferencia' ? mpEditTipoCuenta : null,
          alias_cuenta: mpEditMedioPago === 'transferencia' && mpEditTipoCuenta === 'alias' ? mpEditAlias.trim() : null,
          nro_cuenta: mpEditMedioPago === 'transferencia' && mpEditTipoCuenta === 'nro_cuenta' ? mpEditNroCuenta.trim() : null,
          nombre_titular: mpEditMedioPago === 'transferencia' && mpEditTipoCuenta === 'nro_cuenta' ? mpEditNombreTitular.trim() : null,
          ci_titular: mpEditMedioPago === 'transferencia' && mpEditTipoCuenta === 'nro_cuenta' ? mpEditCiTitular.trim() : null,
        });
      if (error) throw error;
      toast.success("¡Medio de pago actualizado! 💳", { id: toastId });
      onGuardado();
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setMpGuardando(false);
    }
  };

  return (
    <Modal onClose={onClose} ancho="sm" capa="z-[110]" ariaLabel="Medio de pago">
      <h2 className="text-lg font-black text-white mb-4 uppercase">Medio de Pago</h2>
      <form onSubmit={guardarMedioPago} className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Medio de Pago</label>
          <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => setMpEditMedioPago('transferencia')}
              className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
                mpEditMedioPago === 'transferencia' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'
              }`}
            >
              Transferencia
            </button>
            <button
              type="button"
              onClick={() => setMpEditMedioPago('efectivo')}
              className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
                mpEditMedioPago === 'efectivo' ? 'bg-amber-600 text-white shadow-lg' : 'text-slate-500'
              }`}
            >
              Efectivo
            </button>
          </div>
        </div>

        {mpEditMedioPago === 'transferencia' && (
          <>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Tipo de Cuenta</label>
              <div className="flex p-1 bg-white/5 rounded-2xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setMpEditTipoCuenta('alias')}
                  className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
                    mpEditTipoCuenta === 'alias' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'
                  }`}
                >
                  Alias / CBU
                </button>
                <button
                  type="button"
                  onClick={() => setMpEditTipoCuenta('nro_cuenta')}
                  className={`flex-1 py-2.5 text-[9px] font-black uppercase rounded-xl transition-all ${
                    mpEditTipoCuenta === 'nro_cuenta' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'
                  }`}
                >
                  Nro. de Cuenta
                </button>
              </div>
            </div>

            {mpEditTipoCuenta === 'alias' ? (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1">
                  <Hash size={12} /> Alias / CBU
                </label>
                <input
                  type="text"
                  placeholder="Ej: mi.alias.banco"
                  value={mpEditAlias}
                  onChange={(e) => setMpEditAlias(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 text-base"
                />
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-indigo-400 uppercase ml-1 flex items-center gap-1">
                    <Hash size={12} /> Número de Cuenta
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: 001-123456-00"
                    value={mpEditNroCuenta}
                    onChange={(e) => setMpEditNroCuenta(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 text-base"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Nombre Completo</label>
                    <input
                      type="text"
                      placeholder="Titular de la cuenta"
                      value={mpEditNombreTitular}
                      onChange={(e) => setMpEditNombreTitular(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 text-base"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">CI / Documento</label>
                    <input
                      type="text"
                      placeholder="Ej: 1234567"
                      value={mpEditCiTitular}
                      onChange={(e) => setMpEditCiTitular(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-indigo-500/50 text-base"
                    />
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <button type="submit" disabled={mpGuardando} className="w-full py-3.5 font-black rounded-2xl bg-indigo-600 text-white shadow-xl active:scale-95 transition-all mt-4">
          {mpGuardando ? <Loader2 className="animate-spin mx-auto" size={18} /> : "GUARDAR"}
        </button>
      </form>
    </Modal>
  );
}
