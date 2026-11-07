import { createClient } from "@supabase/supabase-js";
import { setTokenProvider } from "../api/client";

const url = import.meta.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321";
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "missing-anon-key";

if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  console.warn("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set; sign-in will not work.");
}

// The anon key is public by design. Authorisation is enforced by the API, never by the browser.
export const supabase = createClient(url, anon);

setTokenProvider(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);
