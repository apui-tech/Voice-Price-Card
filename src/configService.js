import { getSupabaseClient } from './supabase';

const SALT = 'voice_price_v1_salt';

/** Hash PIN bằng SHA-256 (Web Crypto API, chạy trong browser) */
async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + SALT);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Đọc toàn bộ config từ Supabase, trả về object { key: value } */
export async function fetchAppConfig() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.from('app_config').select('*');
    if (error || !data) return null;
    const config = {};
    data.forEach(row => { config[row.key] = row.value; });
    return config;
  } catch {
    return null;
  }
}

/** Lưu 1 cặp key-value vào app_config (upsert) */
async function saveConfigValue(key, value) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;
  const { error } = await supabase.from('app_config').upsert({ key, value });
  return !error;
}

/** Lưu toàn bộ LLM config lên Supabase */
export async function saveLlmConfig(llmConfig) {
  const results = await Promise.all([
    saveConfigValue('llm_api_key', llmConfig.apiKey || ''),
    saveConfigValue('llm_base_url', llmConfig.baseUrl || ''),
    saveConfigValue('llm_models', JSON.stringify(llmConfig.models || [])),
  ]);
  return results.every(Boolean);
}

/** Lấy LLM config từ object config đã fetch */
export function parseLlmConfig(appConfig) {
  if (!appConfig) return null;
  const models = (() => {
    try { return JSON.parse(appConfig.llm_models || '[]'); } catch { return []; }
  })();
  return {
    apiKey: appConfig.llm_api_key || '',
    baseUrl: appConfig.llm_base_url || 'https://api.groq.com/openai/v1',
    models: models.length ? models : ['llama-3.3-70b-versatile'],
  };
}

/** Thiết lập PIN mới (lưu hash lên Supabase) */
export async function setAdminPin(pin) {
  const hash = await hashPin(pin);
  return saveConfigValue('admin_pin_hash', hash);
}

/** Xác thực PIN nhập vào với hash đang lưu trong Supabase */
export async function verifyPin(pin, appConfig) {
  if (!appConfig?.admin_pin_hash) return false;
  const hash = await hashPin(pin);
  return hash === appConfig.admin_pin_hash;
}

/** Kiểm tra xem PIN đã được thiết lập chưa */
export function isPinConfigured(appConfig) {
  return !!(appConfig?.admin_pin_hash);
}

/** Lưu session vào localStorage (hết hạn sau 7 ngày) */
export function saveSession() {
  localStorage.setItem('auth_session', JSON.stringify({
    ts: Date.now(),
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 ngày
  }));
}

/** Kiểm tra session còn hạn không */
export function isSessionValid() {
  try {
    const raw = localStorage.getItem('auth_session');
    if (!raw) return false;
    const { ts, ttl } = JSON.parse(raw);
    return Date.now() - ts < ttl;
  } catch {
    return false;
  }
}

/** Xóa session (đăng xuất) */
export function clearSession() {
  localStorage.removeItem('auth_session');
}
