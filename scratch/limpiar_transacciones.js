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
  console.log("Iniciando vaciado de transacciones, ingresos y deudas de la base de datos...");

  // 1. Limpiar gastos
  console.log("Limpiando historial de gastos ('gastos')...");
  const { error: errG } = await supabase
    .from('gastos')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (errG) {
    console.error("Error al vaciar gastos:", errG.message);
  } else {
    console.log("✓ Tabla 'gastos' vaciada correctamente.");
  }

  // 2. Limpiar ingresos
  console.log("Limpiando registros de ingresos ('ingresos_mensuales')...");
  const { error: errI } = await supabase
    .from('ingresos_mensuales')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (errI) {
    console.error("Error al vaciar ingresos:", errI.message);
  } else {
    console.log("✓ Tabla 'ingresos_mensuales' vaciada correctamente.");
  }

  // 3. Limpiar deudas y sus cuotas asociadas
  console.log("Limpiando deudas y cuotas ('deudas_maestras')...");
  const { error: errD } = await supabase
    .from('deudas_maestras')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (errD) {
    console.error("Error al vaciar deudas:", errD.message);
  } else {
    console.log("✓ Tabla 'deudas_maestras' vaciada correctamente.");
  }

  // 4. Limpiar notificaciones
  console.log("Limpiando historial de notificaciones ('notificaciones')...");
  const { error: errN } = await supabase
    .from('notificaciones')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  
  if (errN) {
    console.error("Error al vaciar notificaciones:", errN.message);
  } else {
    console.log("✓ Tabla 'notificaciones' vaciada correctamente.");
  }

  console.log("\n¡Base de datos transaccional vaciada y limpia con éxito! ✨");
}

limpiar();
