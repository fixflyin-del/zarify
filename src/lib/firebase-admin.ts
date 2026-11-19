import fs from 'fs';
import path from 'path';
import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const firebaseConfigPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8')) as {
  projectId: string;
};

const adminApp = getApps().length
  ? getApp()
  : initializeApp({
      projectId: firebaseConfig.projectId,
    });

export const adminAuth = getAuth(adminApp);

export const AUTHORIZED_ADMIN_EMAILS = new Set([
  'fixfly.in@gmail.com',
  'admin@zarifly.com',
  'info@zarifly.com',
]);

export function isVerifiedAdminToken(decoded: {
  email?: string;
  email_verified?: boolean;
  admin?: unknown;
  role?: unknown;
}): boolean {
  if (decoded.admin === true || decoded.role === 'admin' || decoded.role === 'super_admin') {
    return true;
  }
  const email = (decoded.email || '').trim().toLowerCase();
  return Boolean(email && decoded.email_verified && AUTHORIZED_ADMIN_EMAILS.has(email));
}
