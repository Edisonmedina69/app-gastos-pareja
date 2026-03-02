// src/components/Navegacion.jsx
export default function Navegacion({ activeTab, setActiveTab }) {
  return (
    <div className="bottom-nav">
      <button
        className={`nav-btn ${activeTab === "inicio" ? "active" : ""}`}
        onClick={() => setActiveTab("inicio")}
      >
        <span className="nav-icon">🏠</span> Inicio
      </button>
      <button
        className={`nav-btn ${activeTab === "cuentas" ? "active" : ""}`}
        onClick={() => setActiveTab("cuentas")}
      >
        <span className="nav-icon">💳</span> Cuentas
      </button>
      <button
        className={`nav-btn ${activeTab === "ingresos" ? "active" : ""}`}
        onClick={() => setActiveTab("ingresos")}
      >
        <span className="nav-icon">💰</span> Ingresos
      </button>
      <button
        className={`nav-btn ${activeTab === "metas" ? "active" : ""}`}
        onClick={() => setActiveTab("metas")}
      >
        <span className="nav-icon">🐷</span> Metas
      </button>
      <button
        className={`nav-btn ${activeTab === "historial" ? "active" : ""}`}
        onClick={() => setActiveTab("historial")}
      >
        <span className="nav-icon">📋</span> Historial
      </button>
    </div>
  );
}
