import { supabase, establecerContextoEspacio, capturarContextoEspacio } from './supabaseClient';
export const fijarContextoEspacio = establecerContextoEspacio;
export const vigenciaContexto = capturarContextoEspacio;
export const listarMisEspacios = () => supabase.rpc('listar_mis_espacios');
export const obtenerEspacioActivo = () => supabase.rpc('mi_espacio_id');
export const seleccionarEspacio = id => supabase.rpc('seleccionar_espacio', { p_espacio_id: id });
export const obtenerEspacio = id => supabase.from('espacios').select('*').eq('id', id).maybeSingle();
export const obtenerIdentidad = id => supabase.from('perfiles').select('*').eq('id', id).maybeSingle();
export const obtenerMembresia = id => supabase.from('espacio_miembros').select('*').eq('espacio_id', id).eq('activo', true);
export const crearOrganizacion = nombre => supabase.rpc('crear_organizacion', { p_nombre: nombre, p_version: 2 });
export const aceptarInvitacion = token => supabase.rpc('aceptar_invitacion_org', { p_token: token.trim(), p_version: 2 });
export const listarIntegrantes = id => supabase.rpc('listar_integrantes_org', { p_espacio_id: id });
export const listarPermisos = id => supabase.from('miembro_permisos').select('*').eq('espacio_id', id);
export const listarInvitaciones = id => supabase.from('org_invitaciones').select('id,rol,vence_at,max_usos,usos,revocada_at').eq('espacio_id', id).order('created_at', { ascending: false });
export const crearInvitacion = (id, rol, usos) => supabase.rpc('crear_invitacion_org', { p_espacio_id_esperado: id, p_rol: rol, p_max_usos: usos });
export const revocarInvitacion = (id, invitacion) => supabase.rpc('revocar_invitacion_org', { p_espacio_id_esperado: id, p_invitacion_id: invitacion });
export const actualizarMiembro = (id, miembro, { permisos = [], plantilla = null, activo = null }) => supabase.rpc('actualizar_permisos_miembro', {
  p_espacio_id_esperado: id, p_miembro_id: miembro, p_permisos: permisos, p_plantilla: plantilla, p_activo: activo,
});
export const salirDeEspacio = id => supabase.rpc('salir_de_espacio', { p_espacio_id_esperado: id });
