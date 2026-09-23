// Firestore security rules check. Run with `npm run test:rules`, which starts
// the Firestore emulator (needs Java) and runs this file against it.
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const env = await initializeTestEnvironment({
  projectId: 'demo-edgefinder',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8089 },
});

await env.withSecurityRulesDisabled(async (ctx) => {
  await setDoc(doc(ctx.firestore(), 'users/alice'), { subscriptionTier: 'free' });
});

const alice = env.authenticatedContext('alice').firestore();
const bob = env.authenticatedContext('bob').firestore();
const anon = env.unauthenticatedContext().firestore();

const cases = [
  ['owner can write synced bets', () => assertSucceeds(setDoc(doc(alice, 'users/alice/data/bets'), { bets: [] }))],
  ['owner can write daily bet backups', () => assertSucceeds(setDoc(doc(alice, 'users/alice/bets_snapshots/2026-09-23'), { bets: [] }, { merge: true }))],
  ['owner can read synced bets', () => assertSucceeds(getDoc(doc(alice, 'users/alice/data/bets')))],
  ['owner can read own user doc', () => assertSucceeds(getDoc(doc(alice, 'users/alice')))],
  ['owner cannot self-grant Pro', () => assertFails(setDoc(doc(alice, 'users/alice'), { subscriptionTier: 'pro', subscriptionStatus: 'active' }, { merge: true }))],
  ['other users cannot read bets', () => assertFails(getDoc(doc(bob, 'users/alice/data/bets')))],
  ['other users cannot write bets', () => assertFails(setDoc(doc(bob, 'users/alice/data/bets'), { bets: [] }))],
  ['signed-out users are denied', () => assertFails(getDoc(doc(anon, 'users/alice/data/bets')))],
  ['clients cannot write receipts', () => assertFails(setDoc(doc(alice, 'edge_receipts/2026-09-23'), { x: 1 }))],
];

let failed = 0;
for (const [name, run] of cases) {
  try {
    await run();
    console.log(`ok   ${name}`);
  } catch (err) {
    failed += 1;
    console.log(`FAIL ${name}: ${err.message}`);
  }
}
await env.cleanup();
if (failed) {
  console.error(`${failed} rules check(s) failed`);
  process.exit(1);
}
