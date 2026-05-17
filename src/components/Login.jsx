import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { User, Lock, ArrowRight, Loader2 } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setCargando(true);
    const toastId = toast.loading("Verificando acceso...");

    try {
      let emailFinal = username.trim();

      // Si no parece un email, intentamos buscarlo como nombre en la nueva tabla perfiles
      if (!emailFinal.includes("@")) {
        const { data: perfil, error: errP } = await supabase
          .from("perfiles")
          .select("id")
          .ilike("nombre", emailFinal)
          .maybeSingle();

        // Si encontramos el perfil, necesitamos su email. 
        // Como no tenemos el email en perfiles (está en auth.users),
        // este flujo de "entrar por nombre" requiere que el nombre sea único o usar email directo.
        // OPTIMIZACIÓN: Si el usuario puso un nombre y no lo hallamos, avisamos.
        if (errP) console.warn("Nota: Búsqueda por nombre limitada por RLS inicial.");
        
        // Si no lo hallamos por nombre, forzamos a que ingrese su email
        if (!perfil) {
          throw new Error("Por favor, ingresá tu correo electrónico para el primer inicio en la 2.0.");
        }
        
        // En Supabase Auth, si no tenemos el email, no podemos loguear solo con ID desde el cliente por seguridad.
        // Por lo tanto, el estándar en la 2.0 será usar EMAIL para loguear.
      }

      const { error: errorAuth } = await supabase.auth.signInWithPassword({
        email: emailFinal,
        password: password,
      });

      if (errorAuth) {
        console.error("🚨 Error de Supabase Auth:", errorAuth);
        throw new Error(errorAuth.message || "Credenciales inválidas. Revisá tu email y contraseña. ❌");
      }

      toast.success(`¡Bienvenido de vuelta! 🚀`, { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      {/* FONDO PATRIO DIFUMINADO (Rojo, Blanco, Azul) - HU-28 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[500px] h-[500px] bg-red-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
        <div className="absolute top-[20%] -right-[10%] w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen"></div>
        <div className="absolute -bottom-[20%] left-[20%] w-[500px] h-[500px] bg-white/10 rounded-full blur-[100px] mix-blend-screen"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-500/20 mb-4">
            <span className="text-white text-3xl font-bold italic">Ñ</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">ÑandeFinanza</h1>
          <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.2em] mt-1">🇵🇾 Sistema 100% Paraguayo</p>
          <p className="text-slate-400 mt-2 text-sm italic">Hecho con ❤️ y mucho Tereré 🧉</p>
        </div>

        <div className="glass-card border-white/10 p-8">
          <h2 className="text-xl font-semibold text-white mb-6">Iniciar Sesión</h2>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Correo Electrónico</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type="email"
                  placeholder="Ej: edison@correo.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Contraseña</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-white placeholder:text-slate-600 focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/10 transition-all outline-none"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {cargando ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Entrar <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-slate-500 text-sm mt-8">
          ¿No tienen cuenta? Contacten con el administrador de su hogar.
        </p>
      </motion.div>
    </div>
  );
}
