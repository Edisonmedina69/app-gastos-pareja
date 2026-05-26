import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { User, Lock, ArrowRight, Loader2, Sparkles, Key } from "lucide-react";

export default function Login() {
  const [modo, setModo] = useState("login"); // 'login' | 'registro'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleAuth(e) {
    e.preventDefault();
    setCargando(true);
    const toastId = toast.loading(modo === 'login' ? "Verificando acceso..." : "Creando cuenta patriótica...");

    try {
      if (modo === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (error) throw error;
        toast.success("¡Bienvenido de vuelta! 🚀", { id: toastId });
      } else {
        // Modo Registro
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: password,
        });
        if (error) throw error;
        toast.success("¡Cuenta creada! Revisá tu email para confirmar y luego vinculá tu código.", { id: toastId, duration: 6000 });
        setModo("login");
      }
    } catch (err) {
      toast.error(err.message || "Ocurrió un error. Revisá tus datos. ❌", { id: toastId });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      {/* FONDO PATRIO */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[120px]" />
        <div className="absolute top-[20%] -right-[10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20 mb-4">
            <Sparkles className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight italic">ÑandeFinanza</h1>
          <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest font-bold">Gestión de Gastos en Pareja 🇵🇾</p>
        </div>

        <div className="glass-card p-8 border-white/10 shadow-2xl relative overflow-hidden">
          <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 mb-8">
            <button onClick={() => setModo('login')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${modo === 'login' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Entrar</button>
            <button onClick={() => setModo('registro')} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${modo === 'registro' ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>Registrarme</button>
          </div>

          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            {modo === 'login' ? "Bienvenido, Kape" : "Unite a la Familia"}
          </h2>
          
          <form onSubmit={handleAuth} className="space-y-5">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Email</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-indigo-500/50" required />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-900 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white outline-none focus:border-indigo-500/50" required />
              </div>
            </div>

            <button type="submit" disabled={cargando} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2">
              {cargando ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{modo === 'login' ? 'ENTRAR' : 'CREAR MI CUENTA'} <ArrowRight size={18} /></>}
            </button>
          </form>

          {modo === 'registro' && (
            <div className="mt-6 p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex gap-3 items-start">
              <Key className="text-indigo-400 shrink-0" size={18} />
              <p className="text-[10px] text-indigo-300 leading-relaxed italic">
                * Luego de registrarte y confirmar tu email, el sistema te pedirá el <b>Código de Invitación</b> para unirte a un hogar.
              </p>
            </div>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-8 font-medium">
          Sistema Seguro con Encriptación Bancaria 🛡️
        </p>
      </motion.div>
    </div>
  );
}
