// src/components/Login.jsx
import { useState } from "react";
import { supabase } from "../supabase";
import { toast } from "react-hot-toast";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    const toastId = toast.loading("Buscando usuario...");

    // PASO 1: Buscar el correo del usuario en la tabla "usuarios"
    // Usamos .ilike() para que no importe si escribís "edison", "Edison" o "EDISON"
    const { data: usuarioDb, error: errorBusqueda } = await supabase
      .from("usuarios")
      .select("email")
      .ilike("nombre", username.trim())
      .single();

    if (errorBusqueda || !usuarioDb) {
      toast.error(`No encontramos a nadie llamado "${username}"`, {
        id: toastId,
      });
      return;
    }

    // PASO 2: Si lo encontramos, iniciamos sesión con su correo oculto
    toast.loading("Iniciando sesión...", { id: toastId });

    const { error } = await supabase.auth.signInWithPassword({
      email: usuarioDb.email,
      password: password,
    });

    if (error) {
      toast.error("Contraseña incorrecta ❌", { id: toastId });
    } else {
      toast.success(`¡Bienvenido de vuelta, ${username}! 🚀`, { id: toastId });
    }
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#121212",
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: "350px",
          borderTop: "4px solid #646cff",
          textAlign: "center",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Mis Finanzas 💸</h2>
        <p style={{ color: "#aaa", fontSize: "14px", marginBottom: "20px" }}>
          Ingresá tu nombre y contraseña
        </p>

        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "15px" }}
        >
          <div style={{ textAlign: "left" }}>
            <label
              style={{ fontSize: "12px", color: "#888", fontWeight: "bold" }}
            >
              👤 Nombre de Usuario
            </label>
            <input
              type="text"
              placeholder="Ej: Edison..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              style={{ width: "100%", marginTop: "5px" }}
            />
          </div>

          <div style={{ textAlign: "left" }}>
            <label
              style={{ fontSize: "12px", color: "#888", fontWeight: "bold" }}
            >
              🔑 Contraseña
            </label>
            <input
              type="password"
              placeholder="********"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ width: "100%", marginTop: "5px" }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            style={{ marginTop: "10px", padding: "12px", fontSize: "16px" }}
          >
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
