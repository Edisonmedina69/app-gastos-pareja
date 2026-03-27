import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Target,
  History,
  LogOut,
} from "lucide-react";

export default function Sidebar({ activeTab, setActiveTab, handleLogout }) {
  const menuItems = [
    { id: "inicio", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
    { id: "cuentas", label: "Cuentas", icon: <Receipt size={20} /> },
    { id: "ingresos", label: "Ingresos", icon: <TrendingUp size={20} /> },
    { id: "metas", label: "Ahorros", icon: <Target size={20} /> },
    { id: "historial", label: "Historial", icon: <History size={20} /> },
  ];

  return (
    <aside className="sidebar-desktop">
      <div style={{ marginBottom: "40px", padding: "0 10px" }}>
        <h2 style={{ fontSize: "24px", margin: 0, fontWeight: "bold" }}>
          Finanzas 💸
        </h2>
        <small style={{ color: "#888" }}>Analista de Sistemas</small>
      </div>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          flex: 1,
        }}
      >
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "12px",
              width: "100%",
              backgroundColor:
                activeTab === item.id ? "#646cff" : "transparent",
              color: activeTab === item.id ? "white" : "#aaa",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              transition: "0.2s",
            }}
          >
            {item.icon}
            <span
              style={{ fontWeight: activeTab === item.id ? "bold" : "normal" }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px",
          width: "100%",
          backgroundColor: "transparent",
          color: "#ff6b6b",
          border: "none",
          cursor: "pointer",
          marginTop: "auto",
          fontSize: "16px",
        }}
      >
        <LogOut size={20} />
        <span>Cerrar Sesión</span>
      </button>
    </aside>
  );
}
