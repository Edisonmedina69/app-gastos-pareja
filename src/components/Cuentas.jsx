import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { toast } from 'react-hot-toast';
import { formatearNumero } from '../utils/formatters';
import { obtenerCotizacion } from '../utils/exchangeApi';
import { Calendar, CreditCard, Plus, Trash2, CheckCircle, AlertCircle, Handshake, Wallet } from 'lucide-react';
import '../Estilos/Cuentas.css';

export default function Cuentas({
  usuarioActual,
  otroUsuario,
  usuarios = [],
  cuentas,
  monedaGlobal,
  obtenerDatos,
  datosHogar
}) {
  // Estados generales
  const [mostrarModal, setMostrarModal] = useState(false);
  const [tipoCuenta, setTipoCuenta] = useState("unica"); // 'unica', 'cuotas', 'tarjeta', 'informal'
  const [permitePagoParcial, setPermitePagoParcial] = useState(false);
  const [tasaCambio, setTasaCambio] = useState(1);
  const [monedaDeuda, setMonedaDeuda] = useState(monedaGlobal);

  // Estados del Formulario (Unificados)
  const [titulo, setTitulo] = useState('');
  const [montoInput, setMontoInput] = useState('');
  const [cantidadCuotas, setCantidadCuotas] = useState(1);
  const [diaVencimiento, setDiaVencimiento] = useState("5");
  const [responsableCuenta, setResponsableCuenta] = useState("Ambos");

  // Tarjetas
  const [bancoTarjeta, setBancoTarjeta] = useState("");
  const [numeroTarjeta, setNumeroTarjeta] = useState("");
  const [limiteCredito, setLimiteCredito] = useState("");

  // Préstamos
  const [deudorId, setDeudorId] = useState("");
  const [prestamosInformales, setPrestamosInformales] = useState([]);

  useEffect(() => {
    cargarPrestamosInformales();
  }, []);

  useEffect(() => {
    if (mostrarModal) {
      setMonedaDeuda(monedaGlobal);
    }
  }, [mostrarModal, monedaGlobal]);

  useEffect(() => {
    if (mostrarModal && monedaDeuda !== "PYG") {
      async function cargarTasa() {
        const rate = await obtenerCotizacion(monedaDeuda, "PYG");
        setTasaCambio(rate);
      }
      cargarTasa();
    } else {
      setTasaCambio(1);
    }
  }, [mostrarModal, monedaDeuda]);

  async function cargarPrestamosInformales() {
    if (!usuarioActual) return;
    const { data } = await supabase
      .from("prestamos_personales")
      .select("*")
      .or(`deudor_id.eq.${usuarioActual.id},acreedor_id.eq.${usuarioActual.id}`)
      .order("created_at", { ascending: false });
    if (data) setPrestamosInformales(data);
  }

  const cerrarModal = () => {
    setMostrarModal(false);
    setTitulo('');
    setMontoInput('');
    setCantidadCuotas(1);
    setBancoTarjeta("");
    setNumeroTarjeta("");
    setLimiteCredito("");
    setMontoTotalTarjeta("");
    setPermitePagoParcial(false);
  };

  async function guardarDeuda(e) {
    e.preventDefault();
    const toastId = toast.loading("Registrando compromiso...");

    try {
      // 1. Lógica Préstamo en Pareja
      if (tipoCuenta === "informal") {
        if (!otroUsuario)
          throw new Error("Falta tu pareja en el sistema.");
        
        const acreedorId = deudorId === usuarioActual.id ? otroUsuario.id : usuarioActual.id;

        const { error } = await supabase.from("prestamos_personales").insert([
          {
            deudor_id: deudorId,
            acreedor_id: acreedorId,
            monto_total: parseFloat(montoInput),
            concepto: titulo,
            moneda: monedaDeuda,
            tasa_cambio: parseFloat(tasaCambio),
            espacio_id: datosHogar?.espacios?.id || datosHogar?.id
          },
        ]);

        if (error) throw error;
        toast.success("¡Préstamo registrado! 🤝", { id: toastId });
        cargarPrestamosInformales();
        cerrarModal();
        return;
      }

      // 2. Lógica para Facturas, Cuotas (Usando cuentas_maestras para trazabilidad)
      if (tipoCuenta === "unica" || tipoCuenta === "cuotas") {
        const numCuotas = tipoCuenta === "cuotas" ? parseInt(cantidadCuotas) : 1;
        const montoTotal = parseFloat(montoInput);
        const montoPorCuota = montoTotal / numCuotas;

        // A. Insertar en cuentas_maestras (Espacio ID corregido según versión remota)
        const espacioId = datosHogar?.espacios?.id || datosHogar?.id;
        
        const { data: maestra, error: errorMaestra } = await supabase
          .from("cuentas_maestras")
          .insert([
            {
              espacio_id: espacioId,
              creador_id: usuarioActual.id,
              titulo: titulo,
              monto_total: montoTotal,
              cantidad_cuotas: numCuotas,
              permite_pago_parcial: permitePagoParcial,
              moneda: monedaDeuda,
            },
          ])
          .select()
          .single();

        if (errorMaestra) throw errorMaestra;

        // B. Generar cuotas en cuentas_pendientes
        const cuotasToInsert = [];
        for (let i = 1; i <= numCuotas; i++) {
          cuotasToInsert.push({
            maestra_id: maestra.id,
            descripcion: numCuotas > 1 ? `${titulo} (${i}/${numCuotas})` : titulo,
            monto: montoPorCuota,
            dia_vencimiento: parseInt(diaVencimiento),
            estado: "Pendiente",
            responsable: responsableCuenta,
            moneda: monedaDeuda,
            tasa_cambio: parseFloat(tasaCambio),
            total_cuotas: numCuotas,
            cuotas_pagadas: i - 1,
            permite_pago_parcial: permitePagoParcial,
            espacio_id: espacioId
          });
        }

        const { error: errorCuotas } = await supabase
          .from("cuentas_pendientes")
          .insert(cuotasToInsert);

        if (errorCuotas) throw errorCuotas;

        toast.success("¡Deuda registrada con éxito! 📝", { id: toastId });
      } else if (tipoCuenta === "tarjeta") {
        const descFinal = `💳 TC ${bancoTarjeta} (*${numeroTarjeta}) | LC: ${formatearNumero(limiteCredito, monedaGlobal)}`;
        
        const { error } = await supabase.from("cuentas_pendientes").insert([
          {
            descripcion: descFinal,
            monto: parseFloat(montoInput),
            es_recurrente: true,
            dia_vencimiento: parseInt(diaVencimiento),
            total_cuotas: 120,
            cuotas_pagadas: 0,
            estado: "Pendiente",
            responsable: responsableCuenta,
            moneda: monedaDeuda,
            tasa_cambio: parseFloat(tasaCambio),
            espacio_id: datosHogar?.espacios?.id || datosHogar?.id
          },
        ]);

        if (error) throw error;
        toast.success("¡Tarjeta registrada! 💳", { id: toastId });
      }

      cerrarModal();
      obtenerDatos();

    } catch (error) {
      toast.error("Error: " + error.message, { id: toastId });
    }
  }

  // 🔥 HU-06: LÓGICA DE PAGO PARCIAL CON TRASPASO AUTOMÁTICO
  async function marcarPagado(cuenta) {
    if (!usuarioActual) return;

    const abonoStr = window.prompt(
      `La cuota es de ${formatearNumero(cuenta.monto, cuenta.moneda)}.\n¿Cuánto vas a entregar hoy? (Solo números)`,
      cuenta.monto
    );
    if (abonoStr === null) return;

    const abono = parseFloat(abonoStr);
    if (isNaN(abono) || abono <= 0) {
      toast.error("Monto inválido");
      return;
    }

    const toastId = toast.loading("Procesando pago...");

    try {
      if (abono < cuenta.monto) {
        // Calculamos la diferencia que falta pagar
        const saldoRestante = cuenta.monto - abono;

        // 1. Buscamos si existe una PRÓXIMA cuota de esta misma deuda
        let proximaCuota = null;
        if (cuenta.maestra_id) {
          const { data } = await supabase
            .from("cuentas_pendientes")
            .select("*")
            .eq("maestra_id", cuenta.maestra_id)
            .eq("estado", "Pendiente")
            .gt("fecha_vencimiento", cuenta.fecha_vencimiento) // Solo cuotas futuras
            .order("fecha_vencimiento", { ascending: true }) // La más cercana
            .limit(1)
            .single();

          if (data) proximaCuota = data;
        }

        if (proximaCuota) {
          // HU-06: Hay próxima cuota. Traspasamos la deuda.
          // Cerramos la actual por el monto que realmente pagó (para el historial)
          await supabase
            .from("cuentas_pendientes")
            .update({
              estado: "Pagado",
              monto: abono,
              fecha_ultimo_pago: new Date().toISOString(),
              pagador_id: usuarioActual.id,
              pago_solicitado_a: null,
              cuotas_pagadas: (cuenta.cuotas_pagadas || 0) + 1
            })
            .eq("id", cuenta.id);

          // Sumamos el saldo restante a la próxima cuota
          const nuevoMontoProxima = proximaCuota.monto + saldoRestante;
          await supabase
            .from("cuentas_pendientes")
            .update({ monto: nuevoMontoProxima })
            .eq("id", proximaCuota.id);

          toast.success(`Cuota cerrada. Saldo de ${formatearNumero(saldoRestante, cuenta.moneda)} sumado al mes siguiente. 🔄`, { id: toastId });
        } else {
          // No hay próxima cuota (es la última o de pago único). Dejamos esta pendiente con el saldo restante.
          await supabase
            .from("cuentas_pendientes")
            .update({
              monto: saldoRestante,
              fecha_ultimo_pago: new Date().toISOString(),
              pagador_id: usuarioActual.id,
              pago_solicitado_a: null
            })
            .eq("id", cuenta.id);
          toast.success(`Pago parcial registrado. Queda un saldo de ${formatearNumero(saldoRestante, cuenta.moneda)} en esta última cuota.`, { id: toastId });
        }
      } else {
        // Pago Total o con excedente
        const { error } = await supabase
          .from("cuentas_pendientes")
          .update({
            estado: "Pagado",
            fecha_ultimo_pago: new Date().toISOString(),
            pagador_id: usuarioActual.id,
            pago_solicitado_a: null,
            cuotas_pagadas: (cuenta.cuotas_pagadas || 0) + 1
          })
          .eq("id", cuenta.id);

        if (error) throw error;
        toast.success("¡Cuota pagada por completo! 🎉", { id: toastId });
      }

      // Insertar en el historial de gastos
      await supabase.from("gastos").insert([
        {
          concepto: `Pago: ${cuenta.descripcion.split("|")[0]}`,
          monto: abono,
          categoria: "Préstamo",
          pagador_id: usuarioActual.id,
          para_quien: cuenta.responsable,
          moneda: cuenta.moneda,
          espacio_id: datosHogar?.espacios?.id || datosHogar?.id
        },
      ]);

      obtenerDatos();
    } catch (error) {
      toast.error("Error al procesar el pago: " + error.message, { id: toastId });
    }
  }

  async function liquidarTodo(maestraId) {
    if (!usuarioActual) return;
    if (window.confirm("¿Estás seguro de liquidar todas las cuotas de esta cuenta?")) {
      const toastId = toast.loading("Liquidando cuotas...");
      
      const { data: cuotasPendientes, error: errorFetch } = await supabase
        .from("cuentas_pendientes")
        .select("*")
        .eq("maestra_id", maestraId)
        .eq("estado", "Pendiente");

      if (errorFetch) return toast.error("Error al buscar cuotas", { id: toastId });

      const { error: errorUpdate } = await supabase
        .from("cuentas_pendientes")
        .update({
          estado: "Pagado",
          fecha_ultimo_pago: new Date().toISOString(),
          pagador_id: usuarioActual.id,
        })
        .eq("maestra_id", maestraId)
        .eq("estado", "Pendiente");

      if (errorUpdate) return toast.error("Error al actualizar", { id: toastId });

      const totalMonto = cuotasPendientes.reduce((acc, c) => acc + c.monto, 0);
      if (totalMonto > 0) {
        await supabase.from("gastos").insert([
          {
            concepto: `Liquidación total: ${cuotasPendientes[0].descripcion.split("(")[0]}`,
            monto: totalMonto,
            categoria: "Préstamo",
            pagador_id: usuarioActual.id,
            para_quien: cuotasPendientes[0].responsable,
            moneda: cuotasPendientes[0].moneda,
            espacio_id: datosHogar?.espacios?.id || datosHogar?.id
          },
        ]);
      }

      toast.success("¡Cuenta liquidada por completo! 💸", { id: toastId });
      obtenerDatos();
    }
  }

  async function eliminarCuenta(cuenta) {
    const isAdmin = datosHogar?.rol === 'admin';
    if (!isAdmin) return toast.error("Solo administradores pueden eliminar.");

    if (window.confirm(`¿Estás seguro de eliminar "${cuenta.descripcion}"?`)) {
      const toastId = toast.loading("Eliminando...");
      
      if (cuenta.maestra_id) {
        await supabase.from("cuentas_pendientes").delete().eq("maestra_id", cuenta.maestra_id);
        await supabase.from("cuentas_maestras").delete().eq("id", cuenta.maestra_id);
      } else {
        await supabase.from("cuentas_pendientes").delete().eq("id", cuenta.id);
      }

      toast.success("Eliminado correctamente", { id: toastId });
      obtenerDatos();
    }
  }

  async function abonarPrestamo(prestamo) {
    const restante = prestamo.monto_total - prestamo.monto_pagado;
    const abonoStr = prompt(
      `¿Cuántos ${prestamo.moneda} querés abonar? (Saldar: ${formatearNumero(restante, prestamo.moneda)})`,
    );
    if (!abonoStr || isNaN(abonoStr)) return;
    const abono = parseFloat(abonoStr);
    if (abono <= 0 || abono > restante) return toast.error("Monto inválido.");

    const nuevoPagado = Number(prestamo.monto_pagado) + abono;
    const estaSaldado = nuevoPagado >= prestamo.monto_total;
    
    await supabase
      .from("prestamos_personales")
      .update({
        monto_pagado: nuevoPagado,
        estado: estaSaldado ? "Pagado" : "Pendiente",
      })
      .eq("id", prestamo.id);

    await supabase
      .from("gastos")
      .insert([
        {
          concepto: `Devolución préstamo: ${prestamo.concepto}`,
          monto: abono,
          categoria: "Préstamo",
          pagador_id: prestamo.deudor_id,
          para_quien: prestamo.deudor_id === usuarioActual.id ? otroUsuario?.nombre : usuarioActual.nombre,
          moneda: prestamo.moneda,
          espacio_id: datosHogar?.espacios?.id || datosHogar?.id
        },
      ]);
    toast.success("¡Abono registrado! 💸");
    cargarPrestamosInformales();
    obtenerDatos();
  }

  const getNombreUsuario = (id) => usuarios.find(u => u.id === id)?.nombre || "Usuario";
  const fuePagadoEsteMes = (fecha) => {
    if (!fecha) return false;
    const hoy = new Date();
    const f = new Date(fecha);
    return f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear();
  };

  return (
    <div className="pantalla-cuentas">
      <div className="header-seccion">
        <h2>Cuentas y Deudas</h2>
        <button onClick={() => setMostrarModal(true)} className="btn-agregar">
          <Plus size={20} /> Nueva Deuda
        </button>
      </div>

      {/* PRÉSTAMOS INFORMALES */}
      {prestamosInformales.some(p => p.estado !== 'Pagado') && (
        <div className="card glass">
          <h3 className="titulo-card"><Handshake size={20} /> Préstamos entre Nosotros</h3>
          <div className="lista-mini">
            {prestamosInformales.filter(p => p.estado !== 'Pagado').map(p => (
              <div key={p.id} className="item-mini">
                <div className="info">
                  <strong>{p.concepto}</strong>
                  <span>{getNombreUsuario(p.acreedor_id)} → {getNombreUsuario(p.deudor_id)}</span>
                  <div className="progreso-bar">
                    <div className="progreso" style={{ width: `${(p.monto_pagado / p.monto_total) * 100}%` }}></div>
                  </div>
                </div>
                <div className="monto-accion">
                  <span className="deuda-pendiente">{formatearNumero(p.monto_total - p.monto_pagado, p.moneda)}</span>
                  <button onClick={() => abonarPrestamo(p)} className="btn-mini-pagar">Abonar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CUENTAS EXTERNAS */}
      <div className="lista-cuentas">
        {cuentas.filter(c => c.estado !== 'Pagado').length === 0 ? (
          <div className="vacio glass">
            <CheckCircle size={48} color="#28a745" />
            <p>¡Tranquilidad total! No hay deudas pendientes.</p>
          </div>
        ) : (
          cuentas.filter(c => c.estado !== 'Pagado').map((cuenta) => {
            const pagadoMes = fuePagadoEsteMes(cuenta.fecha_ultimo_pago);
            const esTarjeta = cuenta.descripcion.includes("💳");
            
            return (
              <div key={cuenta.id} className={`tarjeta-cuenta glass ${pagadoMes ? 'mes-pagado' : ''}`}>
                <div className="info-principal">
                  <div className="icono">
                    {esTarjeta ? <CreditCard size={24} /> : <Calendar size={24} />}
                  </div>
                  <div>
                    <h4>{cuenta.descripcion}</h4>
                    <p className="responsable">Responsable: {cuenta.responsable}</p>
                    <div className="badge-fecha">
                      {pagadoMes ? '✅ Pagado este mes' : `🗓️ Vence el día ${cuenta.dia_vencimiento}`}
                    </div>
                  </div>
                </div>

                <div className="monto-seccion">
                  <div className="monto">
                    <small>{esTarjeta ? 'Pago sugerido' : 'Monto'}</small>
                    <span>{formatearNumero(cuenta.monto, cuenta.moneda)}</span>
                  </div>
                  {cuenta.maestra_id && (
                    <div className="cuotas-info">
                      Cuota {cuenta.cuotas_pagadas + 1} de {cuenta.total_cuotas}
                    </div>
                  )}
                </div>

                {!pagadoMes && (
                  <div className="acciones-tarjeta">
                    <button onClick={() => marcarPagado(cuenta)} className="btn-pagar">Pagar</button>
                    {cuenta.maestra_id && (
                      <button onClick={() => liquidarTodo(cuenta.maestra_id)} className="btn-liquidar">Liquidar Todo</button>
                    )}
                    {datosHogar?.rol === 'admin' && (
                      <button onClick={() => eliminarCuenta(cuenta)} className="btn-eliminar">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* MODAL REGISTRO */}
      {mostrarModal && (
        <div className="modal-overlay">
          <div className="modal-content glass">
            <div className="modal-header">
              <h3>Registrar Compromiso</h3>
              <button onClick={cerrarModal} className="btn-cerrar">×</button>
            </div>
            
            <form onSubmit={guardarDeuda}>
              <div className="tipo-selector">
                <button type="button" className={tipoCuenta === 'unica' ? 'active' : ''} onClick={() => setTipoCuenta('unica')}>Única</button>
                <button type="button" className={tipoCuenta === 'cuotas' ? 'active' : ''} onClick={() => setTipoCuenta('cuotas')}>Cuotas</button>
                <button type="button" className={tipoCuenta === 'tarjeta' ? 'active' : ''} onClick={() => setTipoCuenta('tarjeta')}>Tarjeta</button>
                <button type="button" className={tipoCuenta === 'informal' ? 'active' : ''} onClick={() => setTipoCuenta('informal')}>Pareja</button>
              </div>

              <div className="campo">
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                  <div style={{ flex: 2 }}>
                    <label>Descripción / Concepto</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Alquiler, Préstamo Banco, etc." 
                      value={titulo} 
                      onChange={(e) => setTitulo(e.target.value)} 
                      required 
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Moneda</label>
                    <select value={monedaDeuda} onChange={(e) => setMonedaDeuda(e.target.value)} style={{ padding: "10px", borderRadius: "8px", width: "100%" }}>
                      <option value="PYG">PYG (Gs)</option>
                      <option value="BRL">BRL (R$)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>
              </div>

              {tipoCuenta === 'tarjeta' ? (
                <div className="seccion-tarjeta">
                  <div className="fila">
                    <input type="text" placeholder="Banco" value={bancoTarjeta} onChange={(e) => setBancoTarjeta(e.target.value)} required />
                    <input type="text" placeholder="Últimos 4 dígitos" value={numeroTarjeta} onChange={(e) => setNumeroTarjeta(e.target.value)} maxLength="4" required />
                  </div>
                  <input type="number" placeholder="Límite de Crédito" value={limiteCredito} onChange={(e) => setLimiteCredito(e.target.value)} required />
                  <input type="number" placeholder="Pago del Mes (Opcional)" value={montoInput} onChange={(e) => setMontoInput(e.target.value)} />
                </div>
              ) : (
                <div className="fila">
                  <div className="campo">
                    <label>Monto {tipoCuenta === 'cuotas' ? 'Total' : ''}</label>
                    <input type="number" value={montoInput} onChange={(e) => setMontoInput(e.target.value)} required />
                  </div>
                  {tipoCuenta === 'cuotas' && (
                    <div className="campo">
                      <label>Cuotas</label>
                      <input type="number" value={cantidadCuotas} onChange={(e) => setCantidadCuotas(e.target.value)} min="2" required />
                    </div>
                  )}
                </div>
              )}

              {tipoCuenta !== 'informal' && (
                <>
                  <div className="fila">
                    <div className="campo">
                      <label>Día de Vencimiento</label>
                      <input type="number" min="1" max="31" value={diaVencimiento} onChange={(e) => setDiaVencimiento(e.target.value)} required />
                    </div>
                    <div className="campo">
                      <label>Responsable</label>
                      <select value={responsableCuenta} onChange={(e) => setResponsableCuenta(e.target.value)}>
                        <option value="Ambos">Ambos</option>
                        {usuarios.map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
                      </select>
                    </div>
                  </div>

                  {(tipoCuenta === 'unica' || tipoCuenta === 'cuotas') && (
                    <div className="checkbox-group">
                      <input type="checkbox" id="flexi" checked={permitePagoParcial} onChange={(e) => setPermitePagoParcial(e.target.checked)} />
                      <label htmlFor="flexi">Permitir pagos parciales (abonos)</label>
                    </div>
                  )}
                </>
              )}

              {tipoCuenta === 'informal' && (
                <div className="campo">
                  <label>¿Quién recibe el dinero?</label>
                  <select value={deudorId} onChange={(e) => setDeudorId(e.target.value)} required>
                    <option value="">Seleccionar...</option>
                    {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                  </select>
                </div>
              )}

              {monedaDeuda !== "PYG" && (
                <div className="campo" style={{ marginBottom: "15px", padding: "10px", backgroundColor: "rgba(100, 108, 255, 0.1)", borderRadius: "8px", border: "1px solid #646cff" }}>
                  <label style={{ color: "#646cff", fontWeight: "bold", fontSize: "12px" }}>
                    Cotización sugerida (1 {monedaDeuda} = ? PYG)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={tasaCambio}
                    onChange={(e) => setTasaCambio(e.target.value)}
                    required
                  />
                  <small style={{ color: "#4ade80", display: "block", marginTop: "5px", textAlign: "right", fontWeight: "bold" }}>
                    Equivale a: {formatearNumero((montoInput || 0) * tasaCambio, "PYG")}
                  </small>
                </div>
              )}

              <div className="acciones-modal">
                <button type="submit" className="btn-confirmar">Confirmar Registro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
