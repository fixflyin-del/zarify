import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
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

export function signSessionToken(user: { id: number; uid: string; email: string; role: string }) {
  return jwt.sign(
    { id: user.id, uid: user.uid, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function getOrCreateFirebaseUser(
  uid: string,
  email: string,
  fullName?: string
): Promise<DbUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const defaultRole = ADMIN_EMAILS.has(normalizedEmail) ? 'super_admin' : 'customer';

  try {
    // Check if an account already exists by email
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
    console.error('Database user upsert failed:', error);
    throw new Error('Failed to synchronize user account.', { cause: error });
  }
}

async function resolveUserFromRequest(req: AuthRequest): Promise<DbUser | null> {
  // 1. Check Bearer token (Firebase ID token or JWT)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    // Try Firebase ID token first
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      if (decoded.email) {
        return await getOrCreateFirebaseUser(decoded.uid, decoded.email, decoded.name);
      }
    } catch {
      // Fallback to local JWT
      try {
        const payload = jwt.verify(token, JWT_SECRET) as { id: number };
        const found = await db.select().from(users).where(eq(users.id, payload.id)).limit(1);
        if (found.length > 0) return found[0];
      } catch {
        return null;
      }
    }
  }

  // 2. Check httpOnly session cookie
  const cookieToken = req.cookies?.zarifly_session;
  if (cookieToken) {
    try {
      const payload = jwt.verify(cookieToken, JWT_SECRET) as { id: number };
      const found = await db.select().from(users).where(eq(users.id, payload.id)).limit(1);
      if (found.length > 0) return found[0];
    } catch {
      return null;
    }
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
