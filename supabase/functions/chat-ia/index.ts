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
    const { mensaje, contexto_financiero } = await req.json()
    
    // Obtenemos la llave de DeepSeek
    const apiKey = Deno.env.get('DEEPSEEK_API_KEY')
    if(!apiKey) throw new Error("Falta la DEEPSEEK_API_KEY en Supabase Secrets");

    const systemInstruction = `Eres el Asistente Financiero Oficial de 'ÑandeFinanza 2.0', una aplicación de Paraguay. 
    Tu rol es actuar como un 'kape' (amigo) experto en finanzas.
    Usa 'Jopara' natural (ej: che kape, hendy, iporã, macanada, ñande plata heta, tranqui). Eres empático y nunca juzgas.
    
    Contexto financiero actual del usuario: ${JSON.stringify(contexto_financiero)}
    
    REGLA DE ORO (Banco Central del Paraguay - BCP): 
    Si el usuario pregunta por nuevos créditos, préstamos o endeudarse más, DEBES leer su índice de endeudamiento actual del contexto. 
    Si su índice proyectado o actual supera el 40% de su capacidad de pago (Ingresos), DEBES advertirle estrictamente que está en zona de riesgo y que los bancos podrían rechazarlo o que se ahorcará financieramente. Hazlo con tono de kape preocupado (Ej: "Nderasore kape, tu nivel de deuda ya está por el techo..."). Si está por debajo del 30%, puedes darle luz verde con precaución.`;

    // Llamada a DeepSeek (OpenAI-compatible)
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: mensaje }
        ],
        stream: false
      })
    })

    const data = await response.json()
    if (data.error) throw new Error(data.error.message);
    
    const respuestaIA = data.choices[0].message.content

    return new Response(
      JSON.stringify({ respuesta: respuestaIA }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
