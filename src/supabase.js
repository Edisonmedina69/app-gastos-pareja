import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uyiyhmxezgekntyquksi.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV5aXlobXhlemdla250eXF1a3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5ODE4NzAsImV4cCI6MjA4NzU1Nzg3MH0.cCLQT-XzvqtA8zJqWH1Vza1ziXr7v8h0nIS2Urlzcpw";

export const supabase = createClient(supabaseUrl, supabaseKey);
