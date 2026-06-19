import express from 'express';
import { registerUser, loginUser, refreshAccessToken, logout, resetPasswordWithToken } from '../services/auth.service';
import { createResetTokenForUser, verifyResetToken } from '../services/password.service';

import { sendOtp, verifyOtp } from '../services/otp.service';
import { validateBody } from '../middleware/validate';
import { registerSchema, loginSchema } from '../validation/schemas';

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

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      return res.status(400).json({ message: 'email is required' });
    }

    // Always respond with success to avoid user enumeration.
    await createResetTokenForUser(normalizedEmail).catch(() => undefined);
    return res.json({ message: 'Password reset requested. Check your email for the reset link.' });
  } catch (err: any) {
    if (err?.message === 'smtp_not_configured') {
      return res.status(503).json({ message: 'Email service is not configured. Please contact support.' });
    }
    return res.status(400).json({ message: err.message || 'Failed to request password reset' });
  }
});


router.post('/reset-password', async (req, res) => {
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

export default router;
