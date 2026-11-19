import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.ts';
import { addresses, users, wishlists } from '../../db/schema.ts';
import { ensureSeeded } from '../../db/seed.ts';
import { adminAuth } from '../../lib/firebase-admin.ts';
import {
  ADMIN_EMAILS,
  AuthRequest,
  getOrCreateFirebaseUser,
  requireAuth,
  signSessionToken,
} from '../../middleware/auth.ts';

const router = Router();

function setSessionCookie(res: any, token: string) {
  res.cookie('zarifly_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function sanitizeUser(u: typeof users.$inferSelect | { id: number; uid: string; email: string; fullName: string; phone: string | null; role: string; preferredLang: string }) {
  return {
    id: u.id,
    uid: u.uid,
    email: u.email,
    fullName: u.fullName,
    phone: u.phone || '',
    role: u.role,
    preferredLang: u.preferredLang,
  };
}

router.post('/register', async (req, res) => {
  await ensureSeeded();
  const schema = z.object({
    fullName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
    phone: z.string().optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please provide a valid name, email, and password (min 6 chars).' });
  }

  const email = parsed.data.email.trim().toLowerCase();
  try {
    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const role = ADMIN_EMAILS.has(email) ? 'super_admin' : 'customer';

    const [created] = await db
      .insert(users)
      .values({
        uid: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        email,
        passwordHash,
        fullName: parsed.data.fullName.trim(),
        phone: parsed.data.phone.trim(),
        role,
      })
      .returning();

    const token = signSessionToken(created);
    setSessionCookie(res, token);
    res.status(201).json({ user: sanitizeUser(created), token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  await ensureSeeded();
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Valid email and password are required.' });
  }

  const email = parsed.data.email.trim().toLowerCase();
  try {
    const found = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (found.length === 0 || !found[0].passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const valid = await bcrypt.compare(parsed.data.password, found[0].passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signSessionToken(found[0]);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(found[0]), token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed.' });
  }
});

router.post('/firebase', async (req, res) => {
  await ensureSeeded();
  const idToken = req.body?.idToken;
  if (!idToken || typeof idToken !== 'string') {
    return res.status(400).json({ error: 'Missing Firebase ID token.' });
  }
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    if (!decoded.email) {
      return res.status(400).json({ error: 'Google account must provide an email address.' });
    }
    const dbUser = await getOrCreateFirebaseUser(decoded.uid, decoded.email, decoded.name);
    const token = signSessionToken(dbUser);
    setSessionCookie(res, token);
    res.json({ user: sanitizeUser(dbUser), token });
  } catch (error) {
    console.error('Firebase auth sync error:', error);
    res.status(401).json({ error: 'Google Sign-In verification failed.' });
  }
});

router.post('/logout', (_req, res) => {
  res.clearCookie('zarifly_session');
  res.json({ ok: true });
});

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const [savedAddresses, wishlistRows] = await Promise.all([
      db.select().from(addresses).where(eq(addresses.userId, userId)).orderBy(desc(addresses.isDefault)),
      db.select({ productId: wishlists.productId }).from(wishlists).where(eq(wishlists.userId, userId)),
    ]);
    res.json({
      user: sanitizeUser(req.dbUser!),
      addresses: savedAddresses,
      wishlistIds: wishlistRows.map((w) => w.productId),
    });
  } catch (error) {
    console.error('Auth me error:', error);
    res.status(500).json({ error: 'Failed to load profile.' });
  }
});

router.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    fullName: z.string().min(2).optional(),
    phone: z.string().optional(),
    preferredLang: z.enum(['en', 'hi']).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid profile update.' });
  }
  try {
    const [updated] = await db
      .update(users)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(users.id, req.dbUser!.id))
      .returning();
    res.json({ user: sanitizeUser(updated) });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Unable to update profile.' });
  }
});

router.post('/addresses', requireAuth, async (req: AuthRequest, res) => {
  const schema = z.object({
    fullName: z.string().min(2),
    mobile: z.string().min(8),
    email: z.string().email(),
    houseFlat: z.string().min(1),
    streetArea: z.string().min(2),
    city: z.string().min(2),
    district: z.string().optional().default(''),
    state: z.string().min(2),
    pincode: z.string().regex(/^\d{6}$/),
    landmark: z.string().optional().default(''),
    latitude: z.string().optional().default(''),
    longitude: z.string().optional().default(''),
    isDefault: z.boolean().optional().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Please complete all required address fields.' });
  }
  try {
    if (parsed.data.isDefault) {
      await db.update(addresses).set({ isDefault: false }).where(eq(addresses.userId, req.dbUser!.id));
    }
    const [saved] = await db
      .insert(addresses)
      .values({ ...parsed.data, userId: req.dbUser!.id })
      .returning();
    res.status(201).json({ address: saved });
  } catch (error) {
    console.error('Address create error:', error);
    res.status(500).json({ error: 'Unable to save address.' });
  }
});

router.delete('/addresses/:id', requireAuth, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid address ID.' });
  try {
    await db
      .delete(addresses)
      .where(and(eq(addresses.id, id), eq(addresses.userId, req.dbUser!.id)));
    res.json({ ok: true });
  } catch (error) {
    console.error('Address delete error:', error);
    res.status(500).json({ error: 'Unable to delete address.' });
  }
});

export default router;
