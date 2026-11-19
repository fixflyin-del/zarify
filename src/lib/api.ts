import { auth } from './firebase';

export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // Attach Firebase Authentication ID token when a user is signed in
  if (!headers.has('Authorization') && auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      if (idToken) {
        headers.set('Authorization', `Bearer ${idToken}`);
      }
    } catch {
      // Proceed without token if unavailable
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const err = new Error(data?.error || `Request failed (${response.status})`) as Error & {
      status?: number;
      code?: string;
      locked?: boolean;
      lockedUntil?: number | null;
      retryAfterSeconds?: number;
      attemptsRemaining?: number;
    };
    err.status = response.status;
    err.code = data?.code;
    err.locked = data?.locked;
    err.lockedUntil = data?.lockedUntil;
    err.retryAfterSeconds = data?.retryAfterSeconds;
    err.attemptsRemaining = data?.attemptsRemaining;
    throw err;
  }
  return data as T;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}
