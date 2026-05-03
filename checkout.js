const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Product catalog
const productCatalog = {
  'HEAVENLYCROWN': { name: 'Crown Chakra — Dad Cap', price: 3499 },
  'SAFEKIDSBUCKET': { name: 'SAFE K.I.D.S. — Reversal Bucket Hat', price: 2500 },
  'ASABOVESOBELOW': { name: 'As Above, So Below — Hoodie', price: 5500 },
  'FREEGAZA': { name: 'Free Gaza — All-Over Hoodie', price: 5500 },
  'ASABOVESOBELOW-TEE': { name: 'As Above, So Below — Tee', price: 2999 },
  'KIDSWITHGUNS': { name: 'Kids With Guns — Tee', price: 2999 },
  'JUSTICEFORGRENFELL': { name: 'Justice for Grenfell — Tee', price: 2999 },
  'FUTUREGRUENFELL': { name: 'Future Grenfell — Tee', price: 2999 },
  'SAFESKATERCROP': { name: 'SAFE Skater — Crop Tee', price: 3000 },
  'SAFEKIDSBUTTON': { name: 'SAFE K.I.D.S. — Button Shirt', price: 4000 },
  'SHORTS': { name: 'Free Gaza — Athletic Shorts', price: 3500 },
  'TRACKPANT': { name: 'Free Gaza — Wide Leg Joggers', price: 4500 },
  'SAFESKATERSKIRT': { name: 'SAFE Skater — Skirt', price: 3500 },
  'SAFESLIPGRIP': { name: 'SAFE Slip&Grip — Canvas Shoe', price: 4444 },
  'ASABOVESOBELOW-MUG': { name: 'As Above, So Below — Mug', price: 2300 },
  'FREEGAZA-POSTER': { name: 'Free Gaza — Poster', price: 9999 }
};

const shippingOptions = {
  standard: { name: 'Standard Shipping (3-5 business days)', cost: 500 },
  express: { name: 'Express Shipping (1-2 business days)', cost: 1200 }
};

function calculateTax(amount, country) {
  if (country === 'GB') return Math.round(amount * 0.20);
  if (country === 'US') return Math.round(amount * 0.08);
  return Math.round(amount * 0.20);
}

function validateCartItems(items) {
  const errors = [];
  if (!items || items.length === 0) {
    errors.push('Cart is empty');
    return { valid: false, errors };
  }
  items.forEach((item, index) => {
    if (!item.code || !productCatalog[item.code]) {
      errors.push(`Item ${index + 1}: Invalid product code`);
    }
    if (!item.price || item.price <= 0) {
      errors.push(`Item ${index + 1}: Invalid price`);
    }
  });
  return { valid: errors.length === 0, errors };
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items, customer, shippingMethod } = req.body;

    if (!items || !customer) {
      return res.status(400).json({ error: 'Missing items or customer information' });
    }

    const validation = validateCartItems(items);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors.join('; ') });
    }

    if (!customer.email || !customer.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    const shipping = shippingOptions[shippingMethod] || shippingOptions.standard;

    let subtotal = 0;
    const lineItems = [];

    items.forEach((item) => {
      const price = Math.round(item.price * 100);
      subtotal += item.price;

      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: item.name,
            description: `Size: ${item.size} | Colour: ${item.color}`
          },
          unit_amount: price,
        },
        quantity: 1,
      });
    });

    const taxAmount = calculateTax(subtotal * 100, customer.country);

    lineItems.push({
      price_data: {
        currency: 'gbp',
        product_data: {
          name: shipping.name,
          description: 'Shipping cost'
        },
        unit_amount: shipping.cost,
      },
      quantity: 1,
    });

    if (taxAmount > 0) {
      lineItems.push({
        price_data: {
          currency: 'gbp',
          product_data: {
            name: 'Tax',
            description: 'Sales tax'
          },
          unit_amount: taxAmount,
        },
        quantity: 1,
      });
    }

    const domain = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      customer_email: customer.email,
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: ['GB', 'US', 'CA', 'AU', 'DE', 'FR', 'NL', 'BE', 'ES', 'IT', 'SE', 'NO', 'DK', 'IE', 'NZ', 'SG', 'JP', 'AT', 'CH']
      },
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            fixed_amount: {
              amount: shipping.cost,
              currency: 'gbp',
            },
            display_name: shipping.name,
          },
        },
      ],
      metadata: {
        name: customer.name,
        address: customer.address,
        apartment: customer.apartment,
        city: customer.city,
        postcode: customer.postcode,
        country: customer.country,
        items_count: items.length,
        cart_items: JSON.stringify(items)
      },
      success_url: `${domain}/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domain}/checkout.html`,
    });

    res.status(200).json({
      sessionId: session.id,
      sessionUrl: session.url,
      clientSecret: session.client_secret
    });

  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({
      error: error.message || 'Failed to create checkout session'
    });
  }
}
