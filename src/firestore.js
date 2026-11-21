import { initializeFirestore } from 'firebase/firestore';
import { app } from './firebase.js';

// Firestore rejects a whole write if any field anywhere is `undefined`. Bets
// are saved as one array, so a single stray undefined on one bet would make
// every later cloud save fail. Dropping those fields (as JSON does for the
// localStorage copy) keeps sync working.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
