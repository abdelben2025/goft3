import { createClient } from '@supabase/supabase-js';

const STORED_URL_KEY = 'goft3_supabase_url';
const STORED_KEY_KEY = 'goft3_supabase_key';
// Helper to check URL validity
const isValidUrl = (urlString: string) => {
    try {
        return Boolean(new URL(urlString));
    } catch (e) {
        return false;
    }
};

// Get config from localStorage
const storedUrl = localStorage.getItem(STORED_URL_KEY);
const storedKey = localStorage.getItem(STORED_KEY_KEY);

export const isConfigured = storedUrl && isValidUrl(storedUrl) && storedKey;

// Export the client if configured, otherwise null. 
// This prevents the "Invalid URL" error during module initialization.
export const supabase = isConfigured 
    ? createClient(storedUrl!, storedKey!) 
    : null;

export const saveConfiguration = (url: string, key: string) => {
    localStorage.setItem(STORED_URL_KEY, url.trim());
    localStorage.setItem(STORED_KEY_KEY, key.trim());
    window.location.reload();
};

export const resetConfiguration = () => {
    localStorage.removeItem(STORED_URL_KEY);
    localStorage.removeItem(STORED_KEY_KEY);
    window.location.reload();
};
