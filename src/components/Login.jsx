import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Lock, ArrowRight, Loader2, ShieldCheck, Mail } from "lucide-react";

export default function Login() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

  function normalizarUsuario(input) {
    const trimValue = input.trim().toLowerCase();
    if (trimValue.includes("@")) {
      return trimValue;
    }
    // Casos especiales para el superadmin (Edison)
    if (trimValue === "edison" || trimValue === "edisonmedina" || trimValue === "edisonmedina415") {
      return "edisonmedina415@gmail.com";
    }
    // Si es un nombre de usuario simple, creamos un email virtual
    return `${trimValue}@nandefinanza.com`;
  }

  async function handleAuth(e) {
    e.preventDefault();
    if (!usuario.trim() || !password.trim()) return;

    setCargando(true);
    const toastId = toast.loading("Verificando acceso...");

    try {
      const emailNormalizado = normalizarUsuario(usuario);

      const { error } = await supabase.auth.signInWithPassword({
        email: emailNormalizado,
        password: password,
      });
      if (error) {
        throw new Error("Credenciales inválidas. Revisá tu usuario y contraseña.");
      }
      toast.success("¡Bienvenido de vuelta! 🚀", { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      {/* DISEÑO LINDO: BLOBS PATRIOS (Rojo, Blanco, Azul) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[500px] h-[500px] bg-red-600/20 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute top-[20%] -right-[10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute -bottom-[20%] left-[20%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px] mix-blend-screen" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20 mb-4">
            <span className="text-white text-3xl font-bold italic">Ñ</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ÑandeFinanza</h1>
          <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">🇵🇾 Sistema 100% Paraguayo</p>
          <p className="text-slate-400 mt-2 text-sm italic">Hecho con ❤️ y mucho Tereré 🧉</p>
        </div>

        <div className="glass-card border-white/10 p-8 shadow-2xl relative overflow-hidden">
          <h2 className="text-xl font-semibold text-white mb-6">
            Iniciar Sesión
          </h2>
          
          <form onSubmit={handleAuth} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Usuario o Correo</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input type="text" placeholder="Ej: edison o tu@email.com" value={usuario} onChange={(e) => setUsuario(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-indigo-500/50 transition-all" required />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-indigo-500/50 transition-all" required />
              </div>
            </div>

            <button type="submit" disabled={cargando} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
              {cargando ? <Loader2 className="w-5 h-5 animate-spin" /> : <>ENTRAR <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <p className="text-xs text-slate-400 mb-3">¿Querés probar la app sin registrarte?</p>
            <button
              type="button"
              disabled={cargando}
              onClick={async () => {
                setCargando(true);
                const toastId = toast.loading("Ingresando al entorno Demo...");
                try {
                  const demoEmail = "demo@nandefinanza.com";
                  const demoPass = "demo123456";

                  // Intentar iniciar sesión
                  let { data: authData, error } = await supabase.auth.signInWithPassword({
                    email: demoEmail,
                    password: demoPass,
                  });

                  // Si el usuario no existe en Supabase Auth todavía, crearlo al instante
                  if (error) {
                    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                      email: demoEmail,
                      password: demoPass,
                      options: {
                        data: { nombre: "Usuario Demo" }
                      }
                    });

                    if (signUpError) {
                      throw new Error("No se pudo iniciar el modo demo: " + signUpError.message);
                    }

                    // Intentar iniciar sesión nuevamente
                    const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
                      email: demoEmail,
                      password: demoPass,
                    });
                    if (retryError) {
                      throw new Error("El usuario demo se creó pero requiere confirmación de email en Supabase.");
                    }
                    authData = retryData;
                  }

                  // ASEGURAR SIEMBRA DIRECTA DE DATOS DEMO EN SUPABASE
                  if (authData?.user) {
                    const usuarioId = authData.user.id;
                    let { data: espacios } = await supabase.from('espacios').select('id').eq('nombre_familia', 'Hogar Demo 🧪').limit(1);
                    let espacioId = espacios && espacios.length > 0 ? espacios[0].id : null;

                    if (!espacioId) {
                      const { data: nuevoEspacio } = await supabase.from('espacios').insert([{ nombre_familia: 'Hogar Demo 🧪' }]).select('id').single();
                      if (nuevoEspacio) espacioId = nuevoEspacio.id;
                    }

                    if (espacioId) {
                      await supabase.from('perfiles').upsert([{
                        id: usuarioId,
                        nombre: "Invitado Demo 🧪",
                        rol: 'miembro',
                        espacio_id: espacioId
                      }]);

                      const hoy = new Date();

                      // 1. Ingresos
                      const { data: exIng } = await supabase.from('ingresos_mensuales').select('id').eq('espacio_id', espacioId).limit(1);
                      if (!exIng || exIng.length === 0) {
                        await supabase.from('ingresos_mensuales').insert([
                          { espacio_id: espacioId, usuario_id: usuarioId, monto: 8500000, moneda: 'PYG', concepto: 'Salario Titular', mes: hoy.getMonth() + 1, anio: hoy.getFullYear() },
                          { espacio_id: espacioId, usuario_id: usuarioId, monto: 5200000, moneda: 'PYG', concepto: 'Ingreso Pareja', mes: hoy.getMonth() + 1, anio: hoy.getFullYear() }
                        ]);
                      }

                      // 2. Gastos
                      const { data: exGas } = await supabase.from('gastos').select('id').eq('espacio_id', espacioId).limit(1);
                      if (!exGas || exGas.length === 0) {
                        await supabase.from('gastos').insert([
                          { espacio_id: espacioId, usuario_id: usuarioId, pagador_id: usuarioId, concepto: 'Supermercado Stock - Compras del Mes', monto: 2200000, moneda: 'PYG', categoria: 'Alimentación', para_quien: 'Ambos' },
                          { espacio_id: espacioId, usuario_id: usuarioId, pagador_id: usuarioId, concepto: 'Alquiler Departamento', monto: 3500000, moneda: 'PYG', categoria: 'Vivienda', para_quien: 'Ambos' },
                          { espacio_id: espacioId, usuario_id: usuarioId, pagador_id: usuarioId, concepto: 'Carga de Combustible Petrobras', monto: 650000, moneda: 'PYG', categoria: 'Transporte', para_quien: 'Yo' },
                          { espacio_id: espacioId, usuario_id: usuarioId, pagador_id: usuarioId, concepto: 'Cena de Fin de Semana', monto: 450000, moneda: 'PYG', categoria: 'Entretenimiento', para_quien: 'Ambos' },
                          { espacio_id: espacioId, usuario_id: usuarioId, pagador_id: usuarioId, concepto: 'Factura ANDE Luz', monto: 380000, moneda: 'PYG', categoria: 'Servicios', para_quien: 'Ambos' }
                        ]);
                      }

                      // 3. Deudas Maestra
                      const { data: exDeu } = await supabase.from('deudas_maestras').select('id').eq('espacio_id', espacioId).limit(1);
                      if (!exDeu || exDeu.length === 0) {
                        const { data: d1 } = await supabase.from('deudas_maestras').insert([{
                          espacio_id: espacioId, creador_id: usuarioId, titulo: 'Tarjeta Crédito Itaú - TV Smart 55"',
                          tipo: 'fija', alcance: 'familiar', moneda: 'PYG', estado: 'activa'
                        }]).select('id').single();
                        if (d1) {
                          await supabase.from('cuotas_detalle').insert([
                            { deuda_maestra_id: d1.id, espacio_id: espacioId, numero_cuota: 1, monto_cuota: 400000, monto_abonado: 400000, estado: 'pagado', fecha_vencimiento: `${hoy.getFullYear()}-${String(hoy.getMonth()).padStart(2, '0')}-25` },
                            { deuda_maestra_id: d1.id, espacio_id: espacioId, numero_cuota: 2, monto_cuota: 400000, monto_abonado: 0, estado: 'pendiente', fecha_vencimiento: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-25` }
                          ]);
                        }

                        const { data: d2 } = await supabase.from('deudas_maestras').insert([{
                          espacio_id: espacioId, creador_id: usuarioId, titulo: 'Préstamo Auto Banco Continental',
                          tipo: 'fija', alcance: 'familiar', tasa_interes: 14.5, moneda: 'PYG', estado: 'activa'
                        }]).select('id').single();
                        if (d2) {
                          await supabase.from('cuotas_detalle').insert([
                            { deuda_maestra_id: d2.id, espacio_id: espacioId, numero_cuota: 1, monto_cuota: 1550000, monto_abonado: 0, estado: 'pendiente', fecha_vencimiento: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-10` }
                          ]);
                        }

                        const { data: d3 } = await supabase.from('deudas_maestras').insert([{
                          espacio_id: espacioId, creador_id: usuarioId, titulo: 'Tarjeta Sudameris Visa Signature',
                          tipo: 'tarjeta_credito', nro_tarjeta: '8842', linea_credito_total: 15000000, linea_credito_disponible: 12600000, fecha_cierre_tarjeta: 20, alcance: 'individual', moneda: 'PYG', estado: 'activa'
                        }]).select('id').single();
                        if (d3) {
                          await supabase.from('cuotas_detalle').insert([
                            { deuda_maestra_id: d3.id, espacio_id: espacioId, numero_cuota: 1, monto_cuota: 2400000, pago_minimo: 850000, monto_abonado: 0, estado: 'pendiente', fecha_vencimiento: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-05` }
                          ]);
                        }
                      }
                    }
                  }

                  toast.success("¡Bienvenido al Modo Demo Instantáneo! 🧪", { id: toastId });
                } catch (err) {
                  toast.error(err.message, { id: toastId });
                } finally {
                  setCargando(false);
                }
              }}
              className="w-full bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 font-bold py-3 px-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
            >
              <span>🧪</span> PROBAR DEMO INSTANTÁNEA (1-CLIC)
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
