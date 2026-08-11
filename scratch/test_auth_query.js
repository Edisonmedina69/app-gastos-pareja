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

async function testAuthQuery() {
  const email = `test_agent_${Math.floor(Math.random() * 100000)}@example.com`;
  const password = "password123";
  
  console.log(`1. Signing up test user: ${email}...`);
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (authErr) {
    console.error("Auth SignUp failed:", authErr);
    return;
  }
  
  const user = authData.user;
  console.log("User created:", user.id);
  
  console.log("2. Creating a test space...");
  const { data: espacio, error: espErr } = await supabase.from('espacios').insert([{
    nombre_familia: "Familia Test",
    codigo_invitacion: `TEST${Math.floor(Math.random() * 1000)}`,
    limite_usuarios: 2
  }]).select().single();
  
  if (espErr) {
    console.error("Failed to create test space:", espErr);
    return;
  }
  
  console.log("Test space created:", espacio.id);
  
  console.log("3. Creating profile for test user...");
  const { data: perfil, error: perfErr } = await supabase.from('perfiles').insert([{
    id: user.id,
    nombre: "Test User",
    espacio_id: espacio.id,
    rol: "superadmin"
  }]).select().single();
  
  if (perfErr) {
    console.error("Failed to create profile:", perfErr);
    return;
  }
  
  console.log("Profile created:", perfil);
  
  console.log("4. Attempting to select from gastos_programados as authenticated user...");
  // Now we are signed in, the client session is set! Let's select
  const startTime = Date.now();
  const { data: gp, error: gpErr } = await supabase
    .from('gastos_programados')
    .select('*')
    .eq('espacio_id', espacio.id);
  
  console.log(`Query finished in ${Date.now() - startTime}ms`);
  console.log("Query result:", { gp, error: gpErr ? gpErr.message : null, code: gpErr ? gpErr.code : null });
}

testAuthQuery();
