import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import bookingsRoutes from './routes/bookings';
import usersRoutes from './routes/users';
import suitesRoutes from './routes/suites';
import addonsRoutes from './routes/addons';
import paymentsRoutes from './routes/payments';
import notificationsRoutes from './routes/notifications';
import reportsRoutes from './routes/reports';

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5174', credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use('/auth', authRoutes);
app.use('/bookings', bookingsRoutes);
app.use('/users', usersRoutes);
app.use('/suites', suitesRoutes);
app.use('/addons', addonsRoutes);
app.use('/payments', paymentsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/reports', reportsRoutes);

app.get('/', (req, res) => res.json({ message: 'VibeNests Express API' }));

export default app;
