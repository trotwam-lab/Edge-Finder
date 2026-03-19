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

function initAdminApp() {
  if (getApps().length) return getApps()[0];

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
  const app = initAdminApp();
  if (!app) return null;
  return getFirestore(app);
}
