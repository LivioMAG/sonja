const SUPABASE_URL = "YOUR_SUPABASE_URL";
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";

if (!window.supabase) {
  console.error("Supabase CDN konnte nicht geladen werden.");
}

const bucketClient = window.supabase?.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
