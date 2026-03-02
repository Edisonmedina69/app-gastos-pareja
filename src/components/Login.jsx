// src/components/Login.jsx
import { useState } from "react";
import { supabase } from "../supabase"; // Subimos un nivel para encontrar supabase.js

export default function Login() {
  const [emailLogin, setEmailLogin] = useState("");
  const [passwordLogin, setPasswordLogin] = useState("");
  const [loadingLogin, setLoadingLogin] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setLoadingLogin(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailLogin,
      password: passwordLogin,
    });
    if (error) alert("Error: " + error.message);
    setLoadingLogin(false);
  }

  return (
    <div
      className="app-container"
      style={{ justifyContent: "center", padding: "20px" }}
    >
      <div className="card" style={{ textAlign: "center" }}>
        <h2>🔒 Ingresar a Finanzas</h2>
        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "15px" }}
        >
          <input
            type="email"
            placeholder="Correo"
            value={emailLogin}
            onChange={(e) => setEmailLogin(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={passwordLogin}
            onChange={(e) => setPasswordLogin(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary" disabled={loadingLogin}>
            {loadingLogin ? "Cargando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
