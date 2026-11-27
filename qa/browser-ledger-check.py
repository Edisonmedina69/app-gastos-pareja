import runpy
ctx = runpy.run_path('qa/browser-check.py', run_name='qa_helpers')
run,goto=ctx['run'],ctx['goto']
for width in (390,768,1440):
    goto('/gastos/nuevo',width)
    run(f'{width}: gasto para prueba de Libro Mayor', f"await fill('main input[type=text]', 'QA gasto libro {width}'); await fill('main input[placeholder=\"0\"]', '2000'); await submit();")
    goto('/ingresos/nuevo',width)
    run(f'{width}: ingreso para prueba de Libro Mayor', f"await fill('main input[type=text]', 'QA ingreso libro {width}'); await fill('main input[placeholder=\"0\"]', '3000'); await submit();")
    goto('/historial',width)
    for tipo in ('gasto','ingreso'):
        title=f'QA {tipo} libro {width}'
        run(f'{width}: editar y borrar {tipo} desde Libro Mayor', f"window.prompt=()=> '4500'; await waitFor(()=>find('button[aria-label=\"Editar {title}\"]')); find('button[aria-label=\"Editar {title}\"]').click(); await pause(); assert(db().{'gastos' if tipo=='gasto' else 'ingresos'}.find(g=>g.concepto==='{title}').monto===4500, 'No editó'); window.confirm=()=>true; find('button[aria-label=\"Eliminar {title}\"]').click(); await pause(); assert(!db().{'gastos' if tipo=='gasto' else 'ingresos'}.some(g=>g.concepto==='{title}'), 'No borró');")
print('Libro Mayor: edición y eliminación verificadas a 390, 768 y 1440 px')
