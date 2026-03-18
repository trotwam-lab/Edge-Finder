# Phase 1B Notes — Firebase-first subscription model

## Current live flow
- Auth: Firebase Auth
- App tier checks: `src/AuthGate.jsx` calls `getUserTier(user.email)`
- Checkout creation: `api/create-checkout.js` passes Firebase UID in Stripe metadata and client_reference_id
- Current webhook: `api/stripe-webhook.js` writes to Supabase, not Firebase/Firestore
- Tier API: `api/user-tier.js` asks Stripe by email and ignores Firebase UID

## What is safe now
- Keep Firebase Auth exactly as-is
- Keep checkout creation path exactly as-is for now
- Do not remove `api/user-tier.js` yet because the UI depends on it

## Real mismatch
- Checkout identifies users by Firebase UID
- Tier lookup identifies users by email
- Webhook persists to Supabase, which the app no longer uses for client data

## Recommended target model
1. Firebase Auth remains the identity layer
2. Stripe checkout continues writing `firebaseUID` metadata
3. Webhook should write subscription state to Firestore using Firebase UID
4. Tier lookup should prefer Firebase UID (or Firestore doc keyed by UID), with Stripe/email fallback only during migration

## Safe next steps
1. Add a Firestore-backed subscription record model
2. Replace Supabase webhook writes with Firebase-admin / Firestore writes
3. Update tier lookup to read Firestore first, Stripe fallback second
4. Only then remove Supabase server dependency and package usage

## Do not do yet
- Do not delete `api/stripe-webhook.js` without replacing it
- Do not remove `@supabase/supabase-js` from package.json yet
- Do not change AuthGate tier-fetch contract yet
