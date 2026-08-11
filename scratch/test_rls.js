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

async function runTests() {
  console.log("--- Starting RLS Integration Tests ---");
  const email = `test_rls_${Math.floor(Math.random() * 100000)}@example.com`;
  const password = "password123";
  
  console.log(`1. Creating test user: ${email}...`);
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password
  });
  
  if (authErr) {
    console.error("FAIL: Auth SignUp failed:", authErr);
    return;
  }
  const user = authData.user;
  console.log("SUCCESS: User created:", user.id);
  
  console.log("2. Creating test space...");
  const { data: espacio, error: espErr } = await supabase.from('espacios').insert([{
    nombre_familia: "Familia RLS Test",
    codigo_invitacion: `RLS${Math.floor(Math.random() * 1000)}`,
    limite_usuarios: 2
  }]).select().single();
  
  if (espErr) {
    console.error("FAIL: Failed to create test space:", espErr);
    return;
  }
  console.log("SUCCESS: Test space created:", espacio.id);
  
  console.log("3. Creating profile for test user...");
  const { data: perfil, error: perfErr } = await supabase.from('perfiles').insert([{
    id: user.id,
    nombre: "Test User RLS",
    espacio_id: espacio.id,
    rol: "superadmin"
  }]).select().single();
  
  if (perfErr) {
    console.error("FAIL: Failed to create profile:", perfErr);
    return;
  }
  console.log("SUCCESS: Profile created:", perfil.id);
  
  console.log("4. Testing INSERT into gastos_programados...");
  const { data: insertData, error: insertErr } = await supabase.from('gastos_programados').insert([{
    espacio_id: espacio.id,
    usuario_id: user.id,
    concepto: "Internet Test RLS",
    monto: 150000,
    moneda: "PYG",
    dia_recurrencia: 5,
    categoria: "Casa",
    para_quien: "Ambos"
  }]).select();
  
  if (insertErr) {
    console.error("FAIL: Insert failed:", insertErr);
  } else {
    console.log("SUCCESS: Insert succeeded, record:", insertData[0]);
  }
  
  console.log("5. Testing SELECT from gastos_programados...");
  const { data: selectData, error: selectErr } = await supabase
    .from('gastos_programados')
    .select('*')
    .eq('espacio_id', espacio.id);
    
  if (selectErr) {
    console.error("FAIL: Select failed:", selectErr);
  } else {
    console.log("SUCCESS: Select succeeded, row count:", selectData.length);
  }

  if (insertData && insertData.length > 0) {
    const recordId = insertData[0].id;
    console.log(`6. Testing UPDATE on record ${recordId}...`);
    const { data: updateData, error: updateErr } = await supabase
      .from('gastos_programados')
      .update({ concepto: "Internet Test RLS - UPDATED", monto: 160000 })
      .eq('id', recordId)
      .select();
      
    if (updateErr) {
      console.error("FAIL: Update failed:", updateErr);
    } else {
      console.log("SUCCESS: Update succeeded:", updateData[0]);
    }
    
    console.log(`7. Testing DELETE on record ${recordId}...`);
    const { error: deleteErr } = await supabase
      .from('gastos_programados')
      .delete()
      .eq('id', recordId);
      
    if (deleteErr) {
      console.error("FAIL: Delete failed:", deleteErr);
    } else {
      console.log("SUCCESS: Delete succeeded!");
    }
  }
  
  console.log("--- RLS Integration Tests Complete ---");
}

runTests();
