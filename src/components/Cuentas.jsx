import React, { useState } from 'react';
import { supabase } from '../supabase';
import { toast } from 'react-hot-toast';
import { formatearNumero } from '../utils/formatters';
import { Calendar, CreditCard, Plus, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import '../Estilos/Cuentas.css';

export default function Cuentas({ 
  usuarioActual, 
  cuentas, 
  monedaGlobal, 
  obtenerDatos, 
  datosHogar 
}) {
  const [mostrarModal, setMostrarModal] = useState(false);
  const [esCuotas, setEsCuotas] = useState(false);
  
  // Estados del Formulario
  const [titulo, setTitulo] = useState('');
  const [montoMensual, setMontoMensual] = useState('');
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]);
  const [porcentajeMora, setPorcentajeMora] = useState(0);

  const abrirModal = () => setMostrarModal(true);
  const cerrarModal = () => {
    setMostrarModal(false);
    setEsCuotas(false);
    setTitulo('');
    setMontoMensual('');
    setCantidadCuotas(1);
  };

  async function guardarDeuda(e) {
    e.preventDefault();
    const toastId = toast.loading(esCuotas ? "Generando lote de cuotas..." : "Guardando cuenta...");

    try {
      if (esCuotas) {
        // LLAMADA AL STORED PROCEDURE (RPC)
        const { error } = await supabase.rpc('generar_cuotas', {
          p_descripcion: titulo,
          p_monto_mensual: parseFloat(montoMensual),
          p_moneda: monedaGlobal,
          p_cantidad_cuotas: parseInt(cantidadCuotas),
          p_fecha_inicio: fechaInicio,
          p_porcentaje_mora: parseFloat(porcentajeMora),
          p_pagador_id: usuarioActual.id,
          p_espacio_id: datosHogar.espacios.id
        });

        if (error) throw error;
        toast.success(`¡Oikoite! Se generaron ${cantidadCuotas} cuotas.`, { id: toastId });
      } else {
        // Registro simple (como lo hacías antes pero con espacio_id)
        const { error } = await supabase.from('cuentas_pendientes').insert([{
          descripcion: titulo,
          monto: parseFloat(montoMensual),
          moneda: monedaGlobal,
          estado: 'Pendiente',
          pagador_id: usuarioActual.id,
          fecha_vencimiento: fechaInicio,
          espacio_id: datosHogar.espacios.id
        }]);

        if (error) throw error;
        toast.success("Cuenta guardada correctamente.", { id: toastId });
      }

      cerrarModal();
      obtenerDatos();
    } catch (error) {
      toast.error("¡Haupei! Error: " + error.message, { id: toastId });
    }
  }

  return (
    <div className="pantalla-cuentas">
      <div className="header-seccion">
        <h2>Cuentas y Deudas</h2>
        <button onClick={abrirModal} className="btn-agregar">
          <Plus size={20} /> Nueva Deuda
        </button>
      </div>

      <div className="lista-cuentas">
        {cuentas.length === 0 ? (
          <div className="vacio">No hay cuentas pendientes. ¡Tranquilidad total! 🧉</div>
        ) : (
          cuentas.map((cuenta) => (
            <div key={cuenta.id} className={`tarjeta-cuenta ${cuenta.estado === 'Pagado' ? 'pagada' : ''}`}>
              <div className="info">
                <h4>{cuenta.descripcion}</h4>
                <p><Calendar size={14} /> Vence: {cuenta.fecha_vencimiento || 'Sin fecha'}</p>
                {cuenta.numero_cuota_actual && (
                  <span className="badge-cuota">Cuota {cuenta.numero_cuota_actual}/{cuenta.total_cuotas}</span>
                )}
              </div>
              <div className="monto-status">
                <span className="monto">{formatearNumero(cuenta.monto, cuenta.moneda)}</span>
                <span className={`status ${cuenta.estado.toLowerCase()}`}>{cuenta.estado}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL GLASSMORPHISM */}
      {mostrarModal && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <h3>Registrar Compromiso</h3>
            <form onSubmit={guardarDeuda}>
              <div className="toggle-group">
                <button 
                  type="button" 
                  className={!esCuotas ? 'active' : ''} 
                  onClick={() => setEsCuotas(false)}
                >Pago Único</button>
                <button 
                  type="button" 
                  className={esCuotas ? 'active' : ''} 
                  onClick={() => setEsCuotas(true)}
                >En Cuotas</button>
              </div>

              <input 
                type="text" 
                placeholder="¿Qué estamos pagando?" 
                value={titulo} 
                onChange={(e) => setTitulo(e.target.value)} 
                required 
              />

              <div className="fila-input">
                <input 
                  type="number" 
                  placeholder="Monto Mensual" 
                  value={montoMensual} 
                  onChange={(e) => setMontoMensual(e.target.value)} 
                  required 
                />
                {esCuotas && (
                  <input 
                    type="number" 
                    placeholder="Cant. Cuotas" 
                    value={cantidadCuotas} 
                    onChange={(e) => setCantidadCuotas(e.target.value)} 
                    min="2"
                    required 
                  />
                )}
              </div>

              <div className="campo">
                <label>Primer Vencimiento</label>
                <input 
                  type="date" 
                  value={fechaInicio} 
                  onChange={(e) => setFechaInicio(e.target.value)} 
                  required 
                />
              </div>

              {esCuotas && (
                <input 
                  type="number" 
                  placeholder="% Mora mensual (opcional)" 
                  value={porcentajeMora} 
                  onChange={(e) => setPorcentajeMora(e.target.value)} 
                />
              )}

              <div className="acciones-modal">
                <button type="button" onClick={cerrarModal} className="btn-cancelar">Cancelar</button>
                <button type="submit" className="btn-confirmar">Confirmar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}