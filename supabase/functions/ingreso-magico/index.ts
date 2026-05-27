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
    const { input, foto, monedaGlobal } = await req.json()
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
    
    if(!apiKey) throw new Error("Falta la DEEPSEEK_API_KEY en Supabase Secrets");

    // DeepSeek-Chat es excelente para texto, pero NO soporta fotos (Vision) por ahora.
    if (foto) {
      throw new Error("DeepSeek por ahora solo soporta texto. Para tickets, escribí el monto che kape.");
    }

    const prompt = `
      Sos un asistente experto en finanzas paraguayas. Analizá el siguiente texto de un gasto y extraé los datos en formato JSON.
      
      REGLAS:
      1. Si el monto dice "150mil" o "150k", convertilo a número: 150000.
      2. La categoría debe ser una de estas: Casa, Supermercado, Combustible, Salidas, Salud, Ahorro, Otros.
      3. Si no se especifica moneda, asumí que es "${monedaGlobal}".
      4. Retorná ÚNICAMENTE un objeto JSON con esta estructura: 
         {"concepto": string, "monto": number, "categoria": string, "moneda": string}
      
      TEXTO DEL USUARIO: "${input}"
    `;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        stream: false,
        response_format: { type: "json_object" } // DeepSeek soporta formato JSON
      })
    })

    const data = await response.json()
    if (data.error) throw new Error(data.error.message);
    
    const text = data.choices[0].message.content
    const jsonMatch = text.match(/\{.*\}/s);
    
    if (jsonMatch) {
      return new Response(
        JSON.stringify(JSON.parse(jsonMatch[0])),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      throw new Error("No pude interpretar el gasto.");
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
