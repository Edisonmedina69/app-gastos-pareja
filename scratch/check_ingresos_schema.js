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
  console.log("=== INSPECTING INGRESOS PROGRAMADOS ===");
  
  // 1. Try to read from ingresos_programados
  const { data: programados, error: errProg } = await supabase.from('ingresos_programados').select('*');
  if (errProg) {
    console.error("Error reading ingresos_programados:", errProg);
  } else {
    console.log("SUCCESS reading ingresos_programados! Count:", programados?.length);
    console.log("First item sample:", programados?.[0]);
  }

  // 2. Let's inspect the database schema metadata if we can
  // We can query the public schema using RPC or system views via REST API if allowed,
  // but let's also try to insert a test entry to see if it succeeds or fails and what error it throws.
  console.log("\n=== TRYING TEST INSERT ===");
  const testId = "00000000-0000-0000-0000-000000000000"; // Dummy/valid format
  
  // Let's check first if we have a valid session or if we are using an admin key.
  // The .env VITE_SUPABASE_ANON_KEY is an anonymous key, so it follows RLS rules.
  // Let's check the env variables. Is there a service role key?
  console.log("Using URL:", env.VITE_SUPABASE_URL);
}
check();
