const Stripe = require('stripe');

let stripe;
const key = process.env.STRIPE_SECRET_KEY;

if (key && !key.includes('your_stripe_secret')) {
    try {
        stripe = new Stripe(key);
    } catch (err) {
        console.error('❌ Stripe initialization failed:', err.message);
    }
} else {
    console.warn('⚠️ Stripe: STRIPE_SECRET_KEY is missing or using placeholder. Payment features will be disabled.');
}

module.exports = stripe;
