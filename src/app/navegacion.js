import { Home, CreditCard, PlusCircle, History, Bot, Shield } from "lucide-react";

/** Secciones principales de la app (barra lateral en escritorio). */
export function obtenerSecciones(esSuperadmin) {
  return [
    { id: "inicio", icon: Home, label: "Dashboard" },
    { id: "cuentas", icon: CreditCard, label: "Deudas Pro" },
    { id: "ingresos", icon: PlusCircle, label: "Mis Ingresos" },
    { id: "historial", icon: History, label: "Transacciones" },
    { id: "asistente", icon: Bot, label: "Asistente IA" },
    ...(esSuperadmin ? [{ id: "admin", icon: Shield, label: "Admin" }] : []),
  ];
}
