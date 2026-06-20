import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

function getRazorpayClient(): Razorpay {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error('Razorpay is not configured. Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET.');
  }
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

// Generates a Razorpay "hosted" checkout URL.
// Note: This requires Razorpay hosted checkout URL format support.
// If your Razorpay account supports hosted checkout, this will work.
// Otherwise, backend should fallback to creating an order and letting frontend open checkout.
export async function createRazorpayHostedCheckoutLink(opts: {
  amount: number;
  currency?: string;
  receipt: string;
  // metadata used for webhook verification / correlation
  bookingId: number;
}) {
  const client = getRazorpayClient();

  const currency = opts.currency ?? 'INR';
  const order = await client.orders.create({
    amount: Math.round(opts.amount * 100),
    currency,
    receipt: opts.receipt,
    // Some Razorpay order params may differ by API version.
    // Using payment_capture is common for checkout.
    payment_capture: 1,
  } as any);

  // Razorpay hosted checkout URL varies by account/support.
  // If this endpoint doesn't work in your account, switch to frontend checkout using the returned orderId.
  const paymentLink = `https://checkout.razorpay.com/v1/payment/${(order as any).id}`;

  return {
    orderId: (order as any).id,
    paymentLink,
  };
}


