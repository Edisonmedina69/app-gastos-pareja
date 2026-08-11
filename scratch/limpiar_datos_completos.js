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

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const TABLES = [
  "gastos",
  "ingresos_mensuales",
  "deudas_maestras",
  "notificaciones",
  "gastos_programados",
  "ingresos_programados",
  "historial_salarios",
  "metas",
  "ahorros" // in case it exists
];

async function runCleanup() {
  console.log("=== COMPREHENSIVE DATA CLEANUP ===");
  
  for (const table of TABLES) {
    console.log(`Cleaning table '${table}'...`);
    try {
      const { data, error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000')
        .select();
        
      if (error) {
        // Table might not exist or we get permission/RLS errors
        console.log(`⚠️ Info for table '${table}': ${error.message} (Code: ${error.code})`);
      } else {
        console.log(`✓ Cleaned '${table}'. Rows deleted: ${data ? data.length : 0}`);
      }
    } catch (e) {
      console.log(`❌ Exception cleaning table '${table}':`, e.message);
    }
  }
  
  console.log("\nDatabase cleanup finished! ✨");
}

runCleanup();
