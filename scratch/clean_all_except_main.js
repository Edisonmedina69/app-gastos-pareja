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

async function clean() {
  console.log("=== TRYING TO CLEAN DATABASE ===");
  
  // 1. Get spaces
  const { data: espacios, error: errEsp } = await supabase.from('espacios').select('*');
  if (errEsp) {
    console.error("Error fetching spaces:", errEsp.message);
    return;
  }
  
  console.log(`Found ${espacios.length} spaces:`);
  for (const esp of espacios) {
    console.log(`- Space: ${esp.nombre_familia} (ID: ${esp.id}, Code: ${esp.codigo_invitacion})`);
  }

  // 2. Delete spaces other than main space
  console.log("\nDeleting non-main spaces...");
  const spacesToDelete = espacios.filter(e => e.id !== MAIN_SPACE_ID);
  
  for (const esp of spacesToDelete) {
    console.log(`Attempting to delete space: ${esp.nombre_familia} (${esp.id})...`);
    const { data, error } = await supabase
      .from('espacios')
      .delete()
      .eq('id', esp.id)
      .select();
      
    if (error) {
      console.error(`❌ Error deleting space ${esp.nombre_familia}:`, error.message, error.details);
    } else {
      console.log(`✓ Successfully deleted space ${esp.nombre_familia}. Returned:`, data);
    }
  }

  // 3. Let's see if we can query perfiles now
  const { data: perfilesAfter, error: errPerfAfter } = await supabase.from('perfiles').select('*');
  console.log("\nPerfiles check:", perfilesAfter, errPerfAfter ? errPerfAfter.message : "No error");
}

clean();
