```javascript                                                                                                    
   // api/stripe-webhook.js — Vercel serverless function                                                          
   // Stripe sends events here when payments happen (checkout completed, subscription canceled, etc.)             
                                                                                                                  
   import Stripe from 'stripe';                                                                                   
   import { initializeApp, cert, getApps } from 'firebase-admin/app';                                             
   import { getFirestore } from 'firebase-admin/firestore';                                                       
                                                                                                                  
   // Check required env vars at startup                                                                          
   const REQUIRED_ENV_VARS = [                                                                                    
     'STRIPE_SECRET_KEY',                                                                                         
     'STRIPE_WEBHOOK_SECRET',                                                                                     
     'FIREBASE_SERVICE_ACCOUNT'                                                                                   
   ];                                                                                                             
                                                                                                                  
   for (const envVar of REQUIRED_ENV_VARS) {                                                                      
     if (!process.env[envVar]) {                                                                                  
       console.error(`❌ Missing required environment variable: ${envVar}`);                                      
     }                                                                                                            
   }                                                                                                              
                                                                                                                  
   const stripe = new Stripe(process.env.STRIPE_SECRET _KEY);                                                     
                                                                                                                  
   // -------------------------------- -------------------------------- -----------                               
   // Firebase Admin init — handle FIREBASE_SERVICE_ACCOUNT env var quirks.                                       
   // -------------------------------- -------------------------------- -----------                               
   function parseServiceAccount(raw) {                                                                            
     if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');                                    
                                                                                                                  
     console.log('🔧 Parsing FIREBASE_SERVICE_ACCOUNT...');                                                       
     console.log(`   Raw length: ${raw.length} chars`);                                                           
                                                                                                                  
     const sanitized = raw                                                                                        
       .replace(/\r/g, '')                                                                                        
       .replace(/([^\\])\n/g, '$1\\n');                                                                           
                                                                                                                  
     return JSON.parse(sanitized);                                                                                
   }                                                                                                              
                                                                                                                  
   let db;                                                                                                        
   let firebaseInitialized = false;                                                                               
                                                                                                                  
   if (getApps().length === 0) {                                                                                  
     try {                                                                                                        
       const serviceAccount = parseServiceAccount(process.env. FIREBASE_SERVICE_ACCOUNT);                         
                                                                                                                  
       if (serviceAccount.private_key) {                                                                          
         serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');                           
       }                                                                                                          
                                                                                                                  
       initializeApp({ credential: cert(serviceAccount) });                                                       
       console.log('✅ Firebase Admin initialized successfully');                                                 
       firebaseInitialized = true;                                                                                
     } catch (e) {                                                                                                
       console.error('❌ Firebase Admin init error:', e.message);                                                 
       console.error('   This will cause all database operations to fail!');                                      
     }                                                                                                            
   }                                                                                                              
                                                                                                                  
   try {                                                                                                          
     db = getFirestore();                                                                                         
     console.log('✅ Firestore connected');                                                                       
   } catch (e) {                                                                                                  
     console.error('❌ Firestore connection failed:', e.message);                                                 
   }                                                                                                              
                                                                                                                  
   // Vercel config: disable body parser                                                                          
   export const config = {                                                                                        
     api: {                                                                                                       
       bodyParser: false,                                                                                         
     },                                                                                                           
   };                                                                                                             
                                                                                                                  
   // Read raw body bytes                                                                                         
   function getRawBody(req) {                                                                                     
     return new Promise((resolve, reject) => {                                                                    
       const chunks = [];                                                                                         
       req.on('data', (chunk) => chunks.push(chunk));                                                             
       req.on('end', () => resolve(Buffer.concat(chunks)));                                                       
       req.on('error', (err) => {                                                                                 
         console.error('❌ Error reading request body:', err);                                                    
         reject(err);                                                                                             
       });                                                                                                        
     });                                                                                                          
   }                                                                                                              
                                                                                                                  
   export default async function handler(req, res) {                                                              
     console.log(`\n🚀 Webhook received: ${req.method} ${new Date().toISOString()}`);                             
                                                                                                                  
     if (req.method !== 'POST') {                                                                                 
       console.error('❌ Method not allowed:', req.method);                                                       
       return res.status(405).json({ error: 'Method not allowed' });                                              
     }                                                                                                            
                                                                                                                  
     // Check Firebase is initialized                                                                             
     if (!firebaseInitialized || !db) {                                                                           
       console.error('❌ Firebase not initialized - cannot process webhook');                                     
       return res.status(500).json({                                                                              
         error: 'Server configuration error',                                                                     
         details: 'Database connection failed'                                                                    
       });                                                                                                        
     }                                                                                                            
                                                                                                                  
     let event;                                                                                                   
     try {                                                                                                        
       const rawBody = await getRawBody(req);                                                                     
       const sig = req.headers['stripe-signature'];                                                               
                                                                                                                  
       console.log(`📦 Raw body size: ${rawBody.length} bytes`);                                                  
       console.log(`🔑 Stripe signature present: ${sig ? 'Yes' : 'No'}`);                                         
                                                                                                                  
       const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.Stripe_Webhook_Key;                 
                                                                                                                  
       if (!webhookSecret) {                                                                                      
         console.error('❌ No webhook secret configured!');                                                       
         return res.status(500).json({ error: 'Webhook secret not configured' });                                 
       }                                                                                                          
                                                                                                                  
       try {                                                                                                      
         event = stripe.webhooks.constructEvent(r awBody, sig, webhookSecret);                                    
         console.log(`✅ Event verified: ${event.type} (${event.id})`);                                           
       } catch (err) {                                                                                            
         console.error('❌ Webhook signature verification failed:', err.message);                                 
         return res.status(400).json({ error: 'Invalid signature' });                                             
       }                                                                                                          
     } catch (err) {                                                                                              
       console.error('❌ Webhook parsing error:', err);                                                           
       return res.status(400).json({ error: 'Invalid webhook payload' });                                         
     }                                                                                                            
                                                                                                                  
     try {                                                                                                        
       switch (event.type) {                                                                                      
         case 'checkout.session.completed': {                                                                     
           const session = event.data.object;                                                                     
           console.log(`💳 Checkout completed:`, {                                                                
             customer: session.customer,                                                                          
             email: session.customer_email,                                                                       
             metadata: session.metadata                                                                           
           });                                                                                                    
                                                                                                                  
           const firebaseUID = session.metadata?.firebaseUID || session.client_reference_id;                      
                                                                                                                  
           if (firebaseUID) {                                                                                     
             try {                                                                                                
               await db.collection('users').doc(fireb aseUID).set({                                               
                 tier: 'pro',                                                                                     
                 stripeCustomerId: session.customer,                                                              
                 subscriptionId: session.subscription,                                                            
                 email: session.customer_email,                                                                   
                 updatedAt: new Date().toISOString(),                                                             
               }, { merge: true });                                                                               
               console.log(`✅ User ${firebaseUID} upgraded to Pro`);                                             
             } catch (dbError) {                                                                                  
               console.error(`❌ Database error for user ${firebaseUID}:`, dbError);                              
               throw dbError;                                                                                     
             }                                                                                                    
           } else {                                                                                               
             console.warn('⚠️ No firebaseUID in metadata or client_reference_id');                                
             console.warn('   Session metadata:', JSON.stringify(session.metadata) );                             
             console.warn('   client_reference_id:', session.client_reference_id);                                
           }                                                                                                      
           break;                                                                                                 
         }                                                                                                        
                                                                                                                  
         case 'customer.subscription.deleted': {                                                                  
           const subscription = event.data.object;                                                                
           const firebaseUID = subscription.metadata?.firebaseU ID;                                               
                                                                                                                  
           if (firebaseUID) {                                                                                     
             await db.collection('users').doc(fireb aseUID).set({                                                 
               tier: 'free',                                                                                      
               subscriptionId: null,                                                                              
               updatedAt: new Date().toISOString(),                                                               
             }, { merge: true });                                                                                 
             console.log(`⬇️ User ${firebaseUID} downgraded to free`);                                            
           }                                                                                                      
           break;                                                                                                 
         }                                                                                                        
                                                                                                                  
         case 'customer.subscription.updated': {                                                                  
           const subscription = event.data.object;                                                                
           const firebaseUID = subscription.metadata?.firebaseU ID;                                               
                                                                                                                  
           if (firebaseUID) {                                                                                     
             const isActive = ['active', 'trialing'].includes(subscriptio n.status);                              
             await db.collection('users').doc(fireb aseUID).set({                                                 
               tier: isActive ? 'pro' : 'free',                                                                   
               updatedAt: new Date().toISOString(),                                                               
             }, { merge: true });                                                                                 
             console.log(`🔄 User ${firebaseUID} subscription status: ${subscription.status}`);                   
           }                                                                                                      
           break;                                                                                                 
         }                                                                                                        
                                                                                                                  
         case 'invoice.payment_succeeded': {                                                                      
           const invoice = event.data.object;                                                                     
           const customerId = invoice.customer;                                                                   
                                                                                                                  
           if (customerId && invoice.subscription) {                                                              
             const snap = await db.collection('users')                                                            
               .where('stripeCustomerId', '==', customerId)                                                       
               .limit(1).get();                                                                                   
                                                                                                                  
             if (!snap.empty) {                                                                                   
               await snap.docs[0].ref.set({                                                                       
                 tier: 'pro',                                                                                     
                 subscriptionId: invoice.subscription,                                                            
                 updatedAt: new Date().toISOString(),                                                             
               }, { merge: true });                                                                               
               console.log(`✅ Invoice paid - user ${snap.docs[0].id} remains Pro`);                              
             } else {                                                                                             
               console.warn(`⚠️ No user found with stripeCustomerId: ${customerId}`);                             
             }                                                                                                    
           }                                                                                                      
           break;                                                                                                 
         }                                                                                                        
                                                                                                                  
         case 'invoice.payment_failed': {                                                                         
           const invoice = event.data.object;                                                                     
           const customerId = invoice.customer;                                                                   
                                                                                                                  
           if (customerId) {                                                                                      
             const snap = await db.collection('users')                                                            
               .where('stripeCustomerId', '==', customerId)                                                       
               .limit(1).get();                                                                                   
                                                                                                                  
             if (!snap.empty) {                                                                                   
               await snap.docs[0].ref.set({                                                                       
                 paymentFailed: true,                                                                             
                 updatedAt: new Date().toISOString(),                                                             
               }, { merge: true });                                                                               
               console.warn(`⚠️ Payment failed for customer ${customerId}`);                                      
             }                                                                                                    
           }                                                                                                      
           break;                                                                                                 
         }                                                                                                        
                                                                                                                  
         default:                                                                                                 
           console.log(`ℹ️ Unhandled event type: ${event.type}`);                                                 
       }                                                                                                          
                                                                                                                  
       console.log('✅ Webhook processed successfully');                                                          
       return res.status(200).json({ received: true });                                                           
     } catch (err) {                                                                                              
       console.error('❌ Webhook handler error:', err);                                                           
       console.error('   Stack:', err.stack);                                                                     
       return res.status(500).json({                                                                              
         error: 'Webhook handler failed',                                                                         
         message: err.message                                                                                     
       });                                                                                                        
     }                                                                                                            
   }                                                                                                              
 ```/ api/stripe-webhook.js — Vercel serverless function
// Stripe sends events here when payments happen (checkout completed, subscription canceled, etc.)

import Stripe from 'stripe';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Check required env vars at startup
const REQUIRED_ENV_VARS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'FIREBASE_SERVICE_ACCOUNT'
];

for (const envVar of REQUIRED_ENV_VARS) {
  if (!process.env[envVar]) {
    console.error(`❌ Missing required environment variable: ${envVar}`);
  }
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ---------------------------------------------------------------------------
// Firebase Admin init — handle FIREBASE_SERVICE_ACCOUNT env var quirks.
// ---------------------------------------------------------------------------
function parseServiceAccount(raw) {
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT env var is not set');
  
  console.log('🔧 Parsing FIREBASE_SERVICE_ACCOUNT...');
  console.log(`   Raw length: ${raw.length} chars`);
  
  const sanitized = raw
    .replace(/\r/g, '')
    .replace(/([^\\])\n/g, '$1\\n');
  
  return JSON.parse(sanitized);
}

let db;
let firebaseInitialized = false;

if (getApps().length === 0) {
  try {
    const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
    
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    
    initializeApp({ credential: cert(serviceAccount) });
    console.log('✅ Firebase Admin initialized successfully');
    firebaseInitialized = true;
  } catch (e) {
    console.error('❌ Firebase Admin init error:', e.message);
    console.error('   This will cause all database operations to fail!');
  }
}

try {
  db = getFirestore();
  console.log('✅ Firestore connected');
} catch (e) {
  console.error('❌ Firestore connection failed:', e.message);
}

// Vercel config: disable body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

// Read raw body bytes
function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', (err) => {
      console.error('❌ Error reading request body:', err);
      reject(err);
    });
  });
}

export default async function handler(req, res) {
  console.log(`\n🚀 Webhook received: ${req.method} ${new Date().toISOString()}`);
  
  if (req.method !== 'POST') {
    console.error('❌ Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check Firebase is initialized
  if (!firebaseInitialized || !db) {
    console.error('❌ Firebase not initialized - cannot process webhook');
    return res.status(500).json({ 
      error: 'Server configuration error',
      details: 'Database connection failed'
    });
  }

  let event;
  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];
    
    console.log(`📦 Raw body size: ${rawBody.length} bytes`);
    console.log(`🔑 Stripe signature present: ${sig ? 'Yes' : 'No'}`);
    
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.Stripe_Webhook_Key;
    
    if (!webhookSecret) {
      console.error('❌ No webhook secret configured!');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
      console.log(`✅ Event verified: ${event.type} (${event.id})`);
    } catch (err) {
      console.error('❌ Webhook signature verification failed:', err.message);
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('❌ Webhook parsing error:', err);
    return res.status(400).json({ error: 'Invalid webhook payload' });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        console.log(`💳 Checkout completed:`, {
          customer: session.customer,
          email: session.customer_email,
          metadata: session.metadata
        });
        
        const firebaseUID = session.metadata?.firebaseUID || session.client_reference_id;
        
        if (firebaseUID) {
          try {
            await db.collection('users').doc(firebaseUID).set({
              tier: 'pro',
              stripeCustomerId: session.customer,
              subscriptionId: session.subscription,
              email: session.customer_email,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            console.log(`✅ User ${firebaseUID} upgraded to Pro`);
          } catch (dbError) {
            console.error(`❌ Database error for user ${firebaseUID}:`, dbError);
            throw dbError;
          }
        } else {
          console.warn('⚠️ No firebaseUID in metadata or client_reference_id');
          console.warn('   Session metadata:', JSON.stringify(session.metadata));
          console.warn('   client_reference_id:', session.client_reference_id);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const firebaseUID = subscription.metadata?.firebaseUID;
        
        if (firebaseUID) {
          await db.collection('users').doc(firebaseUID).set({
            tier: 'free',
            subscriptionId: null,
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          console.log(`⬇️ User ${firebaseUID} downgraded to free`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const firebaseUID = subscription.metadata?.firebaseUID;
        
        if (firebaseUID) {
          const isActive = ['active', 'trialing'].includes(subscription.status);
          await db.collection('users').doc(firebaseUID).set({
            tier: isActive ? 'pro' : 'free',
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          console.log(`🔄 User ${firebaseUID} subscription status: ${subscription.status}`);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        if (customerId && invoice.subscription) {
          const snap = await db.collection('users')
            .where('stripeCustomerId', '==', customerId)
            .limit(1).get();
            
          if (!snap.empty) {
            await snap.docs[0].ref.set({
              tier: 'pro',
              subscriptionId: invoice.subscription,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            console.log(`✅ Invoice paid - user ${snap.docs[0].id} remains Pro`);
          } else {
            console.warn(`⚠️ No user found with stripeCustomerId: ${customerId}`);
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        
        if (customerId) {
          const snap = await db.collection('users')
            .where('stripeCustomerId', '==', customerId)
            .limit(1).get();
            
          if (!snap.empty) {
            await snap.docs[0].ref.set({
              paymentFailed: true,
              updatedAt: new Date().toISOString(),
            }, { merge: true });
            console.warn(`⚠️ Payment failed for customer ${customerId}`);
          }
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    console.log('✅ Webhook processed successfully');
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('❌ Webhook handler error:', err);
    console.error('   Stack:', err.stack);
    return res.status(500).json({ 
      error: 'Webhook handler failed',
      message: err.message 
    });
  }
}
