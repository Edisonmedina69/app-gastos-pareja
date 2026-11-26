import { supabase } from "./supabaseClient";

/** Chat con el asistente financiero (Edge Function `chat-ia`). */
export const consultarAsistente = (mensaje, contextoFinanciero) =>
  supabase.functions.invoke("chat-ia", { body: { mensaje, contexto_financiero: contextoFinanciero } });

/**
 * Interpreta un gasto escrito o fotografiado (Edge Function `ingreso-magico`).
 * `body` va tal cual a la función: `{ input, monedaGlobal }` o `{ foto, mimeType, ... }`.
 */
export const interpretarGastoMagico = (body) => supabase.functions.invoke("ingreso-magico", { body });
