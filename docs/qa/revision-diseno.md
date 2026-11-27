# Revisión de diseño y movimiento

Se aplicaron las skills `impeccable` 4.6.0, `emil-design-eng` y
`review-animations`, copiadas de SifenPortal con LICENSE y ORIGEN en el commit
`116d6b4`. Se consultaron `polish`, `craft-floor`, `mode-operate` y `STANDARDS`.
La dirección es Operate: preservar identidad, términos y datos, y facilitar el
registro y la lectura diaria. No se realizó un rediseño ni se actualizaron las
skills a otra versión. La revisión se hizo en esta sesión, sin trabajadores extra.

| Before | After | Why |
| --- | --- | --- |
| Shell centrado con max-width | Sidebar fija y contenido fluido hasta el borde derecho | Aprovechar el ancho real en 1440/1920 px |
| Tres indicadores estirados en pantallas grandes | Dos, tres y cuatro columnas según breakpoint | Mantener densidad y jerarquía sin inflar cada tarjeta |
| Entrada con opacidad cero y desplazamiento en cada ruta | Contenido de rutas visible de inmediato | La navegación es frecuente y debe responder también al teclado sin espera |
| Animación de cada paso y de listas de movimientos | Cambio directo de paso y actualización de filas | Evitar efectos repetidos al registrar o consultar datos |
| Altura animada en opciones avanzadas | Revelado directo mediante el estado existente | Eliminar trabajo de layout durante la interacción |
| `transition-all` en los controles revisados | Transiciones de color de 150 ms y presión de 120 ms con curva `.23,1,.32,1` solo para puntero | Limitar propiedades y evitar movimiento al navegar con teclado |
| Elevación al hover y rebote decorativo | Color de hover, foco visible y controles quietos | Evitar saltos visuales y falsos hovers táctiles |
| Placeholder y caret del navegador | Colores semánticos, selección y margen de scroll para el foco | Completar estados nativos y proteger el foco frente a la barra inferior |
| Títulos duplicados en gasto manual y wizards | Un único título de pantalla, con indicador de paso separado | Aclarar la jerarquía sin cambiar textos de dominio |
| Resumen adicional debajo de formularios móviles | Resumen lateral desde escritorio | Priorizar los campos y la acción fija en celular |

El detector se ejecutó una vez sobre los archivos UI modificados. Sus cuatro
advertencias se revisaron: tipografía Inter, colores indigo de campos monetarios
y borde lateral de la lista móvil. Son convenciones de la interfaz existente,
conservadas deliberadamente en esta pasada de pulido; sustituirlas requeriría un
rediseño de identidad fuera de alcance. No son fallos funcionales ni de contraste.

Decisión: **Approve**, para el movimiento revisado. Se eliminaron las entradas y
animaciones repetitivas de rutas, pasos y listas; permanecen las confirmaciones
cortas y los indicadores de carga. Se conserva `prefers-reduced-motion` y la
pulsación sutil de formularios se limita a punteros finos y controles sin foco de
teclado. Las pruebas de transacciones siguen usando servicios en memoria.
