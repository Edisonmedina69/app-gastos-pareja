import { useState } from "react";
import { iniciarSesion } from "../../../services/auth.service";
import { toast } from "react-hot-toast";
import { motion } from "framer-motion";
import { Lock, ArrowRight, ShieldCheck, Mail } from "lucide-react";
import { Button, Input, Label } from "../../../shared/ui";

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

      const { error } = await iniciarSesion(emailNormalizado, password);
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

        <div className="glass-card border-white/10 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          <h2 className="text-xl font-semibold text-white mb-6">
            Iniciar Sesión
          </h2>
          
          <form onSubmit={handleAuth} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="login-usuario">Usuario o Correo</Label>
              <div className="relative">
                <Mail aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <Input id="login-usuario" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="Ej: edison o tu@email.com" value={usuario} onChange={(e) => setUsuario(e.target.value)} className="bg-slate-900/50 pl-11" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="login-password">Contraseña</Label>
              <div className="relative">
                <Lock aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
                <Input id="login-password" type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="bg-slate-900/50 pl-11" required />
              </div>
            </div>

            <Button type="submit" tamano="lg" cargando={cargando} className="w-full">
              ENTRAR <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </form>

        </div>
      </motion.div>
    </div>
  );
}
