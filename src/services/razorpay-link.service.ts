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

export async function createRazorpayPaymentLink(opts: {
  amount: number;
  currency?: string;
  bookingId: number;
  callbackUrl?: string;
  customer?: { name?: string; email?: string; phone?: string };
}) {
  const client = getRazorpayClient();
  const currency = opts.currency ?? 'INR';
  const customer = opts.customer;

  const payload: any = {
    amount: Math.round(opts.amount * 100),
    currency,
    accept_partial: false,
    description: `Payment for booking #VN${opts.bookingId}`,
    callback_url: opts.callbackUrl || `${process.env.FRONTEND_ORIGIN || 'http://localhost:5174'}/payments/razorpay-link-success`,
    callback_method: 'get',
    notify: { sms: false, email: false },
    reminder_enable: false,
    notes: { bookingId: String(opts.bookingId) },
  };

  if (customer?.name || customer?.email || customer?.phone) {
    payload.customer = {
      name: customer.name ?? '',
      email: customer.email ?? '',
      contact: customer.phone ?? '',
    };
  }

  const link = await (client as any).paymentLink.create(payload);
  const paymentLink = (link as any).short_url || (link as any).id;

  return {
    paymentLinkId: (link as any).id,
    paymentLink,
  };
}


