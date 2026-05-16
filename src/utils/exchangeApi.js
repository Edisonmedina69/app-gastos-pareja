export async function obtenerCotizacion(desde, hacia = "PYG") {
  if (desde === hacia) return 1;
  
  try {
    // Usamos la API pública de open.er-api.com que no requiere key para casos simples
    const response = await fetch(`https://open.er-api.com/v6/latest/${desde}`);
    const data = await response.json();
    
    if (data && data.rates && data.rates[hacia]) {
      return data.rates[hacia];
    }
    return 1;
  } catch (error) {
    console.error("Error al obtener cotización:", error);
    return 1;
  }
}
