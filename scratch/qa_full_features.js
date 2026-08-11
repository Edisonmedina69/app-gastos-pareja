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

const supabaseA = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const supabaseB = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function runQATests() {
  console.log("=============================================================");
  console.log("             INICIANDO SUITE DE PRUEBAS DE CONTROL DE CALIDAD QA");
  console.log("=============================================================");

  const emailA = `qa_edison_${Math.floor(Math.random() * 100000)}@nandefinanza.com`;
  const emailB = `qa_bianca_${Math.floor(Math.random() * 100000)}@nandefinanza.com`;
  const password = "qa_password_123";

  let userA, userB, espacio, perfilA, perfilB;
  let testsPassed = 0;
  let totalTests = 0;

  const assert = (condition, message) => {
    totalTests++;
    if (condition) {
      testsPassed++;
      console.log(`✅ [APROBADO] - ${message}`);
    } else {
      console.log(`❌ [FALLIDO] - ${message}`);
    }
  };

  try {
    // 1. REGISTRO DE USUARIOS DE PRUEBA
    console.log(`\n[PASO 1] Creando usuario QA A: ${emailA}...`);
    const { data: authA, error: authAErr } = await supabaseA.auth.signUp({ email: emailA, password });
    if (authAErr) throw authAErr;
    userA = authA.user;
    console.log(`   Usuario A creado: ${userA.id}`);

    console.log(`[PASO 2] Creando usuario QA B: ${emailB}...`);
    const { data: authB, error: authBErr } = await supabaseB.auth.signUp({ email: emailB, password });
    if (authBErr) throw authBErr;
    userB = authB.user;
    console.log(`   Usuario B creado: ${userB.id}`);

    // 2. CREACIÓN DE ESPACIO DE PRUEBA
    console.log(`\n[PASO 3] Creando espacio de prueba (Hogar)...`);
    const { data: esp, error: espErr } = await supabaseA.from('espacios').insert([{
      nombre_familia: "Familia Medina QA Test",
      codigo_invitacion: `QA${Math.floor(Math.random() * 10000)}`,
      limite_usuarios: 2
    }]).select().single();
    if (espErr) throw espErr;
    espacio = esp;
    console.log(`   Espacio creado exitosamente: ID ${espacio.id}`);

    // 3. VINCULACIÓN DE PERFILES
    console.log(`\n[PASO 4] Creando perfiles y roles...`);
    const { data: perfA, error: perfAErr } = await supabaseA.from('perfiles').insert([{
      id: userA.id,
      nombre: "Edison (QA)",
      espacio_id: espacio.id,
      rol: "superadmin"
    }]).select().single();
    if (perfAErr) throw perfAErr;
    perfilA = perfA;
    console.log(`   Perfil Edison (QA) creado.`);

    const { data: perfB, error: perfBErr } = await supabaseB.from('perfiles').insert([{
      id: userB.id,
      nombre: "Bianca (QA)",
      espacio_id: espacio.id,
      rol: "miembro"
    }]).select().single();
    if (perfBErr) throw perfBErr;
    perfilB = perfB;
    console.log(`   Perfil Bianca (QA) creado.`);

    // 4. REGISTRO DE INGRESOS MENSUALES
    console.log(`\n[PASO 5] Registrando ingresos de prueba...`);
    const { error: incAErr } = await supabaseA.from('ingresos_mensuales').insert([{
      usuario_id: userA.id, espacio_id: espacio.id, concepto: "Sueldo Edison", monto: 4000000, moneda: "PYG"
    }]);
    assert(!incAErr, "Insertar ingreso mensual de Edison");

    const { error: incBErr } = await supabaseB.from('ingresos_mensuales').insert([{
      usuario_id: userB.id, espacio_id: espacio.id, concepto: "Sueldo Bianca", monto: 5000000, moneda: "PYG"
    }]);
    assert(!incBErr, "Insertar ingreso mensual de Bianca");

    // 5. REGISTRO DE DEUDAS PRO (PRÉSTAMOS / INSTALLMENTS)
    console.log(`\n[PASO 6] Registrando deudas Maestras y Cuotas...`);
    const { data: deudaM, error: dmErr } = await supabaseA.from('deudas_maestras').insert([{
      espacio_id: espacio.id,
      creador_id: userA.id,
      titulo: "Préstamo Cooperativa",
      tipo: "fija",
      alcance: "familiar",
      tasa_cambio: 1,
      moneda: "PYG",
      estado: "activa"
    }]).select().single();
    if (dmErr) throw dmErr;
    assert(deudaM.titulo === "Préstamo Cooperativa", "Registrar Préstamo familiar");

    // Insertar cuotas detalle
    const cuotas = [];
    for (let i = 1; i <= 6; i++) {
      cuotas.push({
        deuda_maestra_id: deudaM.id,
        espacio_id: espacio.id,
        numero_cuota: i,
        monto_cuota: 2000000,
        monto_abonado: 0,
        estado: 'pendiente',
        fecha_vencimiento: new Date(2026, 5 + i, 5).toISOString().split('T')[0]
      });
    }
    const { data: cuotasDet, error: cuotasErr } = await supabaseA.from('cuotas_detalle').insert(cuotas).select();
    if (cuotasErr) throw cuotasErr;
    assert(cuotasDet.length === 6, "Insertar 6 cuotas de préstamo de 2,000,000 PYG");

    // Registrar abono de cuota
    console.log(`\n[PASO 7] Pagando cuota 1 del préstamo...`);
    const cuota1 = cuotasDet.find(c => c.numero_cuota === 1);
    const { error: updCuotaErr } = await supabaseA.from('cuotas_detalle').update({
      estado: 'pagado',
      monto_abonado: 2000000
    }).eq('id', cuota1.id);
    assert(!updCuotaErr, "Abonar cuota 1 en cuotas_detalle");

    const { error: regPagoErr } = await supabaseA.from('gastos').insert([{
      concepto: `[ABONO: Préstamo Cooperativa - Cuota 1] Pago mensual`,
      monto: 2000000,
      moneda: "PYG",
      categoria: "Otros",
      usuario_id: userA.id,
      pagador_id: userA.id,
      para_quien: "Ambos",
      espacio_id: espacio.id
    }]);
    assert(!regPagoErr, "Insertar registro de gasto asociado al abono");

    // 6. GASTOS FIJOS (RECURRENTES)
    console.log(`\n[PASO 8] Registrando compromisos recurrentes fijos...`);
    const { data: fijoGP, error: fijoGPErr } = await supabaseA.from('gastos_programados').insert([{
      espacio_id: espacio.id,
      usuario_id: userA.id,
      concepto: "💧 Agua (ESSAP)",
      monto: 50000,
      moneda: "PYG",
      dia_recurrencia: 10,
      categoria: "Casa",
      para_quien: "Ambos"
    }]).select().single();
    if (fijoGPErr) throw fijoGPErr;
    assert(fijoGP.concepto === "💧 Agua (ESSAP)", "Crear gasto fijo de Agua (ESSAP) en gastos_programados");

    // Registrar pago del servicio fijo
    console.log(`\n[PASO 9] Registrando el pago del gasto fijo...`);
    const { error: pagoFijoErr } = await supabaseA.from('gastos').insert([{
      concepto: `[FIJO] 💧 Agua (ESSAP)`,
      monto: 50000,
      moneda: "PYG",
      categoria: "Casa",
      usuario_id: userA.id,
      pagador_id: userA.id,
      para_quien: "Ambos",
      espacio_id: espacio.id
    }]);
    assert(!pagoFijoErr, "Insertar gasto del mes para servicio fijo con prefijo [FIJO]");

    // 7. PREVISIONES DE GASTO (BUDGETS / ENVELOPES)
    console.log(`\n[PASO 10] Probando Previsiones de Gasto (Presupuestos)...`);
    
    // Crear previsión Edison
    const { data: prevEdison, error: prevEErr } = await supabaseA.from('gastos_programados').insert([{
      espacio_id: espacio.id,
      usuario_id: userA.id,
      concepto: "[PRESUPUESTO] Belleza Edison",
      monto: 100000,
      moneda: "PYG",
      dia_recurrencia: 1,
      categoria: "Otros",
      para_quien: "Yo" // 'Yo' es el creador (Edison)
    }]).select().single();
    if (prevEErr) throw prevEErr;
    assert(prevEdison.concepto === "[PRESUPUESTO] Belleza Edison" && prevEdison.para_quien === "Yo", "Crear Previsión Individual para Edison (Valor: 'Yo')");

    // Crear previsión Bianca
    const { data: prevBianca, error: prevBErr } = await supabaseB.from('gastos_programados').insert([{
      espacio_id: espacio.id,
      usuario_id: userB.id,
      concepto: "[PRESUPUESTO] Belleza Bianca",
      monto: 300000,
      moneda: "PYG",
      dia_recurrencia: 1,
      categoria: "Otros",
      para_quien: "Yo" // 'Yo' es la creadora (Bianca)
    }]).select().single();
    if (prevBErr) throw prevBErr;
    assert(prevBianca.concepto === "[PRESUPUESTO] Belleza Bianca" && prevBianca.para_quien === "Yo", "Crear Previsión Individual para Bianca (Valor: 'Yo')");

    // Crear previsión familiar Ocio (Ambos)
    const { data: prevOcio, error: prevOErr } = await supabaseA.from('gastos_programados').insert([{
      espacio_id: espacio.id,
      usuario_id: userA.id,
      concepto: "[PRESUPUESTO] Ocio Familiar",
      monto: 500000,
      moneda: "PYG",
      dia_recurrencia: 1,
      categoria: "Otros",
      para_quien: "Ambos"
    }]).select().single();
    if (prevOErr) throw prevOErr;
    assert(prevOcio.concepto === "[PRESUPUESTO] Ocio Familiar" && prevOcio.para_quien === "Ambos", "Crear Previsión Familiar Compartida (Valor: 'Ambos')");

    // 8. ASOCIACIÓN DE GASTOS A PREVISIONES
    console.log(`\n[PASO 11] Simulando gastos asociados a previsiones...`);
    
    // Gasto 1: Peluquería Edison -> Belleza Edison
    const { error: g1Err } = await supabaseA.from('gastos').insert([{
      concepto: "[B: Belleza Edison] Peluquería",
      monto: 70000,
      moneda: "PYG",
      categoria: "Otros",
      usuario_id: userA.id,
      pagador_id: userA.id,
      para_quien: "Ambos",
      espacio_id: espacio.id
    }]);
    assert(!g1Err, "Asociar gasto 'Peluquería' (70,000) a la previsión 'Belleza Edison'");

    // Gasto 2: Cine Familiar -> Ocio Familiar
    const { error: g2Err } = await supabaseA.from('gastos').insert([{
      concepto: "[B: Ocio Familiar] Cine",
      monto: 150000,
      moneda: "PYG",
      categoria: "Otros",
      usuario_id: userA.id,
      pagador_id: userA.id,
      para_quien: "Ambos",
      espacio_id: espacio.id
    }]);
    assert(!g2Err, "Asociar gasto 'Cine' (150,000) a la previsión 'Ocio Familiar'");

    // Gasto 3: Restó Familiar -> Ocio Familiar
    const { error: g3Err } = await supabaseB.from('gastos').insert([{
      concepto: "[B: Ocio Familiar] Restó",
      monto: 400000, // Total = 150K + 400K = 550K (Supera límite de 500K!)
      moneda: "PYG",
      categoria: "Otros",
      usuario_id: userB.id,
      pagador_id: userB.id,
      para_quien: "Ambos",
      espacio_id: espacio.id
    }]);
    assert(!g3Err, "Asociar gasto 'Restó' (400,000) a la previsión 'Ocio Familiar' (Excede límite)");

    // 9. CÁLCULOS DE SEGUIMIENTO Y ASSERTIONS
    console.log(`\n[PASO 12] Ejecutando cálculos de verificación...`);

    // Consultar todos los gastos registrados en este espacio
    const { data: todosLosGastos, error: queryErr } = await supabaseA.from('gastos').select('*').eq('espacio_id', espacio.id);
    if (queryErr) throw queryErr;

    // Calcular consumo Belleza Edison
    const consumoEdison = todosLosGastos
      .filter(g => g.concepto.startsWith("[B: Belleza Edison]") && g.moneda === "PYG")
      .reduce((acc, g) => acc + Number(g.monto), 0);
    assert(consumoEdison === 70000, `Consumo Belleza Edison correcto (Esperado: 70,000 | Obtenido: ${consumoEdison})`);

    // Calcular consumo Ocio Familiar
    const consumoOcio = todosLosGastos
      .filter(g => g.concepto.startsWith("[B: Ocio Familiar]") && g.moneda === "PYG")
      .reduce((acc, g) => acc + Number(g.monto), 0);
    assert(consumoOcio === 550000, `Consumo Ocio Familiar correcto (Esperado: 550,000 | Obtenido: ${consumoOcio})`);

    // Verificar alerta de límite superado
    const ocioExcedido = consumoOcio > prevOcio.monto;
    assert(ocioExcedido === true, `Verificar excedente de previsión (Excedido: Sí | Exceso: ${consumoOcio - prevOcio.monto} PYG)`);

    // Verificar si el gasto fijo de Agua fue pagado este mes
    const aguaFijoPagado = todosLosGastos.some(g => g.concepto === `[FIJO] ${fijoGP.concepto}`);
    assert(aguaFijoPagado === true, "Verificar si el gasto fijo de Agua (ESSAP) figura como pagado");

  } catch (error) {
    console.error("\n💥 ERROR CRÍTICO EN LA SUITE DE PRUEBAS:", error);
  } finally {
    // 10. LIMPIEZA DE LA BASE DE DATOS
    console.log(`\n[PASO 13] Purgando datos creados por el QA para limpieza absoluta...`);
    if (espacio) {
      try {
        await supabaseA.from('gastos').delete().eq('espacio_id', espacio.id);
        await supabaseA.from('gastos_programados').delete().eq('espacio_id', espacio.id);
        
        // Deudas y cuotas
        const { data: deudasEsp } = await supabaseA.from('deudas_maestras').select('id').eq('espacio_id', espacio.id);
        if (deudasEsp && deudasEsp.length > 0) {
          const ids = deudasEsp.map(d => d.id);
          await supabaseA.from('cuotas_detalle').delete().in('deuda_id', ids);
          await supabaseA.from('deudas_maestras').delete().eq('espacio_id', espacio.id);
        }

        await supabaseA.from('ingresos_mensuales').delete().eq('espacio_id', espacio.id);
        await supabaseA.from('perfiles').delete().eq('espacio_id', espacio.id);
        await supabaseA.from('espacios').delete().eq('id', espacio.id);
        console.log("   Limpieza completada exitosamente. DB libre de registros basura de QA.");
      } catch (errClean) {
        console.error("   Error al realizar la limpieza:", errClean);
      }
    }

    // Sign out & delete auth users
    // (Nota: Supabase anon key no puede borrar usuarios de auth directamente sin admin/service key, pero no interfiere en las consultas ya que perfiles y espacios fueron purgados).
    console.log("\n=============================================================");
    console.log(` PRUEBAS COMPLETADAS: ${testsPassed} / ${totalTests} ASERTOS EXITOSOS`);
    console.log("=============================================================");
  }
}

runQATests();
