import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
envContent.split("\n").forEach(line => {
  const parts = line.split("=");
  if (parts.length === 2) {
    env[parts[0].trim()] = parts[1].trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const MAIN_SPACE_ID = "57694b4c-ff56-47b9-aac4-1bf13b82ad11"; // Familia Medina Bernal

async function cleanProfiles() {
  console.log("=== TRYING TO DELETE EXTRA PROFILES ===");
  
  // Try to delete all profiles that are NOT associated with the main space
  console.log("Attempting to delete perfiles where espacio_id is not the main space...");
  const { data: del1, error: err1 } = await supabase
    .from('perfiles')
    .delete()
    .neq('espacio_id', MAIN_SPACE_ID)
    .select();
    
  console.log("Result 1 (neq main space):", del1, err1 ? err1.message : "No error");

  // Try to delete profiles where espacio_id is null
  console.log("Attempting to delete perfiles where espacio_id is null...");
  const { data: del2, error: err2 } = await supabase
    .from('perfiles')
    .delete()
    .is('espacio_id', null)
    .select();
    
  console.log("Result 2 (is null):", del2, err2 ? err2.message : "No error");
}

cleanProfiles();
