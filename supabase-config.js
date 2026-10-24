const SUPABASE_URL = "https://rqxhswcquqngxjaqqymw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_9Q6cSz7VfN1bSSeFD-rptA_SgnN2Uwk";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

console.log("TaskForge Supabase client initialized:", !!supabaseClient);