import { AppDataSource } from '../data-source';
import { OtpCode } from '../entities/OtpCode';
import { User } from '../entities/User';
import { sendEmail, sendSms } from './notifications.service';
import { sendLoginOtp, isWhatsAppConfigured } from './whatsapp.service';

import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { createRefreshToken } from './token.service';
import dotenv from 'dotenv';

dotenv.config();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

const otpRepo = () => AppDataSource.getRepository(OtpCode);
const userRepo = () => AppDataSource.getRepository(User);

function generateOtp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

const generateAccessToken = (user: User) => {
  const payload = { userId: user.id, role: user.role, email: user.email };
  const secret: Secret = process.env.JWT_SECRET || 'secret';
  const expiresIn = (process.env.JWT_EXPIRES_IN || '1d') as SignOptions['expiresIn'];
  return jwt.sign(payload, secret, { expiresIn });
};

export const sendOtp = async (input: string | { phone?: string; email?: string }) => {
  const isDev = process.env.NODE_ENV !== 'production';

  // Determine payload type
  let phoneStr: string | undefined;
  let emailStr: string | undefined;

  if (typeof input === 'string') {
    if (input.includes('@')) {
      emailStr = input.trim().toLowerCase();
    } else {
      phoneStr = input;
    }
  } else {
    phoneStr = input.phone;
    emailStr = input.email ? input.email.trim().toLowerCase() : undefined;
  }

  // -------------------------------------------------------------
  // EMAIL OTP FLOW
  // -------------------------------------------------------------
  if (emailStr) {
    const normalisedEmail = emailStr.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalisedEmail)) {
      throw new Error('Please enter a valid email address.');
    }

    let existingUser = await userRepo().findOne({ where: { email: normalisedEmail } });
    if (!existingUser) {
      existingUser = userRepo().create({
        email: normalisedEmail,
        fullName: 'New Guest',
        role: 'customer',
        isActive: true,
        isVerified: true,
      });
      await userRepo().save(existingUser);
    }
    if (!existingUser.isActive) {
      throw new Error('Your account is not active. Please contact support.');
    }

    // Invalidate old unused OTPs for this email
    await otpRepo().update({ email: normalisedEmail, used: false }, { used: true });

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const entry = otpRepo().create({ email: normalisedEmail, code, expiresAt, used: false });
    await otpRepo().save(entry);

    const emailSubject = 'VibeNests — Your One-Time Password (OTP)';
    const textMessage = `Welcome to VibeNests Private Luxury Suites! Your One-Time Password (OTP) for account verification is ${code}. Valid for 5 minutes. Please do not share this OTP with anyone.`;
    const htmlMessage = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>VibeNests Security Verification</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #0b0d12; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 40px 15px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #121620; border: 1px solid rgba(212, 175, 55, 0.25); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
              
              <!-- HEADER -->
              <tr>
                <td align="center" style="padding: 36px 30px 24px 30px; background: linear-gradient(180deg, #181d2a 0%, #121620 100%); border-bottom: 1px solid rgba(212, 175, 55, 0.15);">
                  <table border="0" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center" style="padding-bottom: 8px;">
                        <span style="font-size: 28px; font-weight: 800; color: #d4af37; text-transform: uppercase; font-family: 'Georgia', serif; letter-spacing: 3px;">VIBENESTS</span>
                      </td>
                    </tr>
                    <tr>
                      <td align="center">
                        <span style="font-size: 11px; font-weight: 600; color: #a0aec0; letter-spacing: 2.5px; text-transform: uppercase;">Private Luxury Suites & Celebrations</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- BODY CONTENT -->
              <tr>
                <td style="padding: 36px 36px 28px 36px;">
                  <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #ffffff; text-align: center;">Account Security Verification</h1>
                  <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #cbd5e0; text-align: center;">
                    Welcome to <strong>VibeNests</strong>. Use the 4-digit verification code below to securely log into your account and explore our luxury celebration suites.
                  </p>

                  <!-- OTP CARD -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                    <tr>
                      <td align="center" style="padding: 24px; background: rgba(212, 175, 55, 0.06); border: 1.5px dashed #d4af37; border-radius: 14px;">
                        <span style="display: block; font-size: 11px; font-weight: 700; color: #a0aec0; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Your Verification Code</span>
                        <span style="display: block; font-size: 38px; font-weight: 800; color: #f6d365; letter-spacing: 12px; font-family: monospace;">${code}</span>
                        <span style="display: inline-block; margin-top: 12px; font-size: 11px; color: #e2e8f0; background: rgba(255,255,255,0.08); padding: 4px 12px; border-radius: 20px;">⏱️ Expires in 5 minutes</span>
                      </td>
                    </tr>
                  </table>

                  <!-- SECURITY NOTICE -->
                  <p style="margin: 0 0 12px 0; font-size: 12px; line-height: 1.5; color: #a0aec0; text-align: center;">
                    For your protection, do not share this One-Time Password with anyone. VibeNests staff will never ask for your code.
                  </p>
                  <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #718096; text-align: center;">
                    If you did not initiate this login request, you can safely ignore this email.
                  </p>
                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="padding: 20px 30px; background-color: #0d1017; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center;">
                  <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #d4af37;">VibeNests Luxury Hospitality Private Limited</p>
                  <p style="margin: 0; font-size: 11px; color: #4a5568;">Handpicked Private Suites & Premium Experience Spaces</p>
                  <p style="margin: 10px 0 0 0; font-size: 10px; color: #718096;">© ${new Date().getFullYear()} VibeNests. All rights reserved.</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>`;

    console.log(`[OTP DISPATCH LOG] 📧 Email OTP for "${normalisedEmail}": ${code}`);

    // Dispatch email asynchronously so HTTP API responds instantly (< 50ms)
    sendEmail(normalisedEmail, emailSubject, textMessage, htmlMessage).catch((err) => {
      console.error('[OTP EMAIL ASYNC ERROR]', err);
    });

    return {
      message: 'OTP sent to your email address',
      channel: 'email',
      ...(isDev && { otp: code }),
    };
  }

  // -------------------------------------------------------------
  // MOBILE WHATSAPP OTP FLOW
  // -------------------------------------------------------------
  if (!phoneStr) {
    throw new Error('Phone number or Email address is required.');
  }

  const normalised = phoneStr.replace(/\D/g, '');
  if (normalised.length < 7 || normalised.length > 15) {
    throw new Error('Please enter a valid mobile number.');
  }

  const matchPhone = normalised.length > 10 ? normalised.slice(-10) : normalised;

  // Check user exists
  let existingUser = await userRepo().findOne({
    where: [
      { phone: matchPhone },
      { phone: normalised },
      { phone: `+${normalised}` }
    ]
  });

  if (!existingUser) {
    existingUser = userRepo().create({
      phone: matchPhone,
      fullName: 'New Guest',
      role: 'customer',
      isActive: true,
      isVerified: true,
    });
    await userRepo().save(existingUser);
  }

  if (!existingUser.isActive) {
    throw new Error('Your account is not active. Please contact support.');
  }

  // invalidate old unused OTPs for this phone
  await otpRepo().update({ phone: normalised, used: false }, { used: true });
  await otpRepo().update({ phone: matchPhone, used: false }, { used: true });

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  const entry = otpRepo().create({ phone: normalised, code, expiresAt, used: false });
  await otpRepo().save(entry);

  const textMessage = `Your VibeNests OTP is ${code}. Valid for 5 minutes. Do not share this with anyone.`;

  console.log(`[OTP DISPATCH LOG] 📱 Mobile/WhatsApp OTP for "${normalised}": ${code}`);

  // Dispatch WhatsApp/Fallback message asynchronously so HTTP API responds instantly (< 50ms)
  (async () => {
    if (isWhatsAppConfigured()) {
      const waResult = await sendLoginOtp(normalised, code);
      if (!waResult.ok && !waResult.stub) {
        console.warn(`[OTP SERVICE WARNING] WhatsApp OTP dispatch returned error: ${JSON.stringify(waResult.error)}`);
        if (existingUser && existingUser.email && !existingUser.email.endsWith('@phone.local')) {
          await sendEmail(existingUser.email, 'VibeNests — Your Login OTP', textMessage);
        }
      }
    } else {
      if (existingUser && existingUser.email && !existingUser.email.endsWith('@phone.local')) {
        await sendEmail(existingUser.email, 'VibeNests — Your OTP', textMessage);
      } else {
        await sendSms(normalised, textMessage);
      }
    }
  })().catch((err) => {
    console.error('[OTP MOBILE ASYNC ERROR]', err);
  });

  return {
    message: 'OTP sent to your WhatsApp number',
    channel: 'whatsapp',
    ...(isDev && { otp: code }),
  };
};

export const verifyOtp = async (input: string | { phone?: string; email?: string; target?: string }, code: string) => {
  if (!code || code.trim().length !== 4) {
    throw new Error('Please enter a valid 4-digit OTP.');
  }

  let phoneStr: string | undefined;
  let emailStr: string | undefined;

  if (typeof input === 'string') {
    if (input.includes('@')) {
      emailStr = input.trim().toLowerCase();
    } else {
      phoneStr = input;
    }
  } else {
    phoneStr = input.phone;
    emailStr = input.email ? input.email.trim().toLowerCase() : undefined;
    if (!phoneStr && !emailStr && input.target) {
      if (input.target.includes('@')) {
        emailStr = input.target.trim().toLowerCase();
      } else {
        phoneStr = input.target;
      }
    }
  }

  // -------------------------------------------------------------
  // VERIFY EMAIL OTP
  // -------------------------------------------------------------
  if (emailStr) {
    const normalisedEmail = emailStr.toLowerCase();
    const entry = await otpRepo().findOne({
      where: { email: normalisedEmail, code: code.trim(), used: false },
      order: { createdAt: 'DESC' },
    });

    if (!entry) throw new Error('Invalid OTP code. Please check and try again.');
    if (entry.expiresAt < new Date()) {
      entry.used = true;
      await otpRepo().save(entry);
      throw new Error('OTP code has expired. Please request a new one.');
    }

    let user = await userRepo().findOne({ where: { email: normalisedEmail } });
    if (!user) {
      user = userRepo().create({
        email: normalisedEmail,
        fullName: 'New Guest',
        role: 'customer',
        isActive: true,
        isVerified: true,
      });
      await userRepo().save(user);
    }

    entry.used = true;
    await otpRepo().save(entry);

    if (!user.isActive) throw new Error('Your account is not active. Please contact support.');
    if (!user.isVerified) {
      user.isVerified = true;
      user = await userRepo().save(user);
    }

    const accessToken = generateAccessToken(user);
    const refreshEntity = await createRefreshToken(user.id);
    return {
      accessToken,
      refreshToken: refreshEntity.token,
      isNewUser: false,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        phone: user.phone,
        isActive: user.isActive,
        dateOfBirth: user.dateOfBirth ?? null,
        marriageDate: user.marriageDate ?? null,
      },
    };
  }

  // -------------------------------------------------------------
  // VERIFY MOBILE PHONE OTP
  // -------------------------------------------------------------
  if (!phoneStr) {
    throw new Error('Phone number or Email address is required for verification.');
  }

  const normalised = phoneStr.replace(/\D/g, '');
  const matchPhone = normalised.length > 10 ? normalised.slice(-10) : normalised;

  const entry = await otpRepo().findOne({
    where: [
      { phone: matchPhone, code: code.trim(), used: false },
      { phone: normalised, code: code.trim(), used: false }
    ],
    order: { createdAt: 'DESC' },
  });

  if (!entry) throw new Error('Invalid OTP code. Please check and try again.');
  if (entry.expiresAt < new Date()) {
    entry.used = true;
    await otpRepo().save(entry);
    throw new Error('OTP code has expired. Please request a new one.');
  }

  let user = await userRepo().findOne({
    where: [
      { phone: matchPhone },
      { phone: normalised },
      { phone: `+${normalised}` }
    ]
  });

  if (!user) {
    user = userRepo().create({
      phone: matchPhone,
      fullName: 'New Guest',
      role: 'customer',
      isActive: true,
      isVerified: true,
    });
    await userRepo().save(user);
  }

  entry.used = true;
  await otpRepo().save(entry);

  if (!user.isActive) throw new Error('Your account is not active. Please contact support.');
  if (!user.isVerified) {
    user.isVerified = true;
    user = await userRepo().save(user);
  }

  const accessToken = generateAccessToken(user);
  const refreshEntity = await createRefreshToken(user.id);
  return {
    accessToken,
    refreshToken: refreshEntity.token,
    isNewUser: false,
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      phone: user.phone,
      isActive: user.isActive,
      dateOfBirth: user.dateOfBirth ?? null,
      marriageDate: user.marriageDate ?? null,
    },
  };
};

