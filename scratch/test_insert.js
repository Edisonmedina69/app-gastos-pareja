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

async function testInsert() {
  console.log("Fetching a profile to test insert...");
  const { data: profiles, error: pErr } = await supabase.from('perfiles').select('*').limit(1);
  if (pErr || !profiles || profiles.length === 0) {
    console.error("Could not fetch profile:", pErr);
    return;
  }
  
  const profile = profiles[0];
  console.log("Using profile:", { id: profile.id, espacio_id: profile.espacio_id });
  
  if (!profile.espacio_id) {
    console.log("Profile does not have an espacio_id. Cannot test insert.");
    return;
  }
  
  console.log("Attempting insert into gastos_programados...");
  const { data, error } = await supabase.from('gastos_programados').insert([{
    espacio_id: profile.espacio_id,
    usuario_id: profile.id,
    concepto: "Test Servicio 💧",
    monto: 0,
    moneda: "PYG",
    dia_recurrencia: 10,
    categoria: "Casa",
    para_quien: "Ambos"
  }]).select();
  
  console.log("Insert result:", { data, error: error ? error.message : null, code: error ? error.code : null });
}

testInsert();
