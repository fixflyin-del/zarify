import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db, isDatabaseConfigured } from '../db/index.ts';
import { users } from '../db/schema.ts';

export const JWT_SECRET =
  process.env.JWT_SECRET || 'zarifly_dev_session_secret_change_in_production';

export const ADMIN_EMAILS = new Set(
  [
    'admin@zarifly.com',
    'info@zarifly.com',
    'fixfly.in@gmail.com',
    process.env.ADMIN_BOOTSTRAP_EMAIL || '',
  ]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
);

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  preferredLang: string;
}

export interface AuthRequest extends Request {
  dbUser?: DbUser;
}

interface SessionJwtPayload {
  id: number;
  uid: string;
  email: string;
  role: string;
  fullName?: string;
}

export function signSessionToken(user: {
  id: number;
  uid: string;
  email: string;
  role: string;
  fullName?: string;
}) {
  return jwt.sign(
    {
      id: user.id,
      uid: user.uid,
      email: user.email,
      role: user.role,
      fullName: user.fullName || user.email.split('@')[0],
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function userFromJwtPayload(payload: SessionJwtPayload): DbUser {
  return {
    id: payload.id,
    uid: payload.uid || `fallback-${payload.id}`,
    email: payload.email,
    fullName: payload.fullName || payload.email?.split('@')[0] || 'ZARIFLY Admin',
    phone: '',
    role: payload.role || (ADMIN_EMAILS.has((payload.email || '').toLowerCase()) ? 'super_admin' : 'customer'),
    preferredLang: 'en',
  };
}

export async function getOrCreateFirebaseUser(
  uid: string,
  email: string,
  fullName?: string
): Promise<DbUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const defaultRole = ADMIN_EMAILS.has(normalizedEmail) ? 'super_admin' : 'customer';

  if (!isDatabaseConfigured()) {
    return {
      id: defaultRole === 'super_admin' ? 999001 : 999100,
      uid,
      email: normalizedEmail,
      fullName: fullName || normalizedEmail.split('@')[0],
      phone: '',
      role: defaultRole,
      preferredLang: 'en',
    };
  }

  try {
    const existingByEmail = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existingByEmail.length > 0) {
      const existing = existingByEmail[0];
      const nextRole =
        ADMIN_EMAILS.has(normalizedEmail) && existing.role === 'customer'
          ? 'super_admin'
          : existing.role;
      const updated = await db
        .update(users)
        .set({
          uid,
          fullName: existing.fullName || fullName || normalizedEmail.split('@')[0],
          role: nextRole,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id))
        .returning();
      return updated[0];
    }

    const result = await db
      .insert(users)
      .values({
        uid,
        email: normalizedEmail,
        fullName: fullName || normalizedEmail.split('@')[0],
        role: defaultRole,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: normalizedEmail,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error('Database user upsert failed (using session fallback):', error);
    return {
      id: defaultRole === 'super_admin' ? 999001 : 999100,
      uid,
      email: normalizedEmail,
      fullName: fullName || normalizedEmail.split('@')[0],
      phone: '',
      role: defaultRole,
      preferredLang: 'en',
    };
  }
}

async function resolveFromSessionJwt(token: string): Promise<DbUser | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as SessionJwtPayload;
    if (!isDatabaseConfigured()) {
      return userFromJwtPayload(payload);
    }
    try {
      const found = await db.select().from(users).where(eq(users.id, payload.id)).limit(1);
      if (found.length > 0) return found[0];
      if (payload.email && ADMIN_EMAILS.has(payload.email.toLowerCase())) {
        return userFromJwtPayload(payload);
      }
      return null;
    } catch {
      return userFromJwtPayload(payload);
    }
  } catch {
    return null;
  }
}

async function resolveUserFromRequest(req: AuthRequest): Promise<DbUser | null> {
  // 1. Check Bearer token (Firebase ID token or JWT)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    // Try local JWT first (fast, works offline/Vercel without Firebase Admin creds)
    const jwtUser = await resolveFromSessionJwt(token);
    if (jwtUser) return jwtUser;

    // Try Firebase ID token
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      if (decoded.email) {
        return await getOrCreateFirebaseUser(decoded.uid, decoded.email, decoded.name);
      }
    } catch {
      return null;
    }
  }

  // 2. Check httpOnly session cookie
  const cookieToken = req.cookies?.zarifly_session;
  if (cookieToken) {
    return await resolveFromSessionJwt(cookieToken);
  }

  return null;
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (user) {
      req.dbUser = user;
    }
  } catch (err) {
    console.error('Optional auth lookup failed:', err);
  }
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    req.dbUser = user;
    next();
  } catch (err) {
    console.error('Auth verification error:', err);
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await resolveUserFromRequest(req);
    if (!user) {
      return res.status(401).json({ error: 'Admin authentication required.' });
    }
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Forbidden: Admin privileges required.' });
    }
    req.dbUser = user;
    next();
  } catch (err) {
    console.error('Admin auth error:', err);
    return res.status(401).json({ error: 'Invalid admin session.' });
  }
};
