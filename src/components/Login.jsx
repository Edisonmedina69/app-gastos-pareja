import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, ArrowRight, Loader2, Sparkles, Key, ShieldCheck, Mail } from "lucide-react";

export default function Login() {
  const [modo, setModo] = useState("login"); // 'login' | 'unirme'
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleAuth(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    
    setCargando(true);
    const toastId = toast.loading(modo === 'login' ? "Verificando acceso..." : "Vinculando hogar patriótico...");

    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (error) throw new Error("Credenciales inválidas. Revisá tu email y contraseña.");
        toast.success(`¡Bienvenido de vuelta! 🚀`, { id: toastId });
      } else {
        // --- FLUJO UNIRME (Registro con Email y Código) ---
        if (!nombre.trim()) throw new Error("Por favor, ingresá tu nombre.");
        
        // 1. Crear usuario en Auth
        const { data: authData, error: errorAuth } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (errorAuth) throw errorAuth;
        if (!authData.user) throw new Error("No se pudo crear la cuenta.");

        // 2. Si hay código, intentar vincular
        if (codigo.trim()) {
          const { data: espacio, error: errE } = await supabase
            .from('espacios')
            .select('id, limite_usuarios, perfiles(id)')
            .eq('codigo_invitacion', codigo.trim().toUpperCase())
            .single();

          if (errE || !espacio) throw new Error("Código de familia inválido.");

          // Verificar límite de usuarios
          const miembrosActuales = espacio.perfiles?.length || 0;
          if (miembrosActuales >= espacio.limite_usuarios) {
            throw new Error(`Límite de usuarios alcanzado (${espacio.limite_usuarios}) para este hogar. Contactá al administrador.`);
          }
          
          // 3. Crear Perfil vinculado
          const { error: errP } = await supabase.from('perfiles').insert([{
            id: authData.user.id,
            nombre: nombre.trim(),
            espacio_id: espacio.id,
            rol: 'miembro'
          }]);

          if (errP) throw errP;
          toast.success("¡Vinculación exitosa! 🏠✨", { id: toastId });
        } else {
          // Si no hay código, el usuario se crea pero sin perfil. 
          // App.jsx detectará que no hay perfil y mostrará ConfiguracionHogar.
          toast.success("¡Cuenta creada! Configurá tu hogar a continuación.", { id: toastId });
        }
        
        // No necesitamos setModo("login") aquí porque la sesión ya se inicia con signUp
        // y App.jsx reaccionará al cambio de sesión.
      }
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
          {/* TABS PARA CAMBIAR ENTRE ENTRAR Y UNIRME */}
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 mb-8">
            <button onClick={() => setModo('login')} className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-lg transition-all ${modo === 'login' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Entrar</button>
            <button onClick={() => setModo('unirme')} className={`flex-1 py-2.5 text-[10px] font-black uppercase rounded-lg transition-all ${modo === 'unirme' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>Crear Cuenta ✨</button>
          </div>

          <h2 className="text-xl font-semibold text-white mb-6">
            {modo === 'login' ? "Iniciar Sesión" : "Crear mi Perfil"}
          </h2>
          
          <form onSubmit={handleAuth} className="space-y-5">
            {modo === 'unirme' && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Tu Nombre o Apodo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                  <input type="text" placeholder="Ej: Bianca" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-indigo-500/50 transition-all" required />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Correo Electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-indigo-500/50 transition-all" required />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-indigo-500/50 transition-all" required />
              </div>
            </div>

            {modo === 'unirme' && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1">
                <label className="text-[10px] font-bold text-amber-500 uppercase tracking-wider ml-1 flex items-center gap-1"><Key size={12}/> Código de Invitación (Opcional)</label>
                <input type="text" placeholder="ABCDEF" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} className="w-full bg-amber-500/5 border border-amber-500/20 rounded-xl py-3 px-4 text-white font-black tracking-[0.3em] outline-none focus:border-amber-500/50 text-center uppercase" />
                <p className="text-[9px] text-slate-500 mt-1 ml-1">Si vas a crear un hogar nuevo, dejalo en blanco.</p>
              </motion.div>
            )}

            <button type="submit" disabled={cargando} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95 flex items-center justify-center gap-2">
              {cargando ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{modo === 'login' ? 'ENTRAR' : 'CREAR MI CUENTA'} <ArrowRight size={18} /></>}
            </button>
          </form>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2">
           <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
             <ShieldCheck size={14} className="text-indigo-400" /> Sistema Seguro con Encriptación Bancaria 🛡️
           </p>
        </div>
      </motion.div>
    </div>
  );
}
