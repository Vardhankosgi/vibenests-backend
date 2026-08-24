import express from 'express';
import cors from 'cors';
import { translationMiddleware, languageResolverMiddleware } from './middleware/translation';
import authRoutes from './routes/auth';
import bookingsRoutes from './routes/bookings';
import usersRoutes from './routes/users';
import suitesRoutes from './routes/suites';
import addonsRoutes from './routes/addons';
import paymentsRoutes from './routes/payments';
import paymentsLinksRoutes from './routes/payments-links';
import paymentsLinksPublicRoutes from './routes/payments-links-public';


import notificationsRoutes from './routes/notifications';
import appNotificationsRoutes from './routes/app-notifications';
import reportsRoutes from './routes/reports';
import offersRoutes from './routes/offers';
import couponsRoutes from './routes/coupons';
import refundsRoutes from './routes/refunds';
import taxChargesRoutes from './routes/taxCharges';
import bookingRulesRoutes from './routes/bookingRules';
import liveCelebrationRoutes from './routes/liveCelebrationSettings';
import offerConfigRoutes from './routes/offerConfiguration';
import auditLogsRoutes from './routes/auditLogs';
import webhookRoutes from './routes/webhook';
import llmRoutes from './routes/llm';


import reviewsRoutes from './routes/reviews';
import membershipRoutes from './routes/memberships';
import referralsRoutes from './routes/referrals';
import globalSettingsRoutes from './routes/globalSettings';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(languageResolverMiddleware);
app.use(translationMiddleware);

// Existing routes
app.use('/auth', authRoutes);
app.use('/bookings', bookingsRoutes);
app.use('/users', usersRoutes);
app.use('/suites', suitesRoutes);
app.use('/addons', addonsRoutes);
app.use('/payments', paymentsRoutes);
app.use('/payments-links', paymentsLinksRoutes);
app.use('/payments-links-public', paymentsLinksPublicRoutes);

// also mount public link routes if needed


app.use('/notifications', notificationsRoutes);
app.use('/app-notifications', appNotificationsRoutes);
app.use('/reports', reportsRoutes);

// New modules
app.use('/offers', offersRoutes);

app.use('/coupons', couponsRoutes);
app.use('/refunds', refundsRoutes);
app.use('/tax-charges', taxChargesRoutes);
app.use('/booking-rules', bookingRulesRoutes);
app.use('/live-celebration-settings', liveCelebrationRoutes);
app.use('/offer-configurations', offerConfigRoutes);
app.use('/audit-logs', auditLogsRoutes);
app.use('/', webhookRoutes);
app.use('/llm', llmRoutes);
app.use('/reviews', reviewsRoutes);
app.use('/memberships', membershipRoutes);
app.use('/referrals', referralsRoutes);
app.use('/global-settings', globalSettingsRoutes);

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {

  console.error('[ERROR]', err);
  res.status(err.status || 500).json({ message: err.message || 'Internal server error' });
});

app.get('/', (_req, res) => res.json({ message: 'VibeNests API v2' }));
app.get('/health', (_req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));

export default app;
