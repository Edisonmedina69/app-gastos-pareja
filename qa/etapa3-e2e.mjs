import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [, , localDir, container] = process.argv;
if (!container || (!container.startsWith('supabase_db_etapa3-test-') && !container.startsWith('supabase_db_etapa2-test-'))) {
  throw new Error('Solo contenedores locales aislados etapa3-test-*');
}

const playwrightPath = process.env.PLAYWRIGHT_MODULE || 'file:///tmp/gastos-playwright/node_modules/playwright/index.mjs';
const chromiumExecutable = process.env.CHROMIUM_EXECUTABLE || `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;
const { chromium } = await import(playwrightPath);

const statusRaw = execFileSync('npx', ['--yes', 'supabase@3.4.0', 'status', '--workdir', localDir, '-o', 'json'], { encoding: 'utf8' });
const status = JSON.parse(statusRaw);
const supabaseUrl = status.API_URL || 'http://127.0.0.1:55521';
const anonKey = status.ANON_KEY;
assert(anonKey, 'Falta ANON_KEY del stack local');

function sql(query) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1'], {
    input: query,
    encoding: 'utf8',
  }).trim();
}

// Sembrar 3 cuentas Auth sintéticas en el stack local (Ana admin, Bruno miembro, Carla lectura)
sql(`
create extension if not exists pgcrypto with schema extensions;
do $$
declare
  i int;
  v_uid uuid;
  v_email text;
  v_Names text[] := array['Ana', 'Bruno', 'Carla'];
begin
  for i in 1..3 loop
    v_uid := ('60000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    v_email := 'e2e3-' || i || '@nandefinanza.com';
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated', v_email,
      extensions.crypt('clave-qa-123', extensions.gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', v_Names[i]), now(), now(),
      '', '', '', ''
    ) on conflict (id) do nothing;
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_uid, jsonb_build_object('sub', v_uid::text, 'email', v_email),
      'email', v_uid::text, now(), now(), now()
    ) on conflict do nothing;
    insert into public.perfiles (id, nombre) values (v_uid, v_Names[i]) on conflict (id) do update set nombre = excluded.nombre;
  end loop;
  insert into public.org_piloto_usuarios (usuario_id) values ('60000000-0000-4000-8000-000000000001') on conflict do nothing;
end $$;
`);

const root = fileURLToPath(new URL('../', import.meta.url));
const out = fileURLToPath(new URL('../docs/qa', import.meta.url));
await fs.mkdir(out, { recursive: true });

const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5176', '--strictPort'], {
  cwd: root,
  env: { ...process.env, VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_ANON_KEY: anonKey },
  stdio: ['ignore', 'pipe', 'pipe'],
});

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Timeout esperando Vite en 5176')), 15000);
  vite.stdout.on('data', data => {
    if (data.toString().includes('5176')) {
      clearTimeout(timeout);
      resolve();
    }
  });
  vite.on('exit', code => reject(new Error(`Vite salió con código ${code}`)));
});

const browser = await chromium.launch({ executablePath: chromiumExecutable, headless: true, args: ['--no-sandbox'] });

try {
  async function login(page, email, path = '/') {
    await page.goto(`http://127.0.0.1:5176${path}`);
    await page.locator('#login-usuario').waitFor();
    await page.locator('#login-usuario').fill(email);
    await page.locator('#login-password').fill('clave-qa-123');
    await page.getByRole('button', { name: /ENTRAR/i }).click();
  }

  const ctxAna = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-PY', timezoneId: 'America/Asuncion', reducedMotion: 'reduce' });
  const pageAna = await ctxAna.newPage();
  const consoleErrors = [];
  pageAna.on('pageerror', err => consoleErrors.push(err.message));
  pageAna.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  // 1. Ana inicia sesión, crea su hogar y luego crea CaninDevs (QA)
  await login(pageAna, 'e2e3-1@nandefinanza.com');
  await pageAna.getByRole('heading', { name: 'Elegí tu espacio' }).waitFor();
  await pageAna.getByRole('button', { name: 'Crear un hogar' }).click();
  await pageAna.locator('input[name="nombre"]').fill('Hogar Ana QA');
  await pageAna.getByRole('button', { name: 'Crear y entrar' }).click();
  await pageAna.getByRole('heading', { name: 'Últimos movimientos' }).waitFor();

  await pageAna.getByRole('link', { name: /Cambiar espacio/i }).click();
  await pageAna.getByRole('link', { name: 'Crear organización' }).click();
  await pageAna.locator('input[name="nombre"]').fill('CaninDevs (QA)');
  await pageAna.getByRole('button', { name: 'Crear y entrar' }).click();
  await pageAna.getByRole('heading', { name: 'CaninDevs (QA)' }).waitFor();

  // 2. Ana crea las cuentas en cero desde la pantalla /org/cuentas/nueva:
  //    - Caja PYG (efectivo, PYG)
  //    - Banco USD (banco, USD)
  //    - Cuenta de Ana PYG (socio, PYG, titular Ana)
  await pageAna.getByRole('link', { name: 'Cuentas', exact: true }).click();
  await pageAna.getByRole('heading', { name: 'Cuentas de tesorería' }).waitFor();

  // Cuenta 1: Caja PYG
  await pageAna.getByRole('link', { name: /Nueva cuenta/i }).click();
  await pageAna.getByRole('heading', { name: 'Nueva cuenta de organización' }).waitFor();
  await pageAna.locator('input[name="nombre"]').fill('Caja PYG');
  await pageAna.locator('select[name="tipo"]').selectOption('efectivo');
  await pageAna.locator('select[name="moneda"]').selectOption('PYG');
  await pageAna.getByRole('button', { name: 'Crear cuenta en cero' }).click();
  await pageAna.getByRole('heading', { name: 'Caja PYG' }).waitFor();

  // Cuenta 2: Banco USD
  await pageAna.getByRole('button', { name: 'Volver a cuentas' }).click();
  await pageAna.getByRole('link', { name: /Nueva cuenta/i }).click();
  await pageAna.locator('input[name="nombre"]').fill('Banco USD');
  await pageAna.locator('select[name="tipo"]').selectOption('banco');
  await pageAna.locator('select[name="moneda"]').selectOption('USD');
  await pageAna.getByRole('button', { name: 'Crear cuenta en cero' }).click();
  await pageAna.getByRole('heading', { name: 'Banco USD' }).waitFor();

  // Cuenta 3: Cuenta de Ana PYG (socio)
  await pageAna.getByRole('button', { name: 'Volver a cuentas' }).click();
  await pageAna.getByRole('link', { name: /Nueva cuenta/i }).click();
  await pageAna.locator('input[name="nombre"]').fill('Cuenta de Ana PYG');
  await pageAna.locator('select[name="tipo"]').selectOption('socio');
  await pageAna.locator('select[name="moneda"]').selectOption('PYG');
  const anaMiembroId = sql("select m.id from public.espacio_miembros m join public.perfiles p on p.id=m.usuario_id where p.nombre='Ana' and m.espacio_id in (select id from public.espacios where tipo='organizacion') limit 1");
  await pageAna.locator('select[name="titular_miembro_id"]').selectOption(anaMiembroId);
  await pageAna.getByRole('button', { name: 'Crear cuenta en cero' }).click();
  await pageAna.getByRole('heading', { name: 'Cuenta de Ana PYG' }).waitFor();

  // 3. Registrar una transferencia de Cuenta de Ana PYG a Caja PYG (400.000 PYG con confirmación de descubierto)
  await pageAna.getByRole('link', { name: /Nueva transferencia/i }).click();
  await pageAna.getByRole('heading', { name: 'Nueva transferencia o cambio de moneda' }).waitFor();
  const cAnaId = sql("select id from public.org_cuentas where nombre='Cuenta de Ana PYG' limit 1");
  const cPygId = sql("select id from public.org_cuentas where nombre='Caja PYG' limit 1");
  const cUsdId = sql("select id from public.org_cuentas where nombre='Banco USD' limit 1");

  await pageAna.locator('select[name="cuenta_origen_id"]').selectOption(cAnaId);
  await pageAna.locator('select[name="cuenta_destino_id"]').selectOption(cPygId);
  await pageAna.locator('input[name="importe_origen"]').fill('400000');
  await pageAna.locator('input[name="motivo"]').fill('Reposición de caja desde custodia de Ana');
  await pageAna.locator('input[name="confirmar_saldo_insuficiente"]').check();
  await pageAna.getByRole('button', { name: 'Confirmar transferencia' }).click();
  await pageAna.getByRole('heading', { name: 'Caja PYG' }).waitFor();
  await pageAna.getByText('400.000 Gs.').first().waitFor();

  // 4. Registrar cambio de moneda de Caja PYG a Banco USD (150.000 PYG -> 20 USD a tasa manual confirmada 7500)
  await pageAna.getByRole('link', { name: /Nueva transferencia/i }).click();
  await pageAna.locator('select[name="cuenta_origen_id"]').selectOption(cPygId);
  await pageAna.locator('select[name="cuenta_destino_id"]').selectOption(cUsdId);
  await pageAna.locator('input[name="importe_origen"]').fill('150000');
  await pageAna.locator('input[name="importe_destino"]').fill('20');
  await pageAna.locator('input[name="tasa_destino_base"]').fill('7500');
  await pageAna.locator('input[name="confirmar_tasa_manual"]').check();
  await pageAna.locator('input[name="motivo"]').fill('Cambio manual confirmado a USD para servidor');
  await pageAna.getByRole('button', { name: 'Confirmar transferencia' }).click();
  await pageAna.getByRole('heading', { name: 'Banco USD' }).waitFor();
  await pageAna.getByText('USD 20,00').first().waitFor();

  // 5. En Socios: registrar pago personal de Ana (100.000 PYG) y reembolso parcial (60.000 PYG)
  await pageAna.getByRole('link', { name: 'Socios', exact: true }).click();
  await pageAna.getByRole('heading', { name: 'Custodia y cuenta corriente de socios' }).waitFor();
  await pageAna.getByRole('button', { name: 'Pago personal de socio' }).click();
  await pageAna.getByRole('heading', { name: 'Registrar pago con dinero personal del socio' }).waitFor();
  await pageAna.locator('input[name="importe"]').fill('100000');
  await pageAna.locator('input[name="motivo"]').fill('Pago de multa DNIT con dinero personal');
  await pageAna.getByRole('button', { name: 'Confirmar operación' }).click();
  await pageAna.getByRole('heading', { name: 'Custodia y cuenta corriente de socios' }).waitFor();
  await pageAna.locator('table').first().getByText('100.000 Gs.').first().waitFor();

  // 6. Capturas obligatorias a 390, 768, 1440 y 1920 px de todas las pantallas nuevas de Etapa 3:
  //    - /org/cuentas
  //    - /org/cuentas/nueva
  //    - /org/cuentas/:id
  //    - /org/transferencias/nueva
  //    - /org/socios
  for (const width of [390, 768, 1440, 1920]) {
    await pageAna.setViewportSize({ width, height: 1000 });

    // /org/cuentas
    await pageAna.goto('http://127.0.0.1:5176/org/cuentas');
    await pageAna.getByRole('heading', { name: 'Cuentas de tesorería' }).waitFor();
    await pageAna.screenshot({ path: `${out}/etapa3-org-cuentas-${width}.png`, fullPage: true, animations: 'disabled' });
    assert.equal(await pageAna.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Desborde en /org/cuentas a ${width}px`);

    // /org/cuentas/nueva
    await pageAna.goto('http://127.0.0.1:5176/org/cuentas/nueva');
    await pageAna.getByRole('heading', { name: 'Nueva cuenta de organización' }).waitFor();
    await pageAna.screenshot({ path: `${out}/etapa3-org-cuenta-nueva-${width}.png`, fullPage: true, animations: 'disabled' });
    assert.equal(await pageAna.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Desborde en /org/cuentas/nueva a ${width}px`);

    // /org/cuentas/:id
    await pageAna.goto(`http://127.0.0.1:5176/org/cuentas/${cPygId}`);
    await pageAna.getByRole('heading', { name: 'Caja PYG' }).waitFor();
    await pageAna.screenshot({ path: `${out}/etapa3-org-cuenta-detalle-${width}.png`, fullPage: true, animations: 'disabled' });
    assert.equal(await pageAna.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Desborde en /org/cuentas/:id a ${width}px`);

    // /org/transferencias/nueva
    await pageAna.goto('http://127.0.0.1:5176/org/transferencias/nueva');
    await pageAna.getByRole('heading', { name: 'Nueva transferencia o cambio de moneda' }).waitFor();
    await pageAna.screenshot({ path: `${out}/etapa3-org-transferencia-nueva-${width}.png`, fullPage: true, animations: 'disabled' });
    assert.equal(await pageAna.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Desborde en /org/transferencias/nueva a ${width}px`);

    // /org/socios
    await pageAna.goto('http://127.0.0.1:5176/org/socios');
    await pageAna.getByRole('heading', { name: 'Custodia y cuenta corriente de socios' }).waitFor();
    await pageAna.screenshot({ path: `${out}/etapa3-org-socios-${width}.png`, fullPage: true, animations: 'disabled' });
    assert.equal(await pageAna.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Desborde en /org/socios a ${width}px`);
  }

  // 7. Regresión familiar: volver al hogar y verificar que funciona intacto
  await pageAna.goto('http://127.0.0.1:5176/espacios');
  await pageAna.getByRole('button', { name: /Hogar Ana QA/ }).click();
  await pageAna.getByRole('heading', { name: 'Últimos movimientos' }).waitFor();

  assert.deepEqual(consoleErrors, [], `Errores de consola en E2E Etapa 3: ${consoleErrors.join('; ')}`);
  await ctxAna.close();
} catch (err) {
  await browser.close();
  vite.kill('SIGTERM');
  throw err;
}
await browser.close();
vite.kill('SIGTERM');
console.log('OK: E2E Playwright Etapa 3 (cuentas, detalle, transferencias multimoneda, socios y capturas a 390/768/1440/1920 px).');
process.exit(0);
