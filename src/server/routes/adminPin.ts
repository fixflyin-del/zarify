import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { adminAuth, isVerifiedAdminToken } from '../../lib/firebase-admin.ts';

const router = Router();

// Pre-computed salted scrypt hash (saltHex:hashHex). Plaintext PIN is never stored in code.
const DEFAULT_PIN_HASH =
  'a0d0119d901a1db46886b48c03822fc9:5e364d971b0a98e3fc9b89aa4b1a5d995bfc07719f79e34463ba51d4a14ebe0d3d8d0026bded063240b11e6d9e115c5b931802fb31b3e17f80931d12fe20a3ee';

const PIN_COOKIE_NAME = 'zarifly_admin_pin';
const PIN_SESSION_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

const EPHEMERAL_COOKIE_SECRET = crypto.randomBytes(32).toString('hex');

interface LockoutRecord {
  failedAttempts: number;
  lockedUntil: number;
  lastAttemptAt: number;
}

const lockoutStore = new Map<string, LockoutRecord>();

function getCookieSecret(): string {
  return (process.env.ADMIN_PIN_COOKIE_SECRET || '').trim() || EPHEMERAL_COOKIE_SECRET;
}

function getConfiguredPinHash(): { salt: string; hashHex: string } {
  const raw = (process.env.ADMIN_PIN_HASH || '').trim() || DEFAULT_PIN_HASH;
  const [salt, hashHex] = raw.split(':');
  if (!salt || !hashHex) {
    const [fallbackSalt, fallbackHash] = DEFAULT_PIN_HASH.split(':');
    return { salt: fallbackSalt, hashHex: fallbackHash };
  }
  return { salt, hashHex };
}

function verifyPinHash(candidatePin: string): boolean {
  const { salt, hashHex } = getConfiguredPinHash();
  const expectedBuf = Buffer.from(hashHex, 'hex');
  const derivedBuf = crypto.scryptSync(candidatePin, salt, expectedBuf.length);
  if (derivedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, derivedBuf);
}

function signUnlockCookie(uid: string, expiresAt: number): string {
  const payload = `${uid}.${expiresAt}`;
  const sig = crypto
    .createHmac('sha256', getCookieSecret())
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

function verifyUnlockCookie(cookieValue: string | undefined, expectedUid: string): boolean {
  if (!cookieValue) return false;
  const parts = cookieValue.split('.');
  if (parts.length !== 3) return false;
  const [uid, expStr, sigHex] = parts;
  if (uid !== expectedUid) return false;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expectedSig = crypto
    .createHmac('sha256', getCookieSecret())
    .update(`${uid}.${expStr}`)
    .digest('hex');
  const a = Buffer.from(sigHex, 'hex');
  const b = Buffer.from(expectedSig, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function getClientKeys(req: Request, uid: string): string[] {
  const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace(/^::ffff:/, '');
  return [`uid:${uid}`, `ip:${ip}`];
}

function getLockoutState(keys: string[]): { locked: boolean; lockedUntil: number; attemptsRemaining: number } {
  const now = Date.now();
  let maxLockedUntil = 0;
  let maxFailures = 0;

  for (const key of keys) {
    const rec = lockoutStore.get(key);
    if (!rec) continue;
    if (rec.lockedUntil > now) {
      maxLockedUntil = Math.max(maxLockedUntil, rec.lockedUntil);
    } else if (now - rec.lastAttemptAt > LOCKOUT_DURATION_MS) {
      lockoutStore.delete(key);
      continue;
    }
    maxFailures = Math.max(maxFailures, rec.failedAttempts);
  }

  return {
    locked: maxLockedUntil > now,
    lockedUntil: maxLockedUntil,
    attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - maxFailures),
  };
}

function recordFailedAttempt(keys: string[]): { locked: boolean; lockedUntil: number; attemptsRemaining: number } {
  const now = Date.now();
  let maxLockedUntil = 0;
  let maxFailures = 0;

  for (const key of keys) {
    const existing = lockoutStore.get(key);
    const nextFailures =
      existing && now - existing.lastAttemptAt <= LOCKOUT_DURATION_MS
        ? existing.failedAttempts + 1
        : 1;
    const lockedUntil = nextFailures >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_DURATION_MS : 0;
    lockoutStore.set(key, {
      failedAttempts: nextFailures,
      lockedUntil,
      lastAttemptAt: now,
    });
    maxFailures = Math.max(maxFailures, nextFailures);
    maxLockedUntil = Math.max(maxLockedUntil, lockedUntil);
  }

  return {
    locked: maxLockedUntil > now,
    lockedUntil: maxLockedUntil,
    attemptsRemaining: Math.max(0, MAX_FAILED_ATTEMPTS - maxFailures),
  };
}

function clearFailures(keys: string[]) {
  for (const key of keys) {
    lockoutStore.delete(key);
  }
}

async function requireVerifiedFirebaseAdmin(
  req: Request,
  res: Response
): Promise<{ uid: string; email: string } | null> {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Firebase authentication required.' });
    return null;
  }

  const idToken = authHeader.slice(7).trim();
  if (!idToken) {
    res.status(401).json({ error: 'Missing Firebase ID token.' });
    return null;
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!isVerifiedAdminToken(decoded)) {
      res.status(403).json({
        error: 'Access denied. Your account does not have ZARIFLY Admin privileges.',
        code: 'NOT_ADMIN',
      });
      return null;
    }
    return { uid: decoded.uid, email: decoded.email || '' };
  } catch (err: any) {
    res.status(401).json({
      error: 'Invalid or expired Firebase authentication session. Please sign in again.',
      code: err?.code || 'INVALID_TOKEN',
    });
    return null;
  }
}

router.get('/status', async (req, res) => {
  const adminUser = await requireVerifiedFirebaseAdmin(req, res);
  if (!adminUser) return;

  const keys = getClientKeys(req, adminUser.uid);
  const lockState = getLockoutState(keys);
  const pinUnlocked = verifyUnlockCookie(req.cookies?.[PIN_COOKIE_NAME], adminUser.uid);

  res.json({
    isAdmin: true,
    adminEmail: adminUser.email,
    pinUnlocked,
    locked: lockState.locked,
    lockedUntil: lockState.lockedUntil || null,
    retryAfterSeconds: lockState.locked
      ? Math.max(1, Math.ceil((lockState.lockedUntil - Date.now()) / 1000))
      : 0,
    attemptsRemaining: lockState.attemptsRemaining,
  });
});

router.post('/verify-pin', async (req, res) => {
  const adminUser = await requireVerifiedFirebaseAdmin(req, res);
  if (!adminUser) return;

  const keys = getClientKeys(req, adminUser.uid);
  const currentLock = getLockoutState(keys);
  if (currentLock.locked) {
    const retryAfterSeconds = Math.max(1, Math.ceil((currentLock.lockedUntil - Date.now()) / 1000));
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.status(429).json({
      error: `Too many incorrect PIN attempts. Locked for ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
      code: 'PIN_LOCKED',
      locked: true,
      lockedUntil: currentLock.lockedUntil,
      retryAfterSeconds,
      attemptsRemaining: 0,
    });
    return;
  }

  const rawPin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
  if (!/^\d{4}$/.test(rawPin)) {
    res.status(400).json({
      error: 'Please enter a valid 4-digit numeric PIN.',
      attemptsRemaining: currentLock.attemptsRemaining,
    });
    return;
  }

  const valid = verifyPinHash(rawPin);
  if (!valid) {
    const nextLock = recordFailedAttempt(keys);
    const retryAfterSeconds = nextLock.locked
      ? Math.max(1, Math.ceil((nextLock.lockedUntil - Date.now()) / 1000))
      : 0;
    if (nextLock.locked) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
    }
    res.status(nextLock.locked ? 429 : 403).json({
      error: nextLock.locked
        ? 'Maximum incorrect PIN attempts reached. Admin PIN entry is temporarily locked for 15 minutes.'
        : `Incorrect Admin Entry PIN. ${nextLock.attemptsRemaining} attempt(s) remaining.`,
      code: nextLock.locked ? 'PIN_LOCKED' : 'INVALID_PIN',
      locked: nextLock.locked,
      lockedUntil: nextLock.lockedUntil || null,
      retryAfterSeconds,
      attemptsRemaining: nextLock.attemptsRemaining,
    });
    return;
  }

  clearFailures(keys);
  const expiresAt = Date.now() + PIN_SESSION_TTL_MS;
  const signedCookie = signUnlockCookie(adminUser.uid, expiresAt);

  res.cookie(PIN_COOKIE_NAME, signedCookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    maxAge: PIN_SESSION_TTL_MS,
    path: '/',
  });

  res.json({
    unlocked: true,
    adminEmail: adminUser.email,
    expiresAt,
  });
});

router.post('/lock', (_req, res) => {
  res.clearCookie(PIN_COOKIE_NAME, { path: '/' });
  res.json({ locked: true });
});

export default router;
