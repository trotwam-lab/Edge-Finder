// src/lib/supabase.js
// Supabase client — used for persistent data storage (bets, user prefs, etc.)
// Firebase handles auth + subscription tier. Supabase handles relational data.
//
// Required Vercel env vars:
//   VITE_SUPABASE_URL      — https://ycjrxjpiwvkdswwvyqtg.supabase.co
//   VITE_SUPABASE_ANON_KEY — eyJ... (public anon key from Supabase Dashboard → Settings → API)

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);

// ─── Bet Tracker helpers ───────────────────────────────────────────────────

/**
 * Load all bets for a user (identified by their Firebase UID or email).
 * Table: bets  columns: id, user_id, created_at, sport, event, bet_type,
 *              pick, odds, stake, result, profit, notes
 */
export async function loadBets(userId) {
  const { data, error } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('loadBets error:', error.message);
    return [];
  }
  return data;
}

/**
 * Save a new bet.
 */
export async function saveBet(userId, bet) {
  const { data, error } = await supabase
    .from('bets')
    .insert([{ ...bet, user_id: userId }])
    .select()
    .single();

  if (error) {
    console.error('saveBet error:', error.message);
    return null;
  }
  return data;
}

/**
 * Update an existing bet (e.g. mark as won/lost, add notes).
 */
export async function updateBet(betId, updates) {
  const { data, error } = await supabase
    .from('bets')
    .update(updates)
    .eq('id', betId)
    .select()
    .single();

  if (error) {
    console.error('updateBet error:', error.message);
    return null;
  }
  return data;
}

/**
 * Delete a bet by ID.
 */
export async function deleteBet(betId) {
  const { error } = await supabase
    .from('bets')
    .delete()
    .eq('id', betId);

  if (error) {
    console.error('deleteBet error:', error.message);
    return false;
  }
  return true;
}
