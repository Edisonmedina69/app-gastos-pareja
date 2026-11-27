import { useState } from 'react';
import { db, user } from './store';
import { calcularSaludFinanciera } from '../src/features/dashboard/lib/saludFinanciera';
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
