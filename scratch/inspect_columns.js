import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length === 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  }
});

const MAIN_SPACE_ID = "57694b4c-ff56-47b9-aac4-1bf13b82ad11"; // Familia Medina Bernal

async function run() {
  const email = `temp_inspector_${Math.floor(Math.random() * 100000)}@nandefinanza.com`;
  const password = "TempPassword123!";
  
  await supabase.auth.signUp({ email, password });
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  const { data: authData } = await supabase.auth.signInWithPassword({ email, password });
  const user = authData.user;
  
  await supabase.from('perfiles').insert([{
    id: user.id,
    nombre: "Inspector Temp",
    espacio_id: MAIN_SPACE_ID,
    rol: 'admin_hogar'
  }]);

  console.log("Inserting mock ingreso...");
  const { data, error } = await supabase.from('ingresos_mensuales').insert([{
    espacio_id: MAIN_SPACE_ID,
    concepto: "Test Column Inspection",
    monto: 1000,
    moneda: "PYG",
    usuario_id: user.id,
    mes: 5,
    anio: 2026
  }]).select();
  
  console.log("Mock insert result:", data, error ? error.message : null);
  
  if (data && data.length > 0) {
    console.log("ROW VALUES:", data[0]);
    await supabase.from('ingresos_mensuales').delete().eq('id', data[0].id);
  }
  
  await supabase.from('perfiles').delete().eq('id', user.id);
}
run();
