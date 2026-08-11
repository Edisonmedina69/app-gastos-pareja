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

// Since anon key cannot query pg_policies directly, we can try to call a RPC
// or we can run some basic queries or try inserting/selecting.
// Wait! Let's try to query pg_policies via a direct SQL execution if possible, 
// or since we don't have a direct postgres driver here (only supabase client),
// let's check if there is an error when performing normal inserts.
// Let's create a temp user, log in, create a space, and try to do the exact operations.

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function inspect() {
  console.log("=== INSPECTING POLICIES / TRIGGERS ===");
  // Let's check if we can query using a raw SQL command (Supabase REST doesn't support raw SQL unless RPC is set up).
  // Wait, let's see if there is any RPC we can use, or let's create a test user and check their RLS behavior.
  
  const testEmail = `test_policy_${Math.floor(Math.random() * 100000)}@example.com`;
  const password = "password123";
  
  console.log("Creating test user:", testEmail);
  const { data: authData, error: authErr } = await supabase.auth.signUp({ email: testEmail, password });
  if (authErr) {
    console.error("Auth signup error:", authErr);
    return;
  }
  const user = authData.user;
  console.log("User created:", user.id);
  
  // 1. Create a space
  const { data: space, error: spaceErr } = await supabase.from('espacios').insert([{
    nombre_familia: "Test Space",
    codigo_invitacion: `TST${Math.floor(Math.random() * 1000)}`,
    limite_usuarios: 2
  }]).select().single();
  
  if (spaceErr) {
    console.error("Error creating space:", spaceErr);
    return;
  }
  console.log("Space created:", space.id);
  
  // 2. Create profile
  const { data: profile, error: profileErr } = await supabase.from('perfiles').insert([{
    id: user.id,
    nombre: "Test User",
    espacio_id: space.id,
    rol: "admin_hogar"
  }]).select().single();
  
  if (profileErr) {
    console.error("Error creating profile:", profileErr);
    return;
  }
  console.log("Profile created successfully!");

  // 3. Try to select from ingresos_programados
  console.log("\n--- SELECTING ingresos_programados ---");
  const { data: selectData, error: selectErr } = await supabase.from('ingresos_programados').select('*');
  console.log("Select result:", selectData, "Error:", selectErr);

  // 4. Try to insert into ingresos_programados
  console.log("\n--- INSERTING into ingresos_programados ---");
  const { data: insertData, error: insertErr } = await supabase.from('ingresos_programados').insert([{
    usuario_id: user.id,
    espacio_id: space.id,
    descripcion: "Sueldo de Prueba",
    monto: 3000000,
    moneda: "PYG",
    dia_recurrencia: 10,
    categoria: "Sueldo"
  }]).select();
  console.log("Insert result:", insertData, "Error:", insertErr);

  // 5. Try to update
  if (insertData && insertData.length > 0) {
    console.log("\n--- UPDATING ingresos_programados ---");
    const { data: updateData, error: updateErr } = await supabase
      .from('ingresos_programados')
      .update({ monto: 3500000 })
      .eq('id', insertData[0].id)
      .select();
    console.log("Update result:", updateData, "Error:", updateErr);
    
    // 6. Try to delete
    console.log("\n--- DELETING ingresos_programados ---");
    const { data: deleteData, error: deleteErr } = await supabase
      .from('ingresos_programados')
      .delete()
      .eq('id', insertData[0].id)
      .select();
    console.log("Delete result:", deleteData, "Error:", deleteErr);
  }
}

inspect();
