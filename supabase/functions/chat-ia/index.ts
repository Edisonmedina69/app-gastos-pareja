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
    Usa 'Jopara' natural (ej: che kape, hendy, iporã, macanada, ñande plata heta). Eres empático y nunca juzgas.
    Contexto financiero actual del usuario: ${JSON.stringify(contexto_financiero)}`;

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
