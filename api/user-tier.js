import { getRequestTier } from './_auth.js';
import { guardRequest } from './_http.js';

// The signed-in user's plan, for the app's UI. It uses exactly the lookup
// that gates the data routes (/api/odds, /api/props, /api/edges), so the
// screen can never say Free while the data says Pro, or the reverse. (This
// route used to keep its own copy of that logic, and the copies drifted: a
// trialing Stripe subscription unlocked Pro data but showed as Free here.)
export default async function handler(req, res, deps = {}) {
  if (guardRequest(req, res, { route: 'user-tier', rateLimit: 60 })) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  // SECURITY: identity comes from the verified token, never the query
  // string — otherwise this endpoint is a public oracle that reveals
  // whether any email address has an active subscription. Fresh lookup:
  // this call runs on load and right after checkout, when a plan
  // remembered from before the purchase would be stale.
  const tierInfo = await (deps.getRequestTier || getRequestTier)(req, { fresh: true });
  if (!tierInfo?.uid) {
    // No token, or one that failed verification.
    return res.status(401).json({ error: 'Sign in to check subscription tier.' });
  }

  return res.status(200).json({
    tier: tierInfo.tier === 'pro' ? 'pro' : 'free',
    source: tierInfo.source,
    ...(tierInfo.source === 'admin' ? { admin: true } : {}),
    ...(tierInfo.source === 'complimentary' ? { complimentary: true } : {}),
  });
}
