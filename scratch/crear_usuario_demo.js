import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

// Cargar variables de entorno del archivo .env
const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length === 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

// Crear dos clientes independientes para emular las sesiones de Juan y María
const supabaseJuan = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
const supabaseMaria = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function crearUsuarioDemo() {
  console.log("=============================================================");
  console.log("           CREANDO USUARIOS Y DATOS DE PRUEBA (DEMO)         ");
  console.log("=============================================================");

  const emailJuan = "juan.demo@nandefinanza.com";
  const emailMaria = "maria.demo@nandefinanza.com";
  const password = "nande-demo-123";

  try {
    // 1. REGISTRAR / AUTENTICAR USUARIO JUAN
    console.log(`\n[PASO 1] Autenticando/Creando a Juan (${emailJuan})...`);
    let userJuan;
    const { data: logJuan, error: logJuanErr } = await supabaseJuan.auth.signInWithPassword({
      email: emailJuan,
      password: password
    });

    if (logJuanErr) {
      console.log("   Creando usuario Juan nuevo...");
      const { data: authJuan, error: authJuanErr } = await supabaseJuan.auth.signUp({
        email: emailJuan,
        password: password
      });
      if (authJuanErr) throw authJuanErr;
      userJuan = authJuan.user;
    } else {
      userJuan = logJuan.user;
      console.log(`   Juan autenticado. ID: ${userJuan.id}`);
    }

    // 2. REGISTRAR / AUTENTICAR USUARIA MARÍA
    console.log(`\n[PASO 2] Autenticando/Creando a María (${emailMaria})...`);
    let userMaria;
    const { data: logMaria, error: logMariaErr } = await supabaseMaria.auth.signInWithPassword({
      email: emailMaria,
      password: password
    });

    if (logMariaErr) {
      console.log("   Creando usuario María nuevo...");
      const { data: authMaria, error: authMariaErr } = await supabaseMaria.auth.signUp({
        email: emailMaria,
        password: password
      });
      if (authMariaErr) throw authMariaErr;
      userMaria = authMaria.user;
    } else {
      userMaria = logMaria.user;
      console.log(`   María autenticada. ID: ${userMaria.id}`);
    }

    // 3. CREAR ESPACIO DE PRUEBA (HOGAR DE DEMO)
    // El creador del espacio será Juan.
    console.log("\n[PASO 3] Creando el espacio compartido (Hogar)...");
    const { data: espacio, error: espErr } = await supabaseJuan.from('espacios').insert([{
      nombre_familia: "Hogar de Prueba (Demo)",
      codigo_invitacion: `DEMO${Math.floor(1000 + Math.random() * 9000)}`,
      limite_usuarios: 2
    }]).select().single();
    
    if (espErr) throw espErr;
    console.log(`   Espacio creado: "${espacio.nombre_familia}" con ID: ${espacio.id}`);

    // 4. CREAR PERFILES
    // Nota: Cada usuario debe insertar su propio perfil para cumplir con las políticas RLS.
    console.log("\n[PASO 4] Creando perfiles individuales (Cumpliendo RLS)...");
    
    // Juan crea su perfil
    const { data: perfJuan, error: perfJuanErr } = await supabaseJuan.from('perfiles').insert([{
      id: userJuan.id,
      nombre: "Juan (Demo)",
      espacio_id: espacio.id,
      rol: "superadmin"
    }]).select().single();
    if (perfJuanErr) throw perfJuanErr;
    console.log("   Perfil de Juan creado como Superadmin.");

    // María crea su perfil
    const { data: perfMaria, error: perfMariaErr } = await supabaseMaria.from('perfiles').insert([{
      id: userMaria.id,
      nombre: "María (Demo)",
      espacio_id: espacio.id,
      rol: "miembro"
    }]).select().single();
    if (perfMariaErr) throw perfMariaErr;
    console.log("   Perfil de María creado como Miembro.");

    // 5. REGISTRAR INGRESOS MENSUALES
    console.log("\n[PASO 5] Registrando ingresos dinámicos...");
    const { error: incJuanErr } = await supabaseJuan.from('ingresos_mensuales').insert([{
      usuario_id: userJuan.id,
      espacio_id: espacio.id,
      concepto: "Sueldo Desarrollo Software",
      monto: 6000000,
      moneda: "PYG"
    }]);
    if (incJuanErr) throw incJuanErr;

    const { error: incMariaErr } = await supabaseMaria.from('ingresos_mensuales').insert([{
      usuario_id: userMaria.id,
      espacio_id: espacio.id,
      concepto: "Sueldo Diseñadora UX/UI",
      monto: 6500000,
      moneda: "PYG"
    }]);
    if (incMariaErr) throw incMariaErr;
    console.log("   Ingresos mensuales registrados correctamente.");

    // 6. REGISTRAR DEUDAS PRO Y CUOTAS
    console.log("\n[PASO 6] Insertando Deudas de Prueba...");
    
    // Deuda 1: Préstamo Vehículo (Fija, Familiar)
    const { data: dAuto, error: dAutoErr } = await supabaseJuan.from('deudas_maestras').insert([{
      espacio_id: espacio.id,
      creador_id: userJuan.id,
      titulo: "Préstamo Auto Toyota",
      tipo: "fija",
      alcance: "familiar",
      tasa_cambio: 1,
      moneda: "PYG",
      estado: "activa"
    }]).select().single();
    
    if (dAutoErr) throw dAutoErr;

    // Generar cuotas de auto (12 cuotas de 1.100.000 PYG, 3 pagadas y el resto pendientes)
    const cuotasAuto = [];
    const hoy = new Date();
    for (let i = 1; i <= 12; i++) {
      const pagada = i <= 3;
      cuotasAuto.push({
        deuda_maestra_id: dAuto.id,
        espacio_id: espacio.id,
        numero_cuota: i,
        monto_cuota: 1100000,
        monto_abonado: pagada ? 1100000 : 0,
        estado: pagada ? 'pagado' : 'pendiente',
        fecha_vencimiento: new Date(hoy.getFullYear(), hoy.getMonth() - 3 + i, 10).toISOString().split('T')[0],
        fecha_pago: pagada ? new Date(hoy.getFullYear(), hoy.getMonth() - 4 + i, 9).toISOString() : null,
        pagador_id: pagada ? (i % 2 === 0 ? userJuan.id : userMaria.id) : null
      });
    }
    const { error: cAutoErr } = await supabaseJuan.from('cuotas_detalle').insert(cuotasAuto);
    if (cAutoErr) throw cAutoErr;
    console.log("   Préstamo de Auto creado con 12 cuotas (3 pagadas).");

    // Deuda 2: Tarjeta de Crédito Itaú (Tarjeta de Crédito, Familiar)
    const { data: dTC, error: dTCErr } = await supabaseMaria.from('deudas_maestras').insert([{
      espacio_id: espacio.id,
      creador_id: userMaria.id,
      titulo: "Tarjeta de Crédito Visa Oro",
      tipo: "tarjeta_credito",
      alcance: "familiar",
      tasa_cambio: 1,
      moneda: "PYG",
      estado: "activa"
    }]).select().single();
    if (dTCErr) throw dTCErr;

    // Crear la cuota de la tarjeta para el mes actual
    const cuotaTC = {
      deuda_maestra_id: dTC.id,
      espacio_id: espacio.id,
      numero_cuota: 1,
      monto_cuota: 1200000,
      monto_abonado: 0,
      pago_minimo: 400000,
      estado: 'pendiente',
      fecha_vencimiento: new Date(hoy.getFullYear(), hoy.getMonth(), 28).toISOString().split('T')[0]
    };
    const { error: cTCErr } = await supabaseMaria.from('cuotas_detalle').insert([cuotaTC]);
    if (cTCErr) throw cTCErr;
    console.log("   Deuda de Tarjeta de Crédito registrada (Cuota de 1.200.000 PYG activa).");

    // 7. REGISTRAR HISTORIAL DE GASTOS
    console.log("\n[PASO 7] Insertando historial de gastos...");
    const gastosDemo = [
      {
        concepto: "Supermercado Superseis (Surtido mensual)",
        monto: 650000,
        moneda: "PYG",
        categoria: "Comida",
        usuario_id: userJuan.id,
        pagador_id: userJuan.id,
        para_quien: "Ambos",
        espacio_id: espacio.id,
        fecha: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 3).toISOString().split('T')[0]
      },
      {
        concepto: "Combustible Petrobras (Llenado de tanque)",
        monto: 250000,
        moneda: "PYG",
        categoria: "Transporte",
        usuario_id: userMaria.id,
        pagador_id: userMaria.id,
        para_quien: "Ambos",
        espacio_id: espacio.id,
        fecha: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 2).toISOString().split('T')[0]
      },
      {
        concepto: "Suscripción Netflix & Spotify",
        monto: 95000,
        moneda: "PYG",
        categoria: "Entretenimiento",
        usuario_id: userJuan.id,
        pagador_id: userJuan.id,
        para_quien: "Ambos",
        espacio_id: espacio.id,
        fecha: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 5).toISOString().split('T')[0]
      },
      {
        concepto: "Factura ANDE (Luz mes actual)",
        monto: 350000,
        moneda: "PYG",
        categoria: "Casa",
        usuario_id: userMaria.id,
        pagador_id: userMaria.id,
        para_quien: "Ambos",
        espacio_id: espacio.id,
        fecha: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1).toISOString().split('T')[0]
      }
    ];

    const { error: gastErr } = await supabaseJuan.from('gastos').insert(gastosDemo);
    if (gastErr) throw gastErr;
    console.log("   Historial de gastos mock creado con éxito.");

    // 8. REGISTRAR COMPROMISOS PROGRAMADOS (SERVICIOS)
    console.log("\n[PASO 8] Insertando servicios y presupuestos programados...");
    const programados = [
      {
        espacio_id: espacio.id,
        usuario_id: userJuan.id,
        concepto: "💧 Agua (ESSAP)",
        monto: 60000,
        moneda: "PYG",
        dia_recurrencia: 10,
        categoria: "Casa",
        para_quien: "Ambos"
      },
      {
        espacio_id: espacio.id,
        usuario_id: userMaria.id,
        concepto: "📡 Plan Internet Tigo",
        monto: 160000,
        moneda: "PYG",
        dia_recurrencia: 15,
        categoria: "Servicios",
        para_quien: "Ambos"
      }
    ];
    const { error: progErr } = await supabaseJuan.from('gastos_programados').insert(programados);
    if (progErr) throw progErr;
    console.log("   Gastos fijos programados creados con éxito.");

    console.log("\n=============================================================");
    console.log(" ¡PROCESO DE CREACIÓN DE DEMO FINALIZADO CON ÉXITO! 🎉       ");
    console.log("=============================================================");
    console.log(`\n🔑 Credenciales para iniciar sesión en tu app local:`);
    console.log(`-------------------------------------------------------------`);
    console.log(`👨 Juan (Superadmin):`);
    console.log(`   - Usuario: juan.demo`);
    console.log(`   - Contraseña: ${password}`);
    console.log(`👩 María (Miembro):`);
    console.log(`   - Usuario: maria.demo`);
    console.log(`   - Contraseña: ${password}`);
    console.log(`-------------------------------------------------------------`);
    console.log(`Nota: Podés usar cualquiera de los dos en el login de tu app.`);
    console.log("=============================================================");

  } catch (error) {
    console.error("❌ Ocurrió un error al crear los datos del demo:", error.message);
  }
}

crearUsuarioDemo();
