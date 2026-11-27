import { useState } from 'react';
import { db, user } from './store';
import { calcularSaludFinanciera } from '../src/features/dashboard/lib/saludFinanciera';
export function useEspacios() {
  const session = { user: { id: user.id } };
  const hogar = {
    id: user.espacio_id,
    nombre: 'Hogar de prueba',
    tipo: 'hogar',
    detalle: { id: user.espacio_id, nombre_familia: 'Hogar de prueba', tipo: 'hogar', moneda_principal: 'PYG', limite_usuarios: 2 },
    membresia: { id: 'qa-mem-1', espacio_id: user.espacio_id, usuario_id: user.id, rol_plantilla: 'admin', activo: true },
    perfil: user,
  };
  return {
    session,
    espacios: [hogar],
    activo: hogar,
    cargando: false,
    error: '',
    seleccionar: async () => {},
    refrescar: async () => {},
  };
}
export function useHogar() {
  const [, update] = useState(0);
  return {
    session: { user: { id: user.id } }, cargando: false,
    datosHogar: { ...user, nombre_familia: 'Hogar de prueba' }, usuarioActual: user,
    otroUsuario: { id: 'qa-other', nombre: 'Luis' }, usuarios: [user, { id: 'qa-other', nombre: 'Luis' }],
    gastos: db.gastos, ingresos: db.ingresos, deudas: db.deudas, gastosProgramados: db.programados,
    notificaciones: [], esSuperadmin: sessionStorage.getItem('qa-superadmin') === 'true',
    saludFinanciera: calcularSaludFinanciera({ usuarioActual: user, gastos: db.gastos, ingresos: db.ingresos, deudas: db.deudas, gastosProgramados: [] }),
    obtenerDatos: () => update(n => n + 1), markNotisAsRead: () => {}, responderSolicitud: () => {},
    getNombreUsuario: id => id === user.id ? 'Ana' : 'Luis',
  };
}
