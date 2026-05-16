import { useState, useRef, useEffect } from "react";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "../supabase";
import { formatearNumero } from "../utils/formatters";
import "../Estilos/AsistenteGemini.css";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export default function AsistenteGemini({ usuarioActual, gastos, ingresos, cuentas, metas, monedaGlobal, datosHogar }) {
  const [mensajes, setMensajes] = useState([
    { role: "asistente", text: `¡Haku la polenta, ${usuarioActual?.nombre || "kapé"}! 🔥 Soy tu asistente financiero. ¿En qué te puedo ayudar hoy?` }
  ]);
  const [input, setInput] = useState("");
  const [cargando, setCargando] = useState(false);
  const [datosTokens, setDatosTokens] = useState({ mensuales: 30000, usados: 0 });
  const [contextoModo, setContextoModo] = useState("Mes Actual");
  const scrollRef = useRef(null);

  const tokensRestantes = Math.max(0, datosTokens.mensuales - datosTokens.usados);
  const sinTokens = tokensRestantes <= 0;

  useEffect(() => {
    async function sincronizarTokens() {
      if (!datosHogar?.espacios?.id) return;
      
      const { data } = await supabase
        .from("espacios")
        .select("tokens_mensuales, tokens_usados, ultimo_ciclo_tokens")
        .eq("id", datosHogar.espacios.id)
        .single();

      if (data) {
        const ahora = new Date();
        const ultimoCiclo = data.ultimo_ciclo_tokens ? new Date(data.ultimo_ciclo_tokens) : ahora;
        
        if (ahora.getMonth() !== ultimoCiclo.getMonth() || ahora.getFullYear() !== ultimoCiclo.getFullYear()) {
          const { error } = await supabase.from("espacios").update({
            tokens_usados: 0,
            ultimo_ciclo_tokens: ahora.toISOString()
          }).eq("id", datosHogar.espacios.id);
          
          if (!error) setDatosTokens({ mensuales: data.tokens_mensuales, usados: 0 });
        } else {
          setDatosTokens({ mensuales: data.tokens_mensuales, usados: data.tokens_usados });
        }
      }
    }
    sincronizarTokens();
  }, [datosHogar]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [mensajes]);

  async function enviarMensaje() {
    if (!input.trim() || cargando) return;
    if (!API_KEY) {
      setMensajes(prev => [...prev, 
        { role: "usuario", text: input },
        { role: "asistente", text: "⚠️ No se encontró la API Key de Gemini. Por favor, configúrala en el archivo .env como VITE_GEMINI_API_KEY." }
      ]);
      setInput("");
      return;
    }

    const nuevoMensajeUsuario = { role: "usuario", text: input };
    setMensajes(prev => [...prev, nuevoMensajeUsuario]);
    setInput("");
    setCargando(true);

    try {
      console.log("Intentando conectar con Gemini... Key empieza con:", API_KEY?.substring(0, 5));
      const genAI = new GoogleGenerativeAI(API_KEY);
      // Probando con gemini-pro que es más universal
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });

      // Filtrar datos según contextoModo
      let gastosFiltrados = gastos;
      let ingresosFiltrados = ingresos;

      if (contextoModo === "Mes Actual") {
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);
        gastosFiltrados = gastos.filter(g => new Date(g.fecha) >= hace30Dias);
        ingresosFiltrados = ingresos.filter(i => new Date(i.fecha) >= hace30Dias);
      }

      // Generar contexto financiero
      const resumenGastos = gastosFiltrados.slice(0, 10).map(g => `- ${g.concepto}: ${formatearNumero(g.monto, g.moneda)}`).join("\n");
      const totalIngresos = ingresosFiltrados.reduce((acc, i) => acc + i.monto, 0);
      const totalCuentas = cuentas.filter(c => c.estado === "Pendiente").reduce((acc, c) => acc + c.monto, 0);
      const resumenMetas = metas.map(m => `- ${m.titulo}: ${formatearNumero(m.monto_actual || 0, m.moneda)} / ${formatearNumero(m.monto_objetivo, m.moneda)}`).join("\n");
      
      const promptSistema = `
        Eres un asistente financiero empático, amigable y experto llamado "ÑandeAsistente".
        Tu objetivo es ayudar al usuario a entender sus finanzas. Hablas con un tono paraguayo amigable (puedes usar palabras como "kapé", "haku la polenta", "re de bicio", etc.).
        
        CONTEXTO DEL USUARIO:
        - Usuario: ${usuarioActual?.nombre}
        - Moneda preferida: ${monedaGlobal}
        - Ingresos totales (${contextoModo}): ${formatearNumero(totalIngresos, monedaGlobal)}
        - Deudas pendientes: ${formatearNumero(totalCuentas, monedaGlobal)}
        - Metas de ahorro:
        ${resumenMetas || "No hay metas registradas aún."}
        - Últimos gastos registrados (${contextoModo}):
        ${resumenGastos}
        
        REGLAS:
        1. Mantén tus respuestas concisas pero útiles.
        2. Si el usuario te pregunta sobre sus gastos, usa los datos proporcionados.
        3. Siempre sé empático y motiva al ahorro.
      `;

      const result = await model.generateContent([promptSistema, ...mensajes.map(m => `${m.role === "asistente" ? "Asistente" : "Usuario"}: ${m.text}`), `Usuario: ${input}`]);
      const response = await result.response;
      const text = response.text();

      setMensajes(prev => [...prev, { role: "asistente", text }]);
      
      // Descontar tokens real en DB
      const costo = 500; // Estimación simple
      const nuevoUsado = datosTokens.usados + costo;
      
      await supabase.from("espacios").update({
        tokens_usados: nuevoUsado
      }).eq("id", datosHogar.espacios.id);
      
      setDatosTokens(prev => ({ ...prev, usados: nuevoUsado }));
    } catch (error) {
      console.error("Error con Gemini:", error);
      const errorMsg = error.message || "Error desconocido";
      setMensajes(prev => [...prev, { role: "asistente", text: `Lo siento, hubo un problema: ${errorMsg}. 🧠💥` }]);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="asistente-container">
      <div className="asistente-header">
        <h2 className="asistente-titulo">Asistente ÑandeFinanza</h2>
      </div>

      <div className="monetizacion-bar">
        <div className="tokens-display">
          <span>🪙 {tokensRestantes.toLocaleString("es-PY")} Tokens</span>
        </div>
        <div className="modo-selector">
          <select 
            className="modo-select"
            value={contextoModo}
            onChange={(e) => setContextoModo(e.target.value)}
          >
            <option value="Mes Actual">Mes Actual</option>
            <option value="Historial Completo">Historial Completo</option>
          </select>
        </div>
      </div>

      <div className="chat-messages" ref={scrollRef}>
        {mensajes.map((m, index) => (
          <div key={index} className={`mensaje ${m.role}`}>
            {m.text}
          </div>
        ))}
        {cargando && <div className="typing-indicator">ÑandeAsistente está pensando... 🤔</div>}
      </div>

      {sinTokens && (
        <div className="bloqueo-tokens-banner" style={{
          backgroundColor: "rgba(220, 53, 69, 0.2)",
          border: "1px solid #dc3545",
          color: "#ff6b6b",
          padding: "10px",
          borderRadius: "8px",
          marginBottom: "10px",
          fontSize: "13px",
          textAlign: "center"
        }}>
          ⚠️ Has agotado tus consultas mágicas de este mes. Pásate a Premium para seguir analizando tus finanzas. 💸✨
        </div>
      )}

      <div className="chat-input-container">
        <input
          className="chat-input"
          type="text"
          placeholder={sinTokens ? "Límite alcanzado 🔒" : "Pregúntame lo que quieras..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && enviarMensaje()}
          disabled={sinTokens || cargando}
        />
        <button className="send-btn" onClick={enviarMensaje} disabled={sinTokens || cargando}>
          <span>🚀</span>
        </button>
      </div>
    </div>
  );
}
