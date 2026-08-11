import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Leer archivo .env para obtener la configuración de Supabase
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length === 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Error: No se encontraron las variables de configuración de Supabase en el archivo .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function limpiar() {
  console.log("Iniciando purga y limpieza de base de datos...");

  // 1. Obtener todos los perfiles de la DB
  const { data: perfiles, error: errPerf } = await supabase
    .from('perfiles')
    .select('*');

  if (errPerf) {
    console.error("Error al consultar perfiles:", errPerf);
    process.exit(1);
  }

  console.log(`Se encontraron ${perfiles.length} perfiles registrados.`);

  // Identificar el perfil del Superadmin (Edison)
  const perfilEdison = perfiles.find(p => p.rol === 'superadmin' || p.nombre.toLowerCase().includes('edison'));

  if (!perfilEdison) {
    console.log("Aviso: No se detectó un perfil previo para Edison. Se aprovisionará al iniciar sesión.");
  } else {
    console.log(`Perfil superadmin conservado: ${perfilEdison.nombre} (ID: ${perfilEdison.id})`);
  }

  // 2. Eliminar perfiles ajenos (basura de pruebas)
  for (const p of perfiles) {
    if (perfilEdison && p.id === perfilEdison.id) continue;
    console.log(`Eliminando perfil de prueba: ${p.nombre} (ID: ${p.id})...`);
    const { error: errDel } = await supabase
      .from('perfiles')
      .delete()
      .eq('id', p.id);
    if (errDel) console.error(`No se pudo eliminar el perfil de ${p.nombre}:`, errDel.message);
  }

  // 3. Obtener todos los espacios
  const { data: espacios, error: errEsp } = await supabase
    .from('espacios')
    .select('id, nombre_familia');

  if (errEsp) {
    console.error("Error al consultar espacios:", errEsp);
    process.exit(1);
  }

  console.log(`Se encontraron ${espacios.length} espacios de familia.`);

  // 4. Eliminar todos los espacios (esto provocará eliminación en cascada de gastos/deudas/metas asociadas)
  for (const e of espacios) {
    console.log(`Eliminando espacio de prueba: ${e.nombre_familia} (ID: ${e.id})...`);
    const { error: errDelE } = await supabase
      .from('espacios')
      .delete()
      .eq('id', e.id);
    if (errDelE) console.error(`No se pudo eliminar el espacio ${e.nombre_familia}:`, errDelE.message);
  }

  // 5. Crear el nuevo espacio limpio para pruebas
  const codigoInvitacion = "TEST55";
  console.log(`Creando espacio de pruebas limpio: "Hogar Test Medina" con código "${codigoInvitacion}"...`);
  const { data: nuevoEspacio, error: errNewEsp } = await supabase
    .from('espacios')
    .insert([{
      nombre_familia: "Hogar Test Medina",
      codigo_invitacion: codigoInvitacion,
      limite_usuarios: 2
    }])
    .select()
    .single();

  if (errNewEsp) {
    console.error("Error al crear el espacio limpio de test:", errNewEsp);
    process.exit(1);
  }

  console.log("¡Hogar de pruebas creado exitosamente!");

  // 6. Si existía el perfil de Edison, lo vinculamos al nuevo espacio
  if (perfilEdison) {
    console.log(`Vinculando perfil administrativo de Edison al nuevo espacio...`);
    const { error: errUpdate } = await supabase
      .from('perfiles')
      .update({ espacio_id: nuevoEspacio.id })
      .eq('id', perfilEdison.id);

    if (errUpdate) {
      console.error("Error al vincular perfil de Edison:", errUpdate);
    } else {
      console.log("¡Perfil administrativo vinculado correctamente!");
    }
  }

  console.log("\nLimpieza de base de datos finalizada con éxito. ¡Todo limpio! ✨");
}

limpiar();
