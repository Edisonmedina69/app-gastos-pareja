"""QA real en el navegador de Orca contra servicios en memoria; no usa producción."""
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

ORCA = os.environ.get('ORCA_CLI_COMMAND') or shutil.which('orca-ide') or 'orca'
PAGE = os.environ['QA_BROWSER_PAGE']
BEFORE = os.environ['QA_BEFORE_PAGE']
OUT = Path('docs/qa')
results = json.loads(OUT.joinpath('resultados.json').read_text()) if OUT.joinpath('resultados.json').exists() else []

def cmd(*args):
    p = subprocess.run([ORCA, *args, '--json'], capture_output=True, text=True)
    data = json.loads(p.stdout)
    if p.returncode: raise RuntimeError(data)
    if not data.get('ok'):
        raise RuntimeError(data)
    return data['result']

HELPERS = '''
const pause = () => new Promise(r => setTimeout(r, 25));
const assert = (value, message) => { if (!value) throw new Error(message); };
const waitFor = async predicate => { const until=performance.now()+4000; while(!predicate()){assert(performance.now()<until,'Espera agotada'); await pause();} };
const click = async selector => { await waitFor(()=>document.querySelector(selector)); document.querySelector(selector).click(); await pause(); };
const visible = e => e.getClientRects().length > 0;
const find = selector => [...document.querySelectorAll(selector)].find(visible);
const fill = async (selector, value) => {
 await waitFor(()=>find(selector)); const input = find(selector); assert(input, 'Campo ausente: ' + selector);
 const proto = input.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
 Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
 input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); await pause();
};
const button = async text => {
 await waitFor(()=>[...document.querySelectorAll('main button')].some(e => visible(e) && !e.disabled && e.textContent.toLowerCase().includes(text.toLowerCase())));
 const b = [...document.querySelectorAll('main button')].find(e => visible(e) && e.textContent.toLowerCase().includes(text.toLowerCase()));
 assert(b && !b.disabled, 'Botón ausente o deshabilitado: ' + text); b.click(); await pause();
};
const submit = async () => { const f = find('main form'); assert(f, 'Falta formulario'); assert(f.reportValidity(), 'Formulario inválido'); f.requestSubmit(); await pause(); };
const db = () => JSON.parse(sessionStorage.getItem('qa-data'));
'''

def run(label, js):
    result = cmd('eval', '--page', PAGE, '--expression', '(async()=>{' + HELPERS + js + '; return "OK";})()')
    if result.get('result') != 'OK':
        raise RuntimeError((label, result))
    results.append(label)
    OUT.joinpath('resultados.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))

def goto(path, width):
    cmd('goto', '--page', PAGE, '--url', 'http://127.0.0.1:5173' + path)
    cmd('viewport', '--page', PAGE, '--width', str(width), '--height', '1000')

def screenshot(page, name):
    data = cmd('screenshot', '--page', page)
    shutil.copyfile(data['path'], OUT / (name + '.png'))

def run_suite(widths):
    for width in widths:
        results[:] = [r for r in results if not r.startswith(str(width)+':')]
        goto('/', width)
        run(f'{width}: reiniciar datos aislados', "sessionStorage.removeItem('qa-data');")
        cmd('reload', '--page', PAGE)
        for page, stage in ((BEFORE, 'antes'), (PAGE, 'despues')):
            cmd('goto', '--page', page, '--url', 'http://127.0.0.1:' + ('5174' if stage == 'antes' else '5173'))
            cmd('viewport', '--page', page, '--width', str(width), '--height', '1000')
            screenshot(page, f'{stage}-dashboard-{width}')
        run(f'{width}: dashboard sin desborde', "assert(document.documentElement.scrollWidth <= innerWidth, 'Desborde en dashboard')")
        goto('/gastos/nuevo', width)
        screenshot(PAGE, f'despues-gasto-{width}')
        run(f'{width}: crear gasto manual', "await fill('main input[placeholder=\"¿En qué gastaste?\"]', 'QA gasto'); await fill('main input[placeholder=\"0\"]', '23000'); await submit(); assert(db().gastos.some(g=>g.concepto==='QA gasto'), 'Gasto no guardado'); assert(location.pathname==='/', 'No volvió al inicio')")
        for tipo in ('deuda', 'tarjeta'):
            title = f'QA {tipo} {width}'
            goto('/deudas/nueva', width)
            run(f'{width}: crear {tipo}, paso 1', ("await button('tarjeta crédito');" if tipo == 'tarjeta' else '') + f"await fill('main input[type=text]', '{title}'); await button('Siguiente: Montos');")
            run(f'{width}: crear {tipo}, paso 2', "await fill('main input[type=text]', '120000'); await button('Siguiente: Vencimiento');")
            run(f'{width}: crear {tipo}, guardar', f"await submit(); assert(db().deudas.some(d=>d.titulo==='{title}'), 'Deuda no guardada');")
            data = cmd('eval', '--page', PAGE, '--expression', f"JSON.parse(sessionStorage.getItem('qa-data')).deudas.find(d=>d.titulo==='{title}').id")['result']
            goto(f'/deudas/{data}/editar', width)
            run(f'{width}: editar {tipo}, precarga y guardar', f"assert(find('main input[type=text]').value==='{title}', 'No precargó'); await fill('main input[type=text]', '{title} editado'); await button('Siguiente: Montos'); await button('Siguiente: Vencimiento'); await submit(); assert(db().deudas.find(d=>d.id==='{data}').titulo.endsWith('editado'), 'Edición no guardada');")
            # Use the list action with the browser's confirmation mocked only in this isolated fixture.
            run(f'{width}: eliminar {tipo}', f"window.confirm=()=>true; await click('button[aria-label=\"Eliminar {title} editado\"]'); await pause(); assert(!db().deudas.some(d=>d.id==='{data}'), 'No eliminó deuda');")
        goto('/fijos/nuevo', width)
        run(f'{width}: crear gasto fijo', "await fill('main input[type=text]', 'QA fijo'); await fill('main input[placeholder=\"Variable / Sin monto fijo\"]', '75000'); await button('Siguiente: Datos'); await submit(); assert(db().programados.some(g=>g.concepto==='QA fijo'), 'Fijo no guardado');")
        fixed = cmd('eval', '--page', PAGE, '--expression', "JSON.parse(sessionStorage.getItem('qa-data')).programados.find(d=>d.concepto==='QA fijo').id")['result']
        goto(f'/fijos/{fixed}/editar', width)
        run(f'{width}: editar gasto fijo', "assert(find('main input[type=text]').value==='QA fijo', 'Precarga fijo'); await fill('main input[type=text]', 'QA fijo editado'); await button('Siguiente: Datos'); await submit(); assert(db().programados.some(g=>g.concepto==='QA fijo editado'), 'No editó fijo');")
        run(f'{width}: eliminar gasto fijo', f"window.confirm=()=>true; await click('button[aria-label=\"Eliminar QA fijo editado\"]'); await pause(); assert(!db().programados.some(g=>g.id==='{fixed}'), 'No eliminó fijo');")
        goto('/ingresos/nuevo', width)
        run(f'{width}: crear ingreso', "await fill('main input[type=text]', 'QA ingreso'); await fill('main input[placeholder=\"0\"]', '85000'); await submit(); assert(db().ingresos.some(g=>g.concepto==='QA ingreso'), 'No creó ingreso');")
        goto('/ingresos/programar', width)
        run(f'{width}: programar ingreso fijo', "await fill('main input[type=text]', 'QA sueldo'); await fill('main input[placeholder=\"0\"]', '2500000'); await button('Siguiente'); await submit(); assert(db().salarios.some(g=>g.descripcion==='QA sueldo'), 'No creó sueldo');")
        salary = cmd('eval', '--page', PAGE, '--expression', "JSON.parse(sessionStorage.getItem('qa-data')).salarios.find(d=>d.descripcion==='QA sueldo').id")['result']
        goto(f'/ingresos/{salary}/editar', width)
        run(f'{width}: editar ingreso fijo por URL recargada', "await pause(); assert(find('main input[type=text]').value==='QA sueldo', 'Precarga sueldo'); await fill('main input[type=text]', 'QA sueldo editado'); await button('Siguiente'); await submit(); assert(db().salarios.some(g=>g.descripcion==='QA sueldo editado'), 'No editó sueldo');")
        run(f'{width}: eliminar ingreso fijo', f"await button('Fijos'); window.confirm=()=>true; await click('button[aria-label=\"Eliminar QA sueldo editado\"]'); await pause(); assert(!db().salarios.some(g=>g.id==='{salary}'), 'No eliminó sueldo');")
        goto('/previsiones/nueva', width)
        run(f'{width}: crear previsión', "await fill('main input[type=text]', 'QA previsión'); await fill('main input[placeholder=\"0\"]', '50000'); await submit(); assert(db().programados.some(g=>g.concepto==='[PRESUPUESTO] QA previsión'), 'No creó previsión');")
        prevision = cmd('eval', '--page', PAGE, '--expression', "JSON.parse(sessionStorage.getItem('qa-data')).programados.find(d=>d.concepto==='[PRESUPUESTO] QA previsión').id")['result']
        goto(f'/previsiones/{prevision}/editar', width)
        run(f'{width}: editar previsión', "assert(find('main input[type=text]').value==='QA previsión', 'Precarga previsión'); await fill('main input[type=text]', 'QA previsión editada'); await submit(); assert(db().programados.some(g=>g.concepto==='[PRESUPUESTO] QA previsión editada'), 'No editó previsión');")
        run(f'{width}: eliminar previsión', f"window.confirm=()=>true; await click('button[aria-label=\"Eliminar [PRESUPUESTO] QA previsión editada\"]'); await pause(); assert(!db().programados.some(g=>g.id==='{prevision}'), 'No eliminó previsión');")
        goto('/deudas/qa-tarjeta/medio-pago', width)
        run(f'{width}: editar medio de pago', "await button('Transferencia'); await fill('main input[placeholder=\"Ej: mi.alias.banco\"]', 'qa.alias'); await submit(); assert(db().deudas.find(d=>d.id==='qa-tarjeta').alias_cuenta==='qa.alias', 'No guardó medio de pago');")
        goto('/deudas/qa-tarjeta/abonos/qa-cuota-tarjeta', width)
        run(f'{width}: registrar abono', "await fill('main input[type=text]', '1000'); await button('PAGAR'); assert(db().deudas.find(d=>d.id==='qa-tarjeta').cuotas_detalle[0].monto_abonado>=1000, 'No abonó');")
        goto('/fijos/qa-fijo/pagar', width)
        run(f'{width}: pagar gasto fijo', "await submit(); assert(db().gastos.some(g=>g.concepto==='[FIJO] Internet'), 'No registró pago fijo');")
        goto('/deudas/qa-tarjeta/compras/nueva', width)
        run(f'{width}: compra con tarjeta', "await fill('main input[type=text]', 'QA compra'); await fill('main input[placeholder=\"0\"]', '2000'); await submit(); assert(db().gastos.some(g=>g.concepto.includes('QA compra')), 'No registró compra');")
        goto('/historial', width)
        screenshot(PAGE, f'despues-libro-{width}')
        run(f'{width}: tabla/lista y edición de gasto', "assert(document.documentElement.scrollWidth <= innerWidth, 'Desborde en libro'); window.prompt=()=> '24000'; const b=[...document.querySelectorAll('main button')].find(e=>visible(e) && (e.getAttribute('aria-label')||'')==='Editar QA gasto'); assert(b,'No hay acción editar gasto'); b.click();await pause();assert(db().gastos.find(g=>g.concepto==='QA gasto').monto===24000,'Edición gasto falló');")
        goto('/deudas', width)
        run(f'{width}: demo oculta, filtros eliminados', "const text=document.querySelector('main').innerText; assert(!text.toLowerCase().includes('cargar deudas demo'),'Demo expuesta'); assert(!text.includes('Míos'),'Filtro Míos visible');")
    print(json.dumps({'checks':len(results), 'screenshots':len(list(OUT.glob('*.png')))}, ensure_ascii=False))

if __name__ == '__main__':
    run_suite(map(int, sys.argv[1:] or (390, 768, 1440)))
