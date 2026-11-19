const CART_SESSION_KEY = 'zarifly_cart_session';

let inMemoryAuthToken: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryAuthToken = token;
}

export function getCartSessionId(): string {
  if (typeof window === 'undefined') return '';
  let sid = window.localStorage.getItem(CART_SESSION_KEY);
  if (!sid) {
    sid = `zrf-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(CART_SESSION_KEY, sid);
  }
  return sid;
}

export async function apiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  const sid = getCartSessionId();
  if (sid) {
    headers.set('x-cart-session', sid);
  }
  if (inMemoryAuthToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${inMemoryAuthToken}`);
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
    };
    err.status = response.status;
    err.code = data?.code;
    throw err;
  }
  return data as T;
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}
