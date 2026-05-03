const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({ error: 'Missing session ID' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    res.status(200).json({
      sessionId: session.id,
      amount_total: session.amount_total,
      customer_email: session.customer_email,
      payment_status: session.payment_status,
      status: session.status
    });

  } catch (error) {
    console.error('Session retrieval error:', error);
    res.status(400).json({
      error: 'Unable to retrieve session details'
    });
  }
}
