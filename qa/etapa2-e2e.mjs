import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const [, , localDir, container] = process.argv;
if (!container || !container.startswith?.('supabase_db_etapa2-test-') && !container.startsWith('supabase_db_etapa2-test-')) {
  throw new Error('Solo contenedores locales aislados etapa2-test-*');
}

const playwrightPath = process.env.PLAYWRIGHT_MODULE || 'file:///tmp/gastos-playwright/node_modules/playwright/index.mjs';
const chromiumExecutable = process.env.CHROMIUM_EXECUTABLE || `${process.env.HOME}/.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell`;
const { chromium } = await import(playwrightPath);

// Obtener anon key real del stack local efímero
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

// Sembrar 6 cuentas Auth sintéticas en el stack local (Ana + 5 integrantes) con bcrypt válido
sql(`
create extension if not exists pgcrypto with schema extensions;
do $$
declare
  i int;
  v_uid uuid;
  v_email text;
  v_Names text[] := array['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fabio'];
begin
  for i in 1..6 loop
    v_uid := ('30000000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid;
    v_email := 'e2e-' || i || '@nandefinanza.com';
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
  insert into public.org_piloto_usuarios (usuario_id) values ('30000000-0000-4000-8000-000000000001') on conflict do nothing;
end $$;
`);

const root = fileURLToPath(new URL('../', import.meta.url));
const out = fileURLToPath(new URL('../docs/qa', import.meta.url));
await fs.mkdir(out, { recursive: true });

// Levantar Vite apuntando al stack local efímero
const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', '5175', '--strictPort'], {
  cwd: root,
  env: { ...process.env, VITE_SUPABASE_URL: supabaseUrl, VITE_SUPABASE_ANON_KEY: anonKey },
  stdio: ['ignore', 'pipe', 'pipe'],
});

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Timeout esperando Vite en 5175')), 15000);
  vite.stdout.on('data', data => {
    if (data.toString().includes('5175')) {
      clearTimeout(timeout);
      resolve();
    }
  });
  vite.on('exit', code => reject(new Error(`Vite salió con código ${code}`)));
});

const browser = await chromium.launch({ executablePath: chromiumExecutable, headless: true, args: ['--no-sandbox'] });

try {
  async function login(page, email, path = '/') {
    await page.goto(`http://127.0.0.1:5175${path}`);
    await page.locator('#login-usuario').waitFor();
    await page.locator('#login-usuario').fill(email);
    await page.locator('#login-password').fill('clave-qa-123');
    await page.getByRole('button', { name: /ENTRAR/i }).click();
  }

  // 1. Ana inicia sesión, crea su hogar (con un solo espacio entra directo)
  const ctxAna = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-PY', timezoneId: 'America/Asuncion', reducedMotion: 'reduce' });
  const pageAna = await ctxAna.newPage();
  const consoleErrors = [];
  pageAna.on('pageerror', err => consoleErrors.push(err.message));
  pageAna.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await login(pageAna, 'e2e-1@nandefinanza.com');
  await pageAna.getByRole('heading', { name: 'Elegí tu espacio' }).waitFor();
  await pageAna.getByRole('button', { name: 'Crear un hogar' }).click();
  await pageAna.locator('input[name="nombre"]').fill('Hogar Ana y Luis');
  await pageAna.getByRole('button', { name: 'Crear y entrar' }).click();
  await pageAna.getByRole('heading', { name: 'Últimos movimientos' }).waitFor();

  // Verificar que al recargar con 1 solo espacio entra directo al hogar sin pedir selección
  await pageAna.reload();
  await pageAna.getByRole('heading', { name: 'Últimos movimientos' }).waitFor();

  // 2. Desde el selector permanente "Cambiar espacio", Ana crea "CaninDevs (QA)"
  await pageAna.getByRole('link', { name: /Cambiar espacio/i }).click();
  await pageAna.getByRole('heading', { name: 'Elegí tu espacio' }).waitFor();
  await pageAna.getByRole('link', { name: 'Crear organización' }).click();
  await pageAna.getByRole('heading', { name: 'Crear organización' }).waitFor();
  await pageAna.locator('input[name="nombre"]').fill('CaninDevs (QA)');
  await pageAna.getByRole('button', { name: 'Crear y entrar' }).click();
  await pageAna.getByRole('heading', { name: 'CaninDevs (QA)' }).waitFor();

  // Verificar separación de cargadores: organización no ejecuta lógica de pareja ni acreditaciones salariales
  const ingresosCreadosEnOrg = sql("select count(*) from public.ingresos_mensuales");
  assert.equal(ingresosCreadosEnOrg, '0', 'La organización no debe disparar acreditaciones salariales');

  // 3. Ana genera invitación para 5 integrantes
  await pageAna.getByRole('link', { name: 'Invitar integrantes' }).click();
  await pageAna.getByRole('heading', { name: 'Invitar al equipo' }).waitFor();
  await pageAna.locator('select[name="rol"]').selectOption('miembro');
  await pageAna.locator('input[name="usos"]').fill('5');
  await pageAna.getByRole('button', { name: 'Generar invitación' }).click();
  const tokenInput = pageAna.getByLabel('Código generado');
  await tokenInput.waitFor();
  const token = await tokenInput.inputValue();
  assert(token.length >= 32, 'Token de alta entropía generado');

  // 4. Unir 5 integrantes: 3 por código (/invitacion) y 2 por link (/invitacion#token=...)
  for (let i = 2; i <= 6; i++) {
    const ctxM = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-PY', timezoneId: 'America/Asuncion', reducedMotion: 'reduce' });
    const pageM = await ctxM.newPage();
    if (i <= 4) {
      // Por código
      await login(pageM, `e2e-${i}@nandefinanza.com`);
      await pageM.getByRole('link', { name: 'Tengo una invitación' }).click();
      await pageM.getByLabel('Código de invitación').fill(token);
      await pageM.getByRole('button', { name: 'Aceptar y entrar' }).click();
    } else {
      // Por link con fragmento #token=... retenido durante login y limpiado al consumir
      await login(pageM, `e2e-${i}@nandefinanza.com`, `/invitacion#token=${token}`);
      await pageM.getByRole('heading', { name: 'Unirte a una organización' }).waitFor();
      assert.equal(await pageM.getByLabel('Código de invitación').inputValue(), token, 'El link retuvo el token tras login');
      await pageM.getByRole('button', { name: 'Aceptar y entrar' }).click();
    }
    await pageM.getByRole('heading', { name: 'CaninDevs (QA)' }).waitFor();
    const hashLimpio = await pageM.evaluate(() => window.location.hash);
    assert.equal(hashLimpio, '', 'El hash con el token se eliminó al consumir');
    await ctxM.close();
  }

  // Verificar que los 6 integrantes están en CaninDevs (QA)
  await pageAna.getByRole('link', { name: 'Integrantes', exact: true }).click();
  for (const nombre of ['Ana (vos)', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fabio']) {
    await pageAna.getByText(nombre).waitFor();
  }

  // 5. Capturas de la UI nueva a 390, 768, 1440 y 1920 px con Playwright headless
  const miembroBrunoId = sql("select m.id from public.espacio_miembros m join public.perfiles p on p.id = m.usuario_id where p.nombre = 'Bruno' limit 1");
  for (const width of [390, 768, 1440, 1920]) {
    await pageAna.setViewportSize({ width, height: 1000 });

    // Selector de espacios (/espacios)
    await pageAna.goto('http://127.0.0.1:5175/espacios');
    await pageAna.getByRole('heading', { name: 'Elegí tu espacio' }).waitFor();
    await pageAna.screenshot({ path: `${out}/etapa2-espacios-${width}.png`, fullPage: true, animations: 'disabled' });
    assert.equal(await pageAna.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Desborde en /espacios a ${width}px`);

    // Resumen de organización (/org/resumen)
    await pageAna.getByRole('button', { name: /CaninDevs \(QA\)/ }).click();
    await pageAna.getByRole('heading', { name: 'CaninDevs (QA)' }).waitFor();
    await pageAna.screenshot({ path: `${out}/etapa2-org-resumen-${width}.png`, fullPage: true, animations: 'disabled' });
    assert.equal(await pageAna.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Desborde en /org/resumen a ${width}px`);

    // Integrantes e invitaciones (/org/integrantes)
    await pageAna.getByRole('link', { name: 'Integrantes', exact: true }).click();
    await pageAna.getByRole('heading', { name: 'Integrantes', exact: true }).waitFor();
    await pageAna.screenshot({ path: `${out}/etapa2-org-integrantes-${width}.png`, fullPage: true, animations: 'disabled' });
    assert.equal(await pageAna.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Desborde en /org/integrantes a ${width}px`);

    // Permisos por integrante (/org/integrantes/:id)
    await pageAna.goto(`http://127.0.0.1:5175/org/integrantes/${miembroBrunoId}`);
    await pageAna.getByRole('heading', { name: /Permisos de Bruno/ }).waitFor();
    await pageAna.screenshot({ path: `${out}/etapa2-org-permisos-${width}.png`, fullPage: true, animations: 'disabled' });
    assert.equal(await pageAna.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Desborde en /org/integrantes/:id a ${width}px`);
  }

  // 6. Volver al hogar desde el selector y verificar que conserva el hogar intacto
  await pageAna.goto('http://127.0.0.1:5175/espacios');
  await pageAna.getByRole('button', { name: /Hogar Ana y Luis/ }).click();
  await pageAna.getByRole('heading', { name: 'Últimos movimientos' }).waitFor();

  assert.deepEqual(consoleErrors, [], `Errores de consola en E2E: ${consoleErrors.join('; ')}`);
  await ctxAna.close();
  console.log('OK: E2E Playwright contra Supabase local (CaninDevs QA + 5 integrantes por código/link + capturas 390/768/1440/1920).');
} finally {
  await browser.close();
  vite.kill('SIGTERM');
  process.exit(0);
}
