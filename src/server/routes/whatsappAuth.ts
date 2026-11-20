import { Router, Request, Response } from 'express';
import crypto from 'crypto';

const router = Router();

const WA_COOKIE_NAME = 'zarifly_wa_session';
const WA_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_OTP_REQUESTS_WINDOW_MS = 15 * 60 * 1000;
const MAX_OTP_REQUESTS = 6;
const MAX_VERIFY_FAILURES = 5;
const VERIFY_LOCKOUT_MS = 15 * 60 * 1000;

const ZARIFLY_OFFICIAL_WHATSAPP = '919619586126';
const EPHEMERAL_WA_SECRET = crypto.randomBytes(32).toString('hex');

interface OtpRecord {
  salt: string;
  hashHex: string;
  expiresAt: number;
  fullName: string;
  failedAttempts: number;
  lockedUntil: number;
}

interface WhatsAppUserPayload {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  phone: string;
  role: 'customer';
  preferredLang: 'en' | 'hi';
  authProvider: 'whatsapp';
  createdAt: string;
  exp: number;
}

const otpStore = new Map<string, OtpRecord>();
const requestRateStore = new Map<string, number[]>();
const knownProfiles = new Map<string, { fullName: string; preferredLang: 'en' | 'hi'; createdAt: string }>();

function getSessionSecret(): string {
  return (
    (process.env.WHATSAPP_SESSION_SECRET || '').trim() ||
    (process.env.ADMIN_PIN_COOKIE_SECRET || '').trim() ||
    EPHEMERAL_WA_SECRET
  );
}

export function normalizeWhatsAppDigits(raw: string): string | null {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0') && /^[6-9]/.test(digits.slice(1))) {
    return `91${digits.slice(1)}`;
  }
  if (digits.length >= 10 && digits.length <= 15) {
    return digits;
  }
  return null;
}

function hashOtp(otp: string, salt: string): string {
  return crypto.scryptSync(otp, salt, 32).toString('hex');
}

function verifyOtpHash(candidate: string, salt: string, expectedHex: string): boolean {
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const derivedBuf = crypto.scryptSync(candidate, salt, expectedBuf.length);
  if (derivedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, derivedBuf);
}

function signSessionToken(payload: WhatsAppUserPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifySessionToken(cookieVal: string | undefined): WhatsAppUserPayload | null {
  if (!cookieVal) return null;
  const parts = cookieVal.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encoded)
    .digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as WhatsAppUserPayload;
    if (!parsed || !parsed.uid || !parsed.exp || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function checkRequestRateLimit(key: string): boolean {
  const now = Date.now();
  const list = (requestRateStore.get(key) || []).filter((ts) => now - ts < MAX_OTP_REQUESTS_WINDOW_MS);
  if (list.length >= MAX_OTP_REQUESTS) {
    requestRateStore.set(key, list);
    return false;
  }
  list.push(now);
  requestRateStore.set(key, list);
  return true;
}

async function trySendWhatsAppCloudApiOtp(digits: string, otp: string): Promise<boolean> {
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const accessToken = (process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  if (!phoneNumberId || !accessToken) return false;

  try {
    const response = await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: digits,
        type: 'text',
        text: {
          body: `Your ZARIFLY Boutique verification code is ${otp}. Valid for 5 minutes. Do not share this code with anyone.`,
        },
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function setSessionCookie(req: Request, res: Response, payload: WhatsAppUserPayload) {
  const token = signSessionToken(payload);
  res.cookie(WA_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: WA_SESSION_TTL_MS,
    path: '/',
  });
}

router.post('/request-otp', async (req: Request, res: Response) => {
  const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone : '';
  const rawName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';
  const mode = req.body?.mode === 'signup' ? 'signup' : 'login';

  const digits = normalizeWhatsAppDigits(rawPhone);
  if (!digits) {
    res.status(400).json({
      error: 'Please enter a valid 10-digit WhatsApp mobile number (e.g. 98XXXXXXXX).',
    });
    return;
  }

  if (mode === 'signup' && rawName.length < 2) {
    res.status(400).json({ error: 'Please enter your full name to sign up with WhatsApp.' });
    return;
  }

  const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
  if (!checkRequestRateLimit(`wa_phone:${digits}`) || !checkRequestRateLimit(`wa_ip:${ip}`)) {
    res.status(429).json({
      error: 'Too many OTP requests. Please wait a few minutes before requesting another code.',
    });
    return;
  }

  const otp = String(crypto.randomInt(100000, 999999));
  const salt = crypto.randomBytes(16).toString('hex');
  const hashHex = hashOtp(otp, salt);

  const existingProfile = knownProfiles.get(digits);
  const resolvedName = rawName || existingProfile?.fullName || '';

  otpStore.set(digits, {
    salt,
    hashHex,
    expiresAt: Date.now() + OTP_TTL_MS,
    fullName: resolvedName.slice(0, 120),
    failedAttempts: 0,
    lockedUntil: 0,
  });

  const sentViaCloudApi = await trySendWhatsAppCloudApiOtp(digits, otp);
  const formattedPhone = `+${digits}`;
  const waText = encodeURIComponent(
    `Assalamu Alaikum ZARIFLY! Please verify my WhatsApp login for ${formattedPhone}. Code: ${otp}`
  );
  const whatsappUrl = `https://wa.me/${ZARIFLY_OFFICIAL_WHATSAPP}?text=${waText}`;

  res.json({
    ok: true,
    phone: formattedPhone,
    expiresInSeconds: Math.floor(OTP_TTL_MS / 1000),
    deliveryMode: sentViaCloudApi ? 'whatsapp_cloud_api' : 'whatsapp_direct',
    whatsappUrl,
    // When Meta WhatsApp Cloud API credentials are not configured yet, return the verification
    // code so customers can verify seamlessly via WhatsApp link or instant entry.
    ...(sentViaCloudApi ? {} : { verificationCode: otp }),
  });
});

router.post('/verify-otp', (req: Request, res: Response) => {
  const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone : '';
  const rawCode = typeof req.body?.code === 'string' ? req.body.code.trim() : '';
  const rawName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim() : '';

  const digits = normalizeWhatsAppDigits(rawPhone);
  if (!digits) {
    res.status(400).json({ error: 'Invalid WhatsApp phone number.' });
    return;
  }

  if (!/^\d{6}$/.test(rawCode)) {
    res.status(400).json({ error: 'Please enter the 6-digit WhatsApp verification code.' });
    return;
  }

  const record = otpStore.get(digits);
  if (!record) {
    res.status(400).json({
      error: 'Verification code expired or not requested. Please request a new code.',
    });
    return;
  }

  const now = Date.now();
  if (record.lockedUntil > now) {
    const mins = Math.ceil((record.lockedUntil - now) / 60000);
    res.status(429).json({
      error: `Too many wrong attempts. Please wait ${mins} minute(s) and request a new code.`,
    });
    return;
  }

  if (now > record.expiresAt) {
    otpStore.delete(digits);
    res.status(400).json({ error: 'Verification code has expired. Please request a new code.' });
    return;
  }

  const valid = verifyOtpHash(rawCode, record.salt, record.hashHex);
  if (!valid) {
    record.failedAttempts += 1;
    if (record.failedAttempts >= MAX_VERIFY_FAILURES) {
      record.lockedUntil = now + VERIFY_LOCKOUT_MS;
    }
    const remaining = Math.max(0, MAX_VERIFY_FAILURES - record.failedAttempts);
    res.status(remaining === 0 ? 429 : 403).json({
      error:
        remaining === 0
          ? 'Too many incorrect attempts. Please try again after 15 minutes.'
          : `Incorrect verification code. ${remaining} attempt(s) remaining.`,
    });
    return;
  }

  otpStore.delete(digits);

  const existingProfile = knownProfiles.get(digits);
  const fullName =
    rawName.slice(0, 120) ||
    record.fullName ||
    existingProfile?.fullName ||
    `ZARIFLY Guest (${digits.slice(-4)})`;
  const createdAt = existingProfile?.createdAt || new Date().toISOString();
  const preferredLang = existingProfile?.preferredLang || 'en';

  knownProfiles.set(digits, { fullName, preferredLang, createdAt });

  const uid = `wa_${digits}`;
  const sessionPayload: WhatsAppUserPayload = {
    id: uid,
    uid,
    email: `wa${digits}@whatsapp.zarifly.in`,
    fullName,
    phone: `+${digits}`,
    role: 'customer',
    preferredLang,
    authProvider: 'whatsapp',
    createdAt,
    exp: Date.now() + WA_SESSION_TTL_MS,
  };

  setSessionCookie(req, res, sessionPayload);

  const { exp: _exp, ...publicUser } = sessionPayload;
  res.json({ ok: true, user: publicUser });
});

router.get('/me', (req: Request, res: Response) => {
  const session = verifySessionToken(req.cookies?.[WA_COOKIE_NAME]);
  if (!session) {
    res.json({ user: null });
    return;
  }
  const { exp: _exp, ...publicUser } = session;
  res.json({ user: publicUser });
});

router.patch('/profile', (req: Request, res: Response) => {
  const session = verifySessionToken(req.cookies?.[WA_COOKIE_NAME]);
  if (!session) {
    res.status(401).json({ error: 'WhatsApp session not active.' });
    return;
  }
  const nextName =
    typeof req.body?.fullName === 'string' && req.body.fullName.trim().length >= 2
      ? req.body.fullName.trim().slice(0, 120)
      : session.fullName;
  const nextLang = req.body?.preferredLang === 'hi' ? 'hi' : 'en';

  const digits = session.uid.replace(/^wa_/, '');
  knownProfiles.set(digits, {
    fullName: nextName,
    preferredLang: nextLang,
    createdAt: session.createdAt,
  });

  const updated: WhatsAppUserPayload = {
    ...session,
    fullName: nextName,
    preferredLang: nextLang,
    exp: Date.now() + WA_SESSION_TTL_MS,
  };

  setSessionCookie(req, res, updated);
  const { exp: _exp, ...publicUser } = updated;
  res.json({ ok: true, user: publicUser });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(WA_COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

export default router;
