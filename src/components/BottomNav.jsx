import {
  LayoutDashboard,
  Receipt,
  TrendingUp,
  Target,
  History,
} from "lucide-react";

export default function BottomNav({ activeTab, setActiveTab }) {
  const menuItems = [
    { id: "inicio", label: "Inicio", icon: <LayoutDashboard size={20} /> },
    { id: "cuentas", label: "Cuentas", icon: <Receipt size={20} /> },
    { id: "ingresos", label: "Ingresos", icon: <TrendingUp size={20} /> },
    { id: "metas", label: "Metas", icon: <Target size={20} /> },
    { id: "historial", label: "Historial", icon: <History size={20} /> },
  ];

  return (
    <nav className="bottom-nav">
      {menuItems.map((item) => (
        <button
          key={item.id}
          className={`nav-btn ${activeTab === item.id ? "active" : ""}`}
          onClick={() => setActiveTab(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span
            className="nav-label"
            style={{ fontSize: "10px", marginTop: "4px" }}
          >
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  );
}
