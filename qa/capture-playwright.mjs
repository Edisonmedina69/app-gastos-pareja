import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE, headless: true, args: ['--no-sandbox'] });
const records = [], layouts = [];
const out = fileURLToPath(new URL('../docs/qa', import.meta.url));
for (const width of [390, 768, 1440, 1920]) {
  const context = await browser.newContext({ viewport: {width, height:1000}, locale:'es-PY', timezoneId:'America/Asuncion', reducedMotion:'reduce' });
  const page = await context.newPage();
  const errors = [], external = [];
  page.on('pageerror', error=>errors.push(error.message));
  page.on('console', msg=>{ if(msg.type()==='error') errors.push(msg.text()); });
  page.on('request', req=>{ if(!req.url().startsWith('http://127.0.0.1:5173') && !req.url().startsWith('http://127.0.0.1:5174') && /^https?:/.test(req.url())) external.push(req.url()); });
  async function visit(path, base=5173) {
    await page.goto(`http://127.0.0.1:${base}${path}`);
    await page.locator('main').waitFor();
    await page.evaluate(()=>document.fonts.ready);
  }
  async function capture(name) {
    await page.screenshot({path:`${out}/${name}-${width}.png`,fullPage:true,animations:'disabled'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`desborde ${name} ${width}`);
  }
  await visit('/');
  await page.getByRole('heading',{name:'Últimos movimientos'}).waitFor();
  layouts.push(await page.evaluate(()=>{
    const main=document.querySelector('main'),r=main.getBoundingClientRect();
    const cards=[...main.querySelector('.grid').querySelectorAll('.glass-card')].filter(e=>e.getClientRects().length).map(e=>Math.round(e.getBoundingClientRect().width));
    if(Math.abs(r.right-document.documentElement.clientWidth)>1 || Math.abs(r.left-(innerWidth>=1024?240:0))>1) throw Error('No llena el ancho');
    return {viewport:innerWidth,clientWidth:document.documentElement.clientWidth,mainLeft:r.left,mainRight:r.right,mainWidth:r.width,cardWidths:cards,sidebarPosition:getComputedStyle(document.querySelector('aside')).position};
  }));
  await capture('despues-dashboard');
  await page.evaluate(async()=>{
    const gastos=await import('/src/services/gastos.service.js');
    const ingresos=await import('/src/services/ingresos.service.js');
    const rows=[['QA gasto',24000],['Pago Deuda: Tarjeta del hogar',1000],['[FIJO] Internet',150000],['QA compra',2000]];
    await gastos.insertarGastos(rows.map(([concepto,monto])=>({concepto,monto,moneda:'PYG',categoria:'Casa',usuario_id:'qa-user',pagador_id:'qa-user'})));
    await ingresos.insertarIngresos([{concepto:'QA ingreso',monto:85000,moneda:'PYG',usuario_id:'qa-user'}]);
  });
  await visit('/historial');
  await page.getByRole('heading',{name:'Libro Mayor'}).waitFor();
  const dates=await page.locator('table tbody tr td:first-child').allTextContents();
  assert.equal(dates.length,7);
  assert(dates.every(date=>date.trim() && !/invalid/i.test(date)));
  await capture('despues-libro');
  await visit('/gastos/nuevo');
  await page.getByRole('heading',{name:'Nuevo gasto',exact:true}).waitFor();
  await capture('despues-gasto');
  await visit('/deudas/nueva');
  await page.locator('.form-page input[type=text]').first().fill('Préstamo del hogar');
  await page.getByRole('button',{name:/Siguiente: Montos/}).click();
  await page.locator('.form-page input[type=text]').first().fill('250000');
  await page.getByRole('button',{name:/Siguiente: Vencimiento/}).click();
  await page.getByRole('button',{name:/Agregar Intereses o CBU/}).click();
  await page.getByRole('button',{name:'Nro. Cuenta',exact:true}).click();
  await page.getByPlaceholder('Ej: 001-123456-00').fill('001-123456-00');
  await page.getByPlaceholder('Titular de la cuenta').fill('Ana');
  await page.getByPlaceholder('Ej: 1234567').fill('1234567');
  await capture('despues-deuda');
  assert.equal(await page.locator('[role=dialog]').count(),0);
  // Baseline: las mismas fixtures, fuentes y Tailwind del commit bac4f70.
  await visit('/',5174);
  await page.getByRole('button',{name:/Gasto Manual/}).waitFor();
  await capture('antes-dashboard');
  await page.getByRole('button',{name:/Gasto Manual/}).click();
  await page.locator('main form').waitFor();
  await capture('antes-gasto');
  assert.deepEqual(external,[],'La fixture intentó una llamada externa');
  assert.deepEqual(errors,[],`Errores a ${width}`);
  records.push({width,ledgerRows:dates.length,ledgerDates:dates,consoleErrors:errors,externalRequests:external,fullPageScreenshots:6});
  await context.close();
}
await fs.writeFile(`${out}/capturas-playwright.json`,JSON.stringify({browser:'Chromium headless shell 1255',locale:'es-PY',timezone:'America/Asuncion',fixtures:'Servicios en memoria del servidor de QA, sin llamadas externas',results:records},null,2));
await fs.writeFile(`${out}/layout-fluido.json`,JSON.stringify(layouts,null,2));
await browser.close();
console.log(JSON.stringify({widths:records.map(r=>r.width),screenshots:records.length*6,ledgerRows:7,consoleErrors:0,externalRequests:0}));
