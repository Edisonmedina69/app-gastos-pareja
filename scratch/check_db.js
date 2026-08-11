import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://uyiyhmxezgekntyquksi.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5aXlobXhlemdla250eXF1a3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5ODE4NzAsImV4cCI6MjA4NzU1Nzg3MH0.cCLQT-XzvqtA8zJqWH1Vza1ziXr7v8h0nIS2Urlzcpw';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== INGRESOS PROGRAMADOS ===");
  const { data: ip } = await supabase.from('ingresos_programados').select('*');
  console.log(JSON.stringify(ip, null, 2));

  console.log("=== GASTOS PROGRAMADOS ===");
  const { data: gp } = await supabase.from('gastos_programados').select('*');
  console.log(JSON.stringify(gp, null, 2));

  console.log("=== INGRESOS MENSUALES ===");
  const { data: im } = await supabase.from('ingresos_mensuales').select('*');
  console.log(JSON.stringify(im, null, 2));

  console.log("=== GASTOS ===");
  const { data: g } = await supabase.from('gastos').select('*');
  console.log(JSON.stringify(g, null, 2));
}

run();
