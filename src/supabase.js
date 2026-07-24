import { createClient } from '@supabase/supabase-js';

// Lấy config từ localStorage hoặc Environment Variables
export function getSupabaseConfig() {
  const savedUrl = localStorage.getItem('supabase_url') || '';
  const savedKey = localStorage.getItem('supabase_anon_key') || '';
  
  // Nếu có set env vars trong Vite
  const envUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

  return {
    url: savedUrl || envUrl,
    anonKey: savedKey || envKey
  };
}

let supabaseInstance = null;

export function getSupabaseClient() {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;

  if (!supabaseInstance) {
    supabaseInstance = createClient(url, anonKey);
  }
  return supabaseInstance;
}

export function resetSupabaseClient() {
  supabaseInstance = null;
}
