import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function parseServiceAccountJson() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch (error) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', error.message);
    return null;
  }
}

function getSplitCredential() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return { projectId, clientEmail, privateKey };
}

// The Firebase project the web client authenticates against (src/firebase.js).
// ID tokens are minted for THIS project, so token verification must use it.
const CLIENT_PROJECT_ID = process.env.FIREBASE_AUTH_PROJECT_ID || 'edgefinder-9d42e';

// Verifying an ID token only needs the project id — signatures are checked
// against Google's public certs, no service account required. This keeps Pro
// tier detection working even if FIREBASE_SERVICE_ACCOUNT is missing or
// belongs to a different Firebase project (which makes verifyIdToken on the
// default app fail with an incorrect-"aud" error for every user).
export function getTokenVerifierApp() {
  const existing = getApps().find(app => app.name === 'token-verifier');
  if (existing) return existing;
  return initializeApp({ projectId: CLIENT_PROJECT_ID }, 'token-verifier');
}

export function getAdminApp() {
  const defaultApp = getApps().find(app => app.name === '[DEFAULT]');
  if (defaultApp) return defaultApp;

  const serviceAccount = parseServiceAccountJson();
  const splitCredential = getSplitCredential();
  const credential = serviceAccount || splitCredential;

  if (!credential) {
    return null;
  }

  return initializeApp({
    credential: cert(credential),
  });
}

export function getAdminDb() {
  const app = getAdminApp();
  if (!app) return null;
  return getFirestore(app);
}
