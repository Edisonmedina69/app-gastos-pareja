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

async function run() {
  // Let's try querying pg_policies if it's exposed or if we can run raw SQL
  // (PostgREST doesn't expose system tables by default, but let's see)
  console.log("Attempting to query policies via REST api...");
  const { data, error } = await supabase.from('pg_policies').select('*');
  console.log("pg_policies result:", { data, error: error ? error.message : null });
}
run();
