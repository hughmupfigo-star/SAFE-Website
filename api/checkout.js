const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, customer } = req.body;

    if (!items || !customer) {
      return res.status(400).json({ error: 'Missing items or customer' });
    }

    const lineItems = items.map(item => ({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: item.name,
          description: `Size: ${item.size}, Color: ${item.color}`
        },
        unit_amount: Math.round(item.price * 100)
      },
      quantity: 1
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card', 'klarna', 'ideal', 'amazon_pay'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: customer.email,

      // Billing & Shipping - Stripe handles UI
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['GB', 'US', 'CA', 'AU', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'CH', 'SE', 'NO', 'DK', 'IE', 'NZ', 'SG', 'JP']
      },

      // Shipping Options
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 500, currency: 'gbp' },
            display_name: 'Standard Shipping (3-5 business days)'
          }
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 800, currency: 'gbp' },
            display_name: 'Premium DPD Shipping + Tracking (1-2 business days)'
          }
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 1600, currency: 'gbp' },
            display_name: 'International (EU)'
          }
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 1800, currency: 'gbp' },
            display_name: 'International (USA) / Canada'
          }
        },
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: { amount: 2200, currency: 'gbp' },
            display_name: 'International (Rest of the World)'
          }
        }
      ],

      // Tax
      automatic_tax: { enabled: true },

      success_url: `${req.headers.origin || 'https://safe-website.netlify.app'}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.headers.origin || 'https://safe-website.netlify.app'}/checkout.html`
    });

    res.status(200).json({
      sessionUrl: session.url,
      sessionId: session.id
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};
