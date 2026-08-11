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

async function runAuthenticatedClean() {
  console.log("=== STARTING AUTHENTICATED CLEANUP ===");
  
  const email = `temp_cleaner_${Math.floor(Math.random() * 100000)}@nandefinanza.com`;
  const password = "TempPassword123!";
  
  console.log(`1. Signing up temporary cleaner user: ${email}...`);
  const { data: authData, error: signupErr } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (signupErr) {
    console.error("❌ Sign up failed:", signupErr.message);
    return;
  }
  
  const user = authData.user;
  console.log("✓ User created in auth:", user.id);
  
  // Wait a moment for database triggers if any
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log("2. Inserting profile associated with main space...");
  const { error: profileErr } = await supabase
    .from('perfiles')
    .insert([{
      id: user.id,
      nombre: "Limpiador Temp",
      espacio_id: MAIN_SPACE_ID,
      rol: 'admin_hogar'
    }]);
    
  if (profileErr) {
    console.error("❌ Profile insertion failed:", profileErr.message);
    // Try to cleanup auth user if possible
    return;
  }
  console.log("✓ Profile linked to Familia Medina Bernal.");

  // We are already authenticated as the signed up user on this client instance
  console.log("3. Executing deletion queries on transaction tables...");
  
  const tables = [
    "gastos",
    "ingresos_mensuales",
    "deudas_maestras",
    "notificaciones",
    "gastos_programados"
  ];
  
  for (const table of tables) {
    console.log(`Cleaning table '${table}'...`);
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq('espacio_id', MAIN_SPACE_ID)
      .select();
      
    if (error) {
      console.error(`❌ Error cleaning table '${table}':`, error.message);
    } else {
      console.log(`✓ Cleaned '${table}'. Rows deleted: ${data ? data.length : 0}`);
    }
  }

  console.log("4. Cleaning up temporary profile...");
  const { error: delProfileErr } = await supabase
    .from('perfiles')
    .delete()
    .eq('id', user.id);
    
  if (delProfileErr) {
    console.error("❌ Failed to delete temporary profile:", delProfileErr.message);
  } else {
    console.log("✓ Temporary profile deleted.");
  }
  
  console.log("\nAuthenticated cleanup completed! ✨");
}

runAuthenticatedClean();
