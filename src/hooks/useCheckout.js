import { useCallback, useState } from 'react';
import { useAuth } from '../AuthGate.jsx';

// Shared Stripe checkout starter. Any locked surface (blurred edges, locked
// books, Pro badges) can open checkout directly at the moment of desire
// instead of routing the user through the Settings page first.
//
// startCheckout('monthly' | 'annual') → redirects to Stripe on success.
export function useCheckout() {
  const { user } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const startCheckout = useCallback(async (plan = 'monthly') => {
    if (!user) {
      alert('Please log in first to subscribe.');
      return false;
    }

    setIsCheckingOut(true);
    try {
      // Identity travels as a verified ID token — the server ignores any
      // body-supplied userId/email when creating checkout sessions.
      const token = await user.getIdToken();
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url;
        return true;
      }
      console.error('Checkout error:', data.error);
      alert('Failed to start checkout: ' + (data.error || 'Unknown error'));
      return false;
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to start checkout. Please try again.');
      return false;
    } finally {
      setIsCheckingOut(false);
    }
  }, [user]);

  return { startCheckout, isCheckingOut, canCheckout: !!user };
}
