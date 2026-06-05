import { expireStaleOffers, activateScheduledOffers } from '../services/offers.service';

// Runs every 15 minutes
export const startOfferCronJobs = () => {
  const run = async () => {
    try {
      const expired = await expireStaleOffers();
      const activated = await activateScheduledOffers();
      if (expired > 0) console.log(`[CRON] Expired ${expired} offer(s)`);
      if (activated > 0) console.log(`[CRON] Activated ${activated} scheduled offer(s)`);
    } catch (err) {
      console.error('[CRON] Offer sync error:', err);
    }
  };

  run(); // run immediately on startup
  setInterval(run, 15 * 60 * 1000);
  console.log('[CRON] Offer status sync started (every 15 min)');
};
