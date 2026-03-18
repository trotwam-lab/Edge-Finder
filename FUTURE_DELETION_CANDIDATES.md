# Future Deletion Candidates

## Do not remove yet
These are likely cleanup candidates later, but should only be removed after preview deploy verification passes.

### `@supabase/supabase-js`
Reason:
- no longer used on the client in this branch
- webhook path was reworked toward Firebase/Firestore
- remove only after preview deploy confirms no remaining dependency path needs it

### Supabase env vars in Vercel
Potential later cleanup candidates:
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_SERVICE_ROLE_KEY`

Only remove after:
1. preview deploy passes
2. webhook / tier flow is verified on Firebase-first path
3. no remaining routes/tools rely on those vars

## Safe to keep for now
Keeping old env vars temporarily is safer than deleting them early and breaking a hidden path.
