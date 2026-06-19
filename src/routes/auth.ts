import express from 'express';
import { registerUser, loginUser, refreshAccessToken, logout, resetPasswordWithToken } from '../services/auth.service';
// import { createResetTokenForUser, verifyResetToken } from '../services/password.service';

import { createResetTokenForUser, changePasswordForUser, verifyResetToken } from '../services/password.service';
import { authenticate } from '../middleware/auth';
import { sendOtp, verifyOtp } from '../services/otp.service';
import { validateBody } from '../middleware/validate';
import { registerSchema, loginSchema } from '../validation/schemas';
import { rateLimiter } from '../middleware/rateLimit';
import crypto from 'crypto';
import { AppDataSource } from '../data-source';
import { User } from '../entities/User';

const router = express.Router();

router.post('/register', validateBody(registerSchema), async (req, res) => {
  try {
    const user = await registerUser(req.body);
    res.status(201).json({ 
      id: user.id, 
      email: user.email, 
      role: user.role, 
      fullName: user.fullName, 
      dateOfBirth: user.dateOfBirth ?? null,
      marriageDate: user.marriageDate ?? null,
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;
    const data = await loginUser(email, password);
    res.json({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: { id: data.user.id, email: data.user.email, role: data.user.role, fullName: data.user.fullName, dateOfBirth: data.user.dateOfBirth ?? null },
    });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/otp/send', async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: 'phone is required' });
    const result = await sendOtp(phone);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/otp/verify', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) return res.status(400).json({ message: 'phone and otp are required' });
    const data = await verifyOtp(phone, otp);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const data = await refreshAccessToken(refreshToken);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    await logout(refreshToken);
    res.json({ message: 'Logged out' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

// Rate limiters:
// Forgot password: 3 requests per 15 minutes per IP
const forgotPasswordLimit = rateLimiter(15 * 60 * 1000, 3, 'Too many password reset requests from this IP. Please try again after 15 minutes.');
// Reset password: 5 attempts per 15 minutes per IP
const resetPasswordLimit = rateLimiter(15 * 60 * 1000, 5, 'Too many password reset attempts. Please try again after 15 minutes.');

router.post('/forgot-password', forgotPasswordLimit, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email is required' });
    }
    try {
      await createResetTokenForUser(email);
    } catch (err: any) {
      if (err?.message === 'smtp_not_configured') {
        throw err;
      }
      if (err?.message !== 'User not found') {
        console.warn('Error during forgot-password token creation:', err.message);
      }
    }
    res.json({ message: 'If that email address is registered, a password reset link has been sent to it.' });
  } catch (err: any) {
    if (err?.message === 'smtp_not_configured') {
      return res.status(503).json({ message: 'Email service is not configured. Please contact support.' });
    }
    return res.status(400).json({ message: err.message || 'Failed to request password reset' });
  }
});

router.get('/verify-reset-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ valid: false, message: 'Token is required' });

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOneBy({ resetPasswordToken: hashedToken });

    if (!user) {
      return res.status(400).json({ valid: false, message: 'This password reset link is invalid or has already been used.' });
    }

    const now = new Date();
    if (!user.resetPasswordExpiresAt || user.resetPasswordExpiresAt < now) {
      return res.status(400).json({ valid: false, message: 'This password reset link has expired.' });
    }

    res.json({ valid: true, email: user.email });
  } catch (err: any) {
    res.status(400).json({ valid: false, message: err.message });
  }
});

router.post('/reset-password', resetPasswordLimit, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token) return res.status(400).json({ message: 'token is required' });
    if (!password) return res.status(400).json({ message: 'password is required' });

    // Validate early so we return consistent error when token is invalid.
    verifyResetToken(token);

    await resetPasswordWithToken(token, password);
    return res.json({ message: 'Password reset successful' });
  } catch (err: any) {
    return res.status(400).json({ message: err.message || 'Invalid or expired token' });
  }
});

router.post('/change-password', authenticate, async (req: any, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }
    await changePasswordForUser(req.user.id, currentPassword, newPassword);
    res.json({ message: 'Password updated successfully' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
