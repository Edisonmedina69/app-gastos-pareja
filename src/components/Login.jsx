import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, ArrowRight, Loader2, Sparkles, Key, Users } from "lucide-react";

export default function Login() {
  const [modo, setModo] = useState("login"); // 'login' | 'unirme'
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleAuth(e) {
    e.preventDefault();
    setCargando(true);
    const toastId = toast.loading(modo === 'login' ? "Entrando..." : "Vinculando hogar...");

    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (error) throw error;
        toast.success("¡Haupei! Ya estás dentro. 🚀", { id: toastId });
      } else {
        // --- FLUJO UNIRME A FAMILIA (Para Bianca) ---
        // 1. Crear la cuenta en Auth
        const { data: authData, error: errorAuth } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });

        if (errorAuth) throw errorAuth;
        if (!authData.user) throw new Error("No se pudo crear el usuario.");

        // 2. Buscar el espacio por código
        const { data: espacio, error: errE } = await supabase
          .from('espacios')
          .select('id, limite_usuarios, perfiles(id)')
          .eq('codigo_invitacion', codigo.trim().toUpperCase())
          .single();

        if (errE || !espacio) throw new Error("Código de invitación inválido. Pedile a tu pareja el código correcto.");
        
        if (espacio.perfiles?.length >= espacio.limite_usuarios) {
          throw new Error("El hogar ya está lleno. El admin debe subir de plan.");
        }

        // 3. Crear el perfil vinculado al instante
        const { error: errP } = await supabase.from('perfiles').insert([{
          id: authData.user.id,
          nombre: nombre.trim(),
          espacio_id: espacio.id,
          rol: 'miembro'
        }]);

        if (errP) throw errP;

        toast.success("¡Bienvenida a la familia! 🏠✨ Ya podés entrar.", { id: toastId, duration: 5000 });
        setModo("login");
      }
    } catch (err) {
      toast.error(err.message || "Error al procesar. Revisá tus datos.", { id: toastId });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
        <div className="absolute -top-[10%] -left-[10%] w-[500px] h-[500px] bg-red-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px]" />
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20 mb-3">
            <Sparkles className="text-white w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tighter italic">ÑandeFinanza 2.0</h1>
          <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Organización Real para Parejas</p>
        </div>

        <div className="glass-card p-6 border-white/10 shadow-2xl relative">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 mb-6">
            <button onClick={() => setModo('login')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${modo === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Entrar</button>
            <button onClick={() => setModo('unirme')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${modo === 'unirme' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Unirme a Hogar 🏠</button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {modo === 'unirme' && (
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Tu Nombre</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                  <input type="text" placeholder="Ej: Bianca" value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm outline-none focus:border-indigo-500/50" required />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Correo Electrónico</label>
              <input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 px-4 text-white text-sm outline-none focus:border-indigo-500/50" required />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-500 uppercase ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 w-4 h-4" />
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm outline-none focus:border-indigo-500/50" required />
              </div>
            </div>

            {modo === 'unirme' && (
              <div className="space-y-1">
                <label className="text-[9px] font-black text-amber-500 uppercase ml-1 flex items-center gap-1"><Key size={10}/> Código de Familia</label>
                <input type="text" placeholder="ABCDEF" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} className="w-full bg-amber-500/5 border border-amber-500/20 rounded-xl py-3 px-4 text-white font-black tracking-widest outline-none focus:border-amber-500/50" required />
              </div>
            )}

            <button type="submit" disabled={cargando} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
              {cargando ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{modo === 'login' ? 'INICIAR SESIÓN' : 'VINCULAR MI CUENTA'} <ArrowRight size={18} /></>}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-600 text-[10px] font-bold mt-8 uppercase tracking-tighter">
          {modo === 'login' ? "Sistema Seguro 🛡️" : "Unite a tu pareja para ver los gastos juntos"}
        </p>
      </motion.div>
    </div>
  );
}
