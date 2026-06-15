import express from 'express';
import { registerUser, loginUser, refreshAccessToken, logout, resetPasswordWithToken } from '../services/auth.service';
import { createResetTokenForUser } from '../services/password.service';
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
    const token = await createResetTokenForUser(email);
    console.log('Password reset token for', email, token);
    res.json({ message: 'Password reset requested. Check logs for token (dev).' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    await resetPasswordWithToken(token, password);
    res.json({ message: 'Password reset successful' });
  } catch (err: any) {
    res.status(400).json({ message: err.message });
  }
});

export default router;
