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

async function run() {
  console.log("--- Starting Perfiles RLS Test ---");
  
  // 1. Create space
  const spaceCode = `SPC${Math.floor(Math.random() * 1000)}`;
  const { data: space, error: spaceErr } = await supabase.from('espacios').insert([{
    nombre_familia: "Test Household",
    codigo_invitacion: spaceCode,
    limite_usuarios: 2
  }]).select().single();
  if (spaceErr) {
    console.error("Failed to create space:", spaceErr);
    return;
  }
  console.log("Created space:", space.id);

  // 2. Create User A
  const emailA = `user_a_${Math.floor(Math.random() * 100000)}@example.com`;
  const { data: authA, error: authAErr } = await supabase.auth.signUp({ email: emailA, password: "password123" });
  if (authAErr) {
    console.error("Failed to sign up A:", authAErr);
    return;
  }
  const userA = authA.user;
  const { error: profileAErr } = await supabase.from('perfiles').insert([{
    id: userA.id,
    nombre: "User A",
    espacio_id: space.id,
    rol: "superadmin"
  }]);
  if (profileAErr) {
    console.error("Failed to create profile A:", profileAErr);
    return;
  }
  console.log("Created User A profile:", userA.id);

  // 3. Create User B (Partner)
  // We need a separate supabase client to sign up User B so we don't overwrite session A
  const supabaseB = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
  const emailB = `user_b_${Math.floor(Math.random() * 100000)}@example.com`;
  const { data: authB, error: authBErr } = await supabaseB.auth.signUp({ email: emailB, password: "password123" });
  if (authBErr) {
    console.error("Failed to sign up B:", authBErr);
    return;
  }
  const userB = authB.user;
  const { error: profileBErr } = await supabaseB.from('perfiles').insert([{
    id: userB.id,
    nombre: "User B",
    espacio_id: space.id,
    rol: "miembro"
  }]);
  if (profileBErr) {
    console.error("Failed to create profile B:", profileBErr);
    return;
  }
  console.log("Created User B profile:", userB.id);

  // 4. Using Client A (signed in as User A), try to query all profiles in space
  console.log("Querying profiles as User A...");
  const { data: profiles, error: selectErr } = await supabase
    .from('perfiles')
    .select('*')
    .eq('espacio_id', space.id);

  if (selectErr) {
    console.error("FAIL: Could not select profiles:", selectErr);
  } else {
    console.log(`SUCCESS: Found ${profiles.length} profiles:`);
    profiles.forEach(p => console.log(`- ${p.nombre} (id: ${p.id}, rol: ${p.rol})`));
  }
  
  console.log("--- Perfiles RLS Test Complete ---");
}

run();
