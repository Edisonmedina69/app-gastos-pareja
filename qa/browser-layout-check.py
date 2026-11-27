"""Capturas y medidas del layout fluido; usar después del flujo CRUD para conservar sus movimientos."""
import json
import sys
import os
import runpy

ctx = runpy.run_path('qa/browser-check.py', run_name='qa_helpers')
cmd, goto, screenshot = ctx['cmd'], ctx['goto'], ctx['screenshot']
page, out = ctx['PAGE'], ctx['OUT']
transactions = cmd('eval', '--page', page, '--expression', "sessionStorage.getItem('qa-data')")['result']
assert transactions and transactions != 'null', 'Ejecutar primero browser-check.py con un ancho'
measurements = json.loads(out.joinpath('layout-fluido.json').read_text()) if out.joinpath('layout-fluido.json').exists() else []
requested = list(map(int, sys.argv[1:] or (390, 768, 1440, 1920)))
for width in requested:
    measurements[:] = [m for m in measurements if m['viewport']!=width]
    cmd('eval', '--page', page, '--expression', "sessionStorage.removeItem('qa-data')")
    goto('/', width)
    screenshot(page, f'despues-dashboard-{width}')
    data = cmd('eval', '--page', page, '--expression', '''(()=>{
      const m=document.querySelector('main'), r=m.getBoundingClientRect();
      const cards=[...m.querySelector('.grid').querySelectorAll('.glass-card')].filter(e=>e.getClientRects().length).map(e=>Math.round(e.getBoundingClientRect().width));
      if(Math.abs(r.right-document.documentElement.clientWidth)>1 || Math.abs(r.left-(innerWidth>=1024?240:0))>1) throw Error('El contenido no llena el ancho disponible');
      if(m.scrollWidth>m.clientWidth || document.documentElement.scrollWidth>innerWidth) throw Error('Scroll horizontal');
      if(innerWidth>=1536 && cards.length!==4) throw Error('Faltan cuatro indicadores');
      return JSON.stringify({viewport:innerWidth,clientWidth:document.documentElement.clientWidth,mainLeft:r.left,mainRight:r.right,mainWidth:r.width,cardWidths:cards,sidebarPosition:getComputedStyle(document.querySelector('aside')).position});
    })()''')['result']
    measurements.append(json.loads(data))
    goto('/gastos/nuevo', width)
    screenshot(page, f'despues-gasto-{width}')
    cmd('eval', '--page', page, '--expression', "if(document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth)throw Error('Desborde en formulario')")
    cmd('eval', '--page', page, '--expression', 'sessionStorage.setItem("qa-data",'+json.dumps(transactions)+')')
    goto('/historial', width)
    screenshot(page, f'despues-libro-{width}')
    cmd('eval', '--page', page, '--expression', "if(![...document.querySelectorAll('table tbody tr td:first-child')].every(e=>e.textContent.trim()))throw Error('Fecha vacía'); if(document.querySelector('main').scrollWidth>document.querySelector('main').clientWidth)throw Error('Desborde en Libro Mayor')")
out.joinpath('layout-fluido.json').write_text(json.dumps(measurements, ensure_ascii=False, indent=2))
console = cmd('console', '--page', page, '--limit', '1000')
errors = [e for e in console['entries'] if e.get('level')=='error']
assert not errors, errors
print(json.dumps({'checkedWidths':requested,'screenshots':0 if os.environ.get('QA_SKIP_SCREENSHOTS') == '1' else 3*len(requested),'consoleErrors':len(errors)}))
