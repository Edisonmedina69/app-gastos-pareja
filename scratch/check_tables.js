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

async function check() {
  console.log("Checking tables in database...");
  
  // Let's query the supabase API to see if table is accessible and what it returns
  const { data, error } = await supabase.from('gastos_programados').select('*').limit(5);
  console.log("gastos_programados query response:", { data, error: error ? error.message : null, code: error ? error.code : null });
}
check();
