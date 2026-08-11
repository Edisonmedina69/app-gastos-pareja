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
  console.log("=== INSPECTING DATABASE DATA ===");
  
  const { data: espacios, error: errEsp } = await supabase.from('espacios').select('*');
  console.log("ESPACIOS:", espacios, errEsp ? errEsp.message : "");
  
  const { data: perfiles, error: errPerf } = await supabase.from('perfiles').select('*');
  console.log("PERFILES:", perfiles, errPerf ? errPerf.message : "");
}
check();
