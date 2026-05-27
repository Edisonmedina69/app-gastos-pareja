import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { input, foto, mimeType, monedaGlobal } = await req.json()
    
    // Obtenemos la API Key de Gemini desde secretos de Supabase o usamos la de respaldo proporcionada
    const apiKey = Deno.env.get('GEMINI_API_KEY') || 'AIzaSyAvIsxrdRN8xOAZQg1w_DoIfprJrooeC-M'
    
    if (!apiKey) {
      throw new Error("Falta configurar la GEMINI_API_KEY en Supabase Secrets");
    }

    const prompt = `
      Sos un asistente experto en finanzas paraguayas. Tu tarea es analizar el texto o la imagen de un ticket/gasto y extraer los datos en formato JSON.
      
      REGLAS:
      1. Si el monto dice "150mil" o "150k", convertilo a número: 150000.
      2. La categoría debe ser una de estas: Casa, Supermercado, Combustible, Salidas, Salud, Ahorro, Otros.
      3. Si no se especifica moneda, asumí que es "${monedaGlobal || 'PYG'}".
      4. Retorná ÚNICAMENTE un objeto JSON con esta estructura: 
         {"concepto": string, "monto": number, "categoria": string, "moneda": string}
      5. Si es una imagen de un ticket, busca el nombre del comercio (concepto), la fecha y el monto total pagado de la factura o comprobante.
    `;

    let requestBody;
    if (foto) {
      requestBody = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType: mimeType || 'image/jpeg',
                  data: foto
                }
              }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };
    } else {
      if (!input || !input.trim()) {
        throw new Error("Falta el texto o la foto para poder analizar el gasto.");
      }
      requestBody = {
        contents: [
          {
            parts: [
              { text: prompt },
              { text: `TEXTO DEL USUARIO: "${input}"` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      };
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No recibí respuesta de Gemini.");

    const jsonMatch = text.match(/\{.*\}/s);
    if (jsonMatch) {
      return new Response(
        JSON.stringify(JSON.parse(jsonMatch[0])),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      throw new Error("No pude interpretar el gasto en la respuesta de la IA.");
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
