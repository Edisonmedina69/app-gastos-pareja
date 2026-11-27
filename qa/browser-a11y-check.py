import json, subprocess, os
from pathlib import Path
cli=os.environ['ORCA_CLI_COMMAND']
page=os.environ['QA_BROWSER_PAGE']
def run(*args):
 p=subprocess.run([cli,*args,'--json'],capture_output=True,text=True)
 r=json.loads(p.stdout)
 if not r['ok']: raise RuntimeError(r)
 return r['result']
def evaluate(js):
 value=run('eval','--page',page,'--expression',js)['result']
 if value in ('true','false'): return value=='true'
 return value
run('tab','switch','--page',page)
checks=[]; audits=[]
for width in (390,768,1440):
 for path in ('/','/gastos/nuevo','/deudas/nueva','/fijos/nuevo','/ingresos/nuevo','/historial'):
  run('goto','--page',page,'--url','http://127.0.0.1:5173'+path)
  run('viewport','--page',page,'--width',str(width),'--height','1000')
  info=evaluate("""(async()=>{
    const main=document.querySelector('main');
    // Medir los colores finales sin depender del reloj de animación del navegador embebido.
    for(const e of main.querySelectorAll('[style]')) if(e.style.opacity) { e.style.opacity='1'; e.style.transform='none'; }
    const text=[...main.querySelectorAll('*')].filter(e=>e.getClientRects().length && [...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()));
    const small=text.filter(e=>parseFloat(getComputedStyle(e).fontSize)<12).map(e=>e.textContent.slice(0,50));
    if(small.length) throw new Error('Texto menor a12px: '+small);
    if(main.scrollWidth>main.clientWidth) throw new Error('Desborde main');
    if(!window.axe) (0,eval)(await(await fetch('/qa/axe.min.cjs')).text());
    const result=await axe.run(main,{runOnly:{type:'rule',values:['color-contrast']}});
    return {violations:result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>({html:n.html,summary:n.failureSummary}))})),incomplete:result.incomplete.length};
  })()""")
  if isinstance(info,str): info=json.loads(info)
  audits.append({'width':width,'path':path,**info})
  checks.append(f'{width}: {path} mínimo12px, sin desborde')
# Confirmar back real y vuelta segura desde una URL directa.
run('goto','--page',page,'--url','http://127.0.0.1:5173/')
evaluate("[...document.querySelectorAll('main button')].find(e=>e.textContent.includes('Gasto Manual')).click()")
run('wait','--page',page,'--url','/gastos/nuevo')
run('back','--page',page)
assert evaluate('location.pathname')=='/'
checks.append('Atrás del navegador vuelve del gasto al inicio')
run('goto','--page',page,'--url','http://127.0.0.1:5173/fijos/nuevo')
evaluate("document.querySelector('button[aria-label=\"Volver\"]').click()")
run('wait','--page',page,'--url','/fijos')
assert evaluate('location.pathname')=='/fijos'
checks.append('Acceso directo: Volver usa la ruta del dominio')
# Rol de superadmin: inspección de formularios sin creación de cuentas.
evaluate("sessionStorage.setItem('qa-superadmin','true')")
run('goto','--page',page,'--url','http://127.0.0.1:5173/deudas')
assert evaluate("!!document.querySelector('button[aria-label=\"Cargar deudas demo\"]')")
checks.append('Demo disponible para superadmin')
for path in ('/admin/hogares/nuevo','/admin/usuarios/nuevo'):
 run('goto','--page',page,'--url','http://127.0.0.1:5173'+path)
 assert evaluate("!!document.querySelector('.form-page form') && !document.querySelector('[role=dialog]')")
 checks.append(path+': pantalla propia')
evaluate("sessionStorage.removeItem('qa-superadmin')")
run('goto','--page',page,'--url','http://127.0.0.1:5173/admin/hogares/nuevo')
assert evaluate("!document.querySelector('main form')")
checks.append('Administración protegida en el shell')
console=run('console','--page',page,'--limit','1000')
errors=[e for e in console['entries'] if e.get('level')=='error']
Path('docs/qa/adicionales.json').write_text(json.dumps({'checks':checks,'contrast':audits,'consoleErrors':errors},ensure_ascii=False,indent=2))
print(json.dumps({'checks':len(checks),'contrastViolations':sum(len(a['violations']) for a in audits),'consoleErrors':len(errors)}))
