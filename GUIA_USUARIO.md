# 🇵🇾 Manual de Usuario Completo y Exhaustivo - ÑandeFinanza 2.0

**ÑandeFinanza 2.0** es la plataforma colaborativa de gestión financiera de hogar y parejas para Paraguay. Combina control presupuestario, cálculo automático de ratios de endeudamiento oficial del Banco Central del Paraguay (BCP), gestión avanzada de crédito/cuotas (*Deudas Pro*) y un asistente con inteligencia artificial que habla Jopara.

---

## 📌 Tabla de Contenidos

1. [Acceso e Inicio Rápido](#1-acceso-e-inicio-rápido)
2. [Estructura del Sistema y Dashboard](#2-estructura-del-sistema-y-dashboard)
3. [Algoritmo de Salud Financiera y Alerta BCP (40%)](#3-algoritmo-de-salud-financiera-y-alerta-bcp-40)
4. [Módulo Deudas Pro (Tarjetas, Cuotas y Préstamos)](#4-módulo-deudas-pro-tarjetas-cuotas-y-préstamos)
5. [Módulo de Ingresos Mensuales e Ingresos Programados](#5-módulo-de-ingresos-mensuales-e-ingresos-programados)
6. [Gestión de Gastos Diarios y Fijos Recurrentes](#6-gestión-de-gastos-diarios-y-fijos-recurrentes)
7. [Asistente de Inteligencia Artificial (ÑandeAsistente en Jopara)](#7-asistente-de-inteligencia-artificial-ñandeasistente-en-jopara)
8. [Exportación a Excel y Reportes Históricos](#8-exportación-a-excel-y-reportes-históricos)
9. [Instalación PWA en Dispositivos Móviles](#9-instalación-pwa-en-dispositivos-móviles)
10. [Preguntas Frecuentes y Resolución de Problemas](#10-preguntas-frecuentes-y-resolución-de-problemas)

---

## 🚀 1. Acceso e Inicio Rápido

La aplicación soporta dos formas de acceso:

### A. Modo Demo Instantáneo (1-Clic)
Ideal para conocer las capacidades de la plataforma sin ingresar información personal:
1. En la pantalla de inicio de sesión, hacé clic en **"🧪 PROBAR DEMO INSTANTÁNEA (1-CLIC)"**.
2. El sistema creará y vinculará automáticamente un perfil temporal al **"Hogar Demo 🧪"**.
3. Se cargarán automáticamente datos reales de prueba (ingresos de 13.700.000 Gs., deudas en cuotas de tarjeta de crédito Itaú y gastos fijos de supermercado y alquiler).

### B. Inicio de Sesión Registrado
1. Ingresá tu nombre de usuario (ej. `edison`) o tu correo electrónico (ej. `tu@email.com`).
2. Ingresá tu contraseña de acceso asignada por el Administrador.
3. El sistema verificará tu **Hogar Activo** y cargará tus datos sincronizados.

---

## 📊 2. Estructura del Sistema y Dashboard

La interfaz está dividida en 5 secciones accesibles desde el menú lateral o barra inferior:

1. **Dashboard (Inicio)**: Resumen del balance, gráficos interactivos de distribución de gastos por categoría y estado del ratio de endeudamiento.
2. **Deudas Pro (Cuentas)**: Control detallado de tarjetas de crédito, compras en cuotas fijas, préstamos y previsión de gastos fijos del mes.
3. **Mis Ingresos**: Registro de salarios fijos, aguinaldos, comisiones e ingresos recurrentes del hogar.
4. **Transacciones (Historial)**: Listado cronológico de movimientos con filtros por persona (`Yo`, `Pareja`, `Ambos`), categorías y exportador a Excel.
5. **Asistente IA**: Chatbot inteligente capacitado en reglas financieras de Paraguay.

---

## ⚖️ 3. Algoritmo de Salud Financiera y Alerta BCP (40%)

El sistema evalúa continuamente la capacidad de pago del hogar basándose en las directrices de salud financiera del **Banco Central del Paraguay (BCP)**:

$$\text{Índice de Endeudamiento (\%)} = \left( \frac{\text{Carga Total de Cuotas y Deudas del Mes}}{\text{Total de Ingresos Mensuales del Hogar}} \right) \times 100$$

### Escalas de Evaluación:
- 🟢 **0% a 30% (Nivel Saludable)**: Finanzas equilibradas. Capacidad de ahorro óptima.
- 🟡 **30.1% a 40% (Nivel de Precaución)**: Presión moderada sobre los ingresos. Se recomienda congelar la toma de nuevos créditos.
- 🔴 **Mayor a 40.1% (Alerta Crítica BCP)**: Riesgo de sobreendeudamiento. El sistema emitirá alertas rojas y el Asistente IA recomendará un plan de austeridad inmediato.

---

## 💳 4. Módulo Deudas Pro (Tarjetas, Cuotas y Préstamos)

Este es el módulo central para controlar compromisos financieros a plazo.

### Tipos de Deudas Soportadas:
1. **Cuotas Fijas (Electrodomésticos, Muebles, Vehículos)**:
   - Permite ingresar monto total, cantidad de cuotas (ej. 6, 12, 18, 24) y fecha de vencimiento.
   - Genera automáticamente el desglose de cuotas pendientes y pagadas.
2. **Tarjeta de Crédito (Línea Revolvente)**:
   - Permite registrar límite de crédito, fecha de cierre de extracto y día de vencimiento del pago mínimo.
   - Permite cargar compras individuales dentro de la tarjeta.
3. **Préstamos Amortizables (Bancarios / Cooperativos)**:
   - Calcula el plan de amortización con tasa de interés anual (TEA) aplicada sobre saldos.

### Caso Práctico 1: Registrar una compra en 12 cuotas
1. Ir a **Deudas Pro** -> Botón **"+ Nueva Deuda"**.
2. **Paso 1**: Ingresar Título (*Ej: TV Smart 55" Itaú*), Entidad (*Itaú*) y Tipo (*Cuotas Fijas*).
3. **Paso 2**: Seleccionar Moneda (*PYG / USD*), ingresar Monto Total (*4.800.000 Gs.*) y Cantidad de Cuotas (*12*). El sistema calculará la cuota mensual (*400.000 Gs.*).
4. **Paso 3**: Seleccionar Alcance:
   - `Familiar`: La cuota impacta 50% a cada uno en el cálculo de salud financiera.
   - `Individual`: Impacta 100% al creador.
5. Indicar el día de vencimiento (ej. día 25 de cada mes).
6. Guardar. El plan de 12 cuotas quedará generado en estado *Pendiente*.

### Caso Práctico 2: Registrar Pago de Cuota
1. Desplegar la deuda desde la lista de **Deudas Activas**.
2. Hacer clic en **"Registrar Pago"** en la cuota del mes.
3. Seleccionar si es un **Pago Total** o **Parcial**, el medio de pago utilizado (Transferencia, Efectivo, Débito) y confirmar.

---

## 💰 5. Módulo de Ingresos Mensuales e Ingresos Programados

Permite proyectar el flujo de caja del hogar.

### Registros Fijos vs Variables:
- **Salario Fijo**: Se puede configurar en **Ingresos Programados** para que se cargue automáticamente cada inicio de mes.
- **Ingresos Variables (Comisiones / Trabajos Extra)**: Se cargan manualmente indicando el mes y año correspondiente.

---

## 🛒 6. Gestión de Gastos Diarios y Fijos Recurrentes

### A. Gastos Diarios
1. Presionar el botón flotante o menú **"+ Registrar Gasto"**.
2. Completar: Concepto (*Ej: Supermercado Stock*), Monto (*250.000 Gs.*), Categoría (*Alimentación*) y Asignación (*Ambos / Yo / Pareja*).

### B. Gastos Fijos Recurrentes (Alquiler, Expensas, Servicios)
1. En **Deudas Pro**, navegar a la sección **Gastos Fijos Programados**.
2. Cargar gastos que vencen todos los meses (Ej. *ANDE, Essap, Internet, Alquiler*).
3. Al llegar la fecha de vencimiento, el sistema enviará una notificación preventiva para evitar mora.

---

## 🤖 7. Asistente de Inteligencia Artificial (ÑandeAsistente)

El asistente inteligente analiza los registros de la base de datos de tu hogar y te brinda asesoramiento adaptado a la economía de Paraguay.

### Características del Asistente:
- **Idioma**: Jopara natural (Español combinado con frases cotidianas en Guaraní).
- **Regla BCP**: Te alertará estrictamente si tus compromisos superan el 40% de tus ingresos.

### Ejemplos de Preguntas que podés hacerle:
- *"¿Cómo está nuestra capacidad de pago para este mes?"*
- *"Queremos comprar un auto a cuotas de 1.500.000 Gs., ¿nos alcanza el presupuesto?"*
- *"¿En qué categoría estamos gastando más dinero este mes?"*

---

## 📄 8. Exportación a Excel y Reportes Históricos

1. Ir a la pestaña **Transacciones (Historial)**.
2. Aplicar los filtros deseados (Rango de fechas, categoría o miembro de la pareja).
3. Hacer clic en **"Exportar a Excel (.xlsx)"**.
4. Se descargará una planilla de cálculo profesional lista para auditoría o archivo personal.

---

## 📱 9. Instalación PWA en Dispositivos Móviles

**ÑandeFinanza 2.0** es una Progressive Web App (PWA) instalable como aplicación nativa:

### En Android (Google Chrome):
1. Abrir la dirección web de la app.
2. Presionar el menú de 3 puntos (arriba a la derecha).
3. Seleccionar **"Agregar a la pantalla principal"** o **"Instalar aplicación"**.

### En iOS / iPhone (Safari):
1. Abrir la dirección web en Safari.
2. Tocar el ícono de **Compartir** (cuadrado con flecha hacia arriba).
3. Desplazarse hacia abajo y seleccionar **"Agregar al inicio"**.

---

## ❓ 10. Preguntas Frecuentes y Resolución de Problemas

**Q: ¿Los datos cargados en el Modo Demo son públicos?**
*R: No, el Modo Demo utiliza un espacio de pruebas aislado de los datos reales de los hogares registrados.*

**Q: ¿Qué pasa si mi pareja gana más dinero que yo?**
*R: El sistema permite configurar vistas proporcionales o individuales para que los gastos compartidos se evalúen de manera justa de acuerdo al ingreso de cada uno.*

**Q: ¿Puedo usar la app en Dólares (USD)?**
*R: Sí, la plataforma es multimoneda y convierte automáticamente los balances a Guaraníes (PYG) utilizando el tipo de cambio oficial guardado.*

---

*Desarrollado con ❤️ para fortalecer la educación y estabilidad financiera de los hogares.* 🇵🇾
