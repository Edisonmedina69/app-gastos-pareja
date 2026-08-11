const cacheCotizaciones = {};
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora

export async function obtenerCotizacion(desde, hacia = "PYG") {
  if (!desde || desde === hacia) return 1;
  const clave = `${desde}_${hacia}`;
  const ahora = Date.now();

  // 1. Verificar caché en memoria
  if (cacheCotizaciones[clave] && (ahora - cacheCotizaciones[clave].timestamp < CACHE_TTL_MS)) {
    return cacheCotizaciones[clave].tasa;
  }

  // 2. Verificar localStorage
  try {
    const guardado = localStorage.getItem(`tasa_${clave}`);
    if (guardado) {
      const parsed = JSON.parse(guardado);
      if (ahora - parsed.timestamp < CACHE_TTL_MS) {
        cacheCotizaciones[clave] = parsed;
        return parsed.tasa;
      }
    }
  } catch (e) {}

  // 3. Consultar API externa si venció o no existe
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${desde}`);
    const data = await response.json();
    
    if (data && data.rates && data.rates[hacia]) {
      const tasa = data.rates[hacia];
      const item = { tasa, timestamp: ahora };
      cacheCotizaciones[clave] = item;
      try {
        localStorage.setItem(`tasa_${clave}`, JSON.stringify(item));
      } catch (e) {}
      return tasa;
    }
    return 1;
  } catch (error) {
    console.error("Error al obtener cotización:", error);
    return 1;
  }
}

