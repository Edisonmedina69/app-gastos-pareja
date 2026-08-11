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

// We need two distinct clients to simulate two concurrent sessions
const supabaseA = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const supabaseB = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runExtensiveTests() {
  console.log("=========================================");
  console.log("STARTING EXTENSIVE MULTI-USER DATA LOSS TESTS");
  console.log("=========================================");

  const emailA = `test_qa_a_${Math.floor(Math.random() * 100000)}@example.com`;
  const emailB = `test_qa_b_${Math.floor(Math.random() * 100000)}@example.com`;
  const password = "password123";
  
  // 1. Sign up User A
  console.log(`\n[STEP 1] Creating User A: ${emailA}...`);
  const { data: authA, error: authAErr } = await supabaseA.auth.signUp({ email: emailA, password });
  if (authAErr) { console.error("FAIL: User A SignUp failed:", authAErr); return; }
  const userA = authA.user;
  console.log("SUCCESS: User A created:", userA.id);

  // 2. Create space (linked to User A)
  console.log(`\n[STEP 2] Creating shared space...`);
  const { data: espacio, error: espErr } = await supabaseA.from('espacios').insert([{
    nombre_familia: "Familia QA Resistencia",
    codigo_invitacion: `QA${Math.floor(Math.random() * 1000)}`,
    limite_usuarios: 2
  }]).select().single();
  if (espErr) { console.error("FAIL: Failed to create space:", espErr); return; }
  console.log("SUCCESS: Space created:", espacio.id);

  // 3. Create profile for User A
  console.log(`\n[STEP 3] Creating profile for User A...`);
  const { data: perfilA, error: perfAErr } = await supabaseA.from('perfiles').insert([{
    id: userA.id,
    nombre: "User A (QA)",
    espacio_id: espacio.id,
    rol: "superadmin"
  }]).select().single();
  if (perfAErr) { console.error("FAIL: Failed to create profile A:", perfAErr); return; }
  console.log("SUCCESS: Profile A created:", perfilA.id);

  // 4. Sign up User B
  console.log(`\n[STEP 4] Creating User B (Partner): ${emailB}...`);
  const { data: authB, error: authBErr } = await supabaseB.auth.signUp({ email: emailB, password });
  if (authBErr) { console.error("FAIL: User B SignUp failed:", authBErr); return; }
  const userB = authB.user;
  console.log("SUCCESS: User B created:", userB.id);

  // 5. Create profile for User B (joining same space)
  console.log(`\n[STEP 5] Linking User B to the same shared space...`);
  const { data: perfilB, error: perfBErr } = await supabaseB.from('perfiles').insert([{
    id: userB.id,
    nombre: "User B (QA)",
    espacio_id: espacio.id,
    rol: "miembro"
  }]).select().single();
  if (perfBErr) { console.error("FAIL: Failed to create profile B:", perfBErr); return; }
  console.log("SUCCESS: Profile B created and linked to space:", perfilB.id);

  // 6. Register records as User A
  console.log(`\n[STEP 6] User A registers variable income, scheduled income, expense, debt, and fixed expense...`);
  
  const { data: incM } = await supabaseA.from('ingresos_mensuales').insert([{
    usuario_id: userA.id, espacio_id: espacio.id, concepto: "Sueldo Extra A", monto: 500000, moneda: "PYG"
  }]).select();

  const { data: incP } = await supabaseA.from('ingresos_programados').insert([{
    usuario_id: userA.id, espacio_id: espacio.id, descripcion: "Salario Fijo A", monto: 4500000, moneda: "PYG", dia_recurrencia: 5
  }]).select();

  const { data: gast } = await supabaseA.from('gastos').insert([{
    usuario_id: userA.id, pagador_id: userA.id, espacio_id: espacio.id, concepto: "Comida A", monto: 150000, moneda: "PYG"
  }]).select();

  const { data: deud } = await supabaseA.from('deudas_maestras').insert([{
    espacio_id: espacio.id, creador_id: userA.id, titulo: "Deuda Auto A", tipo: "fija", moneda: "PYG"
  }]).select();

  const { data: gastP } = await supabaseA.from('gastos_programados').insert([{
    espacio_id: espacio.id, usuario_id: userA.id, concepto: "ANDE Fijo A", monto: 0, moneda: "PYG", dia_recurrencia: 10
  }]).select();

  console.log("SUCCESS: All financial records registered by User A.");

  // 7. Delete User A's profile
  console.log(`\n[STEP 7] Simulating deletion of User A...`);
  // Deleting the profile row in perfiles table
  const { error: delErr } = await supabaseA.from('perfiles').delete().eq('id', userA.id);
  if (delErr) {
    console.error("FAIL: Failed to delete profile A:", delErr);
    return;
  }
  console.log("SUCCESS: User A profile deleted from perfiles table.");

  // 8. Query as User B to check if records are preserved and fields are set to NULL
  console.log(`\n[STEP 8] Querying space records as User B (Partner) to check preservation...`);
  const [checkG, checkIM, checkIP, checkDM, checkGP] = await Promise.all([
    supabaseB.from('gastos').select('*').eq('espacio_id', espacio.id),
    supabaseB.from('ingresos_mensuales').select('*').eq('espacio_id', espacio.id),
    supabaseB.from('ingresos_programados').select('*').eq('espacio_id', espacio.id),
    supabaseB.from('deudas_maestras').select('*').eq('espacio_id', espacio.id),
    supabaseB.from('gastos_programados').select('*').eq('espacio_id', espacio.id)
  ]);

  console.log("\n=========================================");
  console.log("DATA PERSISTENCE RESULTS (AS VIEWED BY USER B):");
  console.log("=========================================");
  
  const gRow = checkG.data?.[0];
  console.log(`- Gastos: ${gRow ? 'CONSERVADO' : 'BORRADO ❌'} | usuario_id original: ${userA.id.substring(0,6)}... -> actual: ${gRow?.usuario_id}`);
  
  const imRow = checkIM.data?.[0];
  console.log(`- Ingresos Mensuales: ${imRow ? 'CONSERVADO' : 'BORRADO ❌'} | usuario_id original: ${userA.id.substring(0,6)}... -> actual: ${imRow?.usuario_id}`);
  
  const ipRow = checkIP.data?.[0];
  console.log(`- Ingresos Programados: ${ipRow ? 'CONSERVADO' : 'BORRADO ❌'} | usuario_id original: ${userA.id.substring(0,6)}... -> actual: ${ipRow?.usuario_id}`);
  
  const dmRow = checkDM.data?.[0];
  console.log(`- Deudas Maestras: ${dmRow ? 'CONSERVADO' : 'BORRADO ❌'} | creador_id original: ${userA.id.substring(0,6)}... -> actual: ${dmRow?.creador_id}`);
  
  const gpRow = checkGP.data?.[0];
  console.log(`- Gastos Programados: ${gpRow ? 'CONSERVADO' : 'BORRADO ❌'} | usuario_id original: ${userA.id.substring(0,6)}... -> actual: ${gpRow?.usuario_id}`);

  console.log("\n=========================================");
  if (gRow && imRow && ipRow && dmRow && gpRow && 
      gRow.usuario_id === null && imRow.usuario_id === null && 
      ipRow.usuario_id === null && dmRow.creador_id === null && 
      gpRow.usuario_id === null) {
    console.log("TEST VERDICT: SUCCESS! All records preserved, and user references set to NULL.");
  } else {
    console.log("TEST VERDICT: FAIL! Some records were lost or user IDs were not set to NULL.");
  }
  console.log("=========================================");
}

runExtensiveTests();
