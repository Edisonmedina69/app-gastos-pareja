import { Home, CreditCard, PlusCircle, PieChart, History, Bot, Shield } from "lucide-react";

export default function Navegacion({ activeTab, setActiveTab, esSuperadmin }) {
  const tabs = [
    { id: "inicio", icon: Home, label: "Inicio" },
    { id: "cuentas", icon: CreditCard, label: "Deudas" },
    { id: "ingresos", icon: PlusCircle, label: "Ingresos" },
    { id: "historial", icon: History, label: "Historial" },
    { id: "asistente", icon: Bot, label: "IA" },
  ];

  // Añadir pestaña de Admin solo si es superadmin
  if (esSuperadmin) {
    tabs.push({ id: "admin", icon: Shield, label: "Admin" });
  }

  return (
    <div className="flex items-center gap-1 p-1.5 glass-panel rounded-2xl border-white/10 shadow-2xl">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative flex flex-col items-center justify-center py-2 px-3 rounded-xl transition-all duration-300
              ${isActive ? "text-indigo-400 bg-indigo-500/10" : "text-slate-400 hover:text-slate-200 hover:bg-white/5"}
            `}
          >
            <Icon className={`w-5 h-5 mb-1 ${isActive ? "animate-pulse" : ""}`} />
            <span className="text-[10px] font-medium tracking-wide uppercase">{tab.label}</span>
            
            {isActive && (
              <div className="absolute -bottom-0.5 w-1 h-1 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(129,140,248,0.8)]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
