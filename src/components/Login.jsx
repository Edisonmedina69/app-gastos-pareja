import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";
import { User, Lock, Eye, EyeOff, Loader2 } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    if (loading) return;

    setLoading(true);
    const toastId = toast.loading("Verificando credenciales...");

    try {
      // 1. Buscamos el email por el nombre (ilike para ignorar mayúsculas)
      const { data: userDb, error: fetchError } = await supabase
        .from("usuarios")
        .select("email")
        .ilike("nombre", username.trim())
        .maybeSingle();

      if (fetchError || !userDb) {
        throw new Error("El usuario no existe en el sistema.");
      }

      // 2. Intentamos el login oficial
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: userDb.email,
        password,
      });

      if (loginError) throw new Error("La contraseña es incorrecta.");

      toast.success("¡Bienvenido, eju poytáva! 🚀", { id: toastId });
    } catch (err) {
      toast.error(err.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <header style={{ marginBottom: "2rem" }}>
          <div className="logo-icon">💸</div>
          <h1 className="login-title">ÑandeFinanza</h1>
          <p className="login-subtitle">Gestión inteligente para parejas</p>
        </header>

        <form onSubmit={handleLogin} className="login-form">
          {/* Campo de Usuario */}
          <div className="form-group">
            <label>Usuario</label>
            <div className="input-wrapper">
              <User className="input-icon" size={18} />
              <input
                type="text"
                placeholder="Ej: Edison"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Campo de Contraseña */}
          <div className="form-group">
            <label>Contraseña</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn-pro" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="spinner" size={20} />
                <span>Ingresando...</span>
              </>
            ) : (
              "Iniciar Sesión"
            )}
          </button>
        </form>

        <footer className="login-footer">
          <div className="py-badge">
            <span className="flag">🇵🇾</span>
            <span className="badge-text">100% PARAGUAYO</span>
          </div>
          <p className="credits">
            Desarrollado en <strong>Katuete</strong> por Canindevs
          </p>
        </footer>
      </div>
    </div>
  );
}
