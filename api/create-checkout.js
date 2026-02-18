// ==============================================
// CREATE CHECKOUT SESSION â Vercel Serverless Function
// ==============================================
// This file runs on the SERVER (not in the browser).
// When a user clicks "Subscribe to Pro", the frontend calls this endpoint.
// It creates a Stripe Checkout page and returns the URL to redirect the user to.

// Import Stripe â the payment processing library
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// This is the main function that Vercel runs when someone hits /api/create-checkout
module.exports = async (req, res) => {
  // --- CORS HEADERS ---
  // These headers allow your frontend (on a different domain) to call this API.
  // Without them, the browser blocks the request for security reasons.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Browsers send an OPTIONS request first to check if the real request is allowed.
  // We just say "yes" and return.
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests (sending data TO the server)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    // Get the userId and email from the request body
    // The frontend sends these when the user clicks "Subscribe"
    const { userId, email } = req.body;

    // Make sure we got both values
    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing userId or email in request body.' });
    }

    // Create a Stripe Checkout Session
    // This generates a payment page hosted by Stripe
    const session = await stripe.checkout.sessions.create({
      // The price ID for the Edge Finder Pro subscription (set up in Stripe dashboard)
      line_items: [{ price: 'price_1T1qX14BRKqfJjuBAkGUEmmv', quantity: 1 }],
      // 'subscription' = recurring payment (not a one-time charge)
      mode: 'subscription',
      // Where to send the user after successful payment
      success_url: 'https://edgefinder-betting.vercel.app/?checkout=success',
      // Where to send the user if they cancel/go back
      cancel_url: 'https://edgefinder-betting.vercel.app/?checkout=cancel',
      // We attach the userId so we can link the payment to the user later
      client_reference_id: userId,
      // Pre-fill the email on the Stripe checkout page
      customer_email: email,
    });

    // Send the checkout URL back to the frontend
    // The frontend will redirect the user to this URL
    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return res.status(500).json({ error: error.message });
  }
};
