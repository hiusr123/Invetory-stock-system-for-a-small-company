import { createClient } from '@supabase/supabase-js'

// Try to get from .env first, then localStorage
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('MY_PRIVATE_URL') || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || localStorage.getItem('MY_PRIVATE_KEY') || '';

// We will export a generic initialize function that the Provider can call
// if credentials are missing
export let supabase = null;

export const initSupabase = (url, key) => {
    if (url && key) {
        supabase = createClient(url, key);
    }
    return supabase;
};

// Initialize if we already have keys
if (supabaseUrl && supabaseKey) {
    initSupabase(supabaseUrl, supabaseKey);
}

// API bridged helper functions similar to db.js for direct API usage if needed.
// However, the React implementation will primarily use the supabase client directly.
