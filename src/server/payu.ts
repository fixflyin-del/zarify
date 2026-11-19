import crypto from 'crypto';

export interface PayUConfig {
  env: 'sandbox' | 'production';
  key: string;
  salt: string;
  configured: boolean;
  actionUrl: string;
  verifyUrl: string;
}

export function getPayUConfig(): PayUConfig {
  const env = process.env.PAYU_ENV === 'production' ? 'production' : 'sandbox';
  const key = (process.env.PAYU_MERCHANT_KEY || '').trim();
  const salt = (process.env.PAYU_MERCHANT_SALT || '').trim();
  const configured = Boolean(key && salt);

  const actionUrl =
    env === 'production'
      ? 'https://secure.payu.in/_payment'
      : 'https://test.payu.in/_payment';

  const verifyUrl =
    env === 'production'
      ? 'https://info.payu.in/merchant/postservice?form=2'
      : 'https://test.payu.in/merchant/postservice?form=2';

  return { env, key, salt, configured, actionUrl, verifyUrl };
}

/**
 * Official PayU India SHA-512 Request Hash:
 * sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT)
 */
export function generatePayURequestHash(params: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  salt: string;
}): string {
  const hashString = [
    params.key,
    params.txnid,
    params.amount,
    params.productinfo,
    params.firstname,
    params.email,
    params.udf1 || '',
    params.udf2 || '',
    params.udf3 || '',
    params.udf4 || '',
    params.udf5 || '',
    '',
    '',
    '',
    '',
    '',
    params.salt,
  ].join('|');

  return crypto.createHash('sha512').update(hashString).digest('hex');
}

/**
 * Official PayU India Reverse Response Hash Verification:
 * sha512(SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
 * (with optional additional_charges prefix if PayU sends additionalCharges)
 */
export function verifyPayUResponseHash(
  payload: Record<string, string>,
  salt: string
): boolean {
  const receivedHash = (payload.hash || '').toLowerCase();
  if (!receivedHash || !salt) return false;

  const baseParts = [
    salt,
    payload.status || '',
    '',
    '',
    '',
    '',
    '',
    payload.udf5 || '',
    payload.udf4 || '',
    payload.udf3 || '',
    payload.udf2 || '',
    payload.udf1 || '',
    payload.email || '',
    payload.firstname || '',
    payload.productinfo || '',
    payload.amount || '',
    payload.txnid || '',
    payload.key || '',
  ];

  const hashString = payload.additionalCharges
    ? `${payload.additionalCharges}|${baseParts.join('|')}`
    : baseParts.join('|');

  const computedHash = crypto.createHash('sha512').update(hashString).digest('hex').toLowerCase();
  try {
    return crypto.timingSafeEqual(Buffer.from(receivedHash), Buffer.from(computedHash));
  } catch {
    return false;
  }
}

/**
 * Official PayU India Server-to-Server verify_payment API call
 */
export async function verifyPayUTransactionServerSide(txnid: string): Promise<{
  verified: boolean;
  status: string;
  mihpayid?: string;
  raw?: unknown;
}> {
  const cfg = getPayUConfig();
  if (!cfg.configured) {
    return { verified: false, status: 'unconfigured' };
  }

  const command = 'verify_payment';
  const hash = crypto
    .createHash('sha512')
    .update(`${cfg.key}|${command}|${txnid}|${cfg.salt}`)
    .digest('hex');

  const body = new URLSearchParams({
    key: cfg.key,
    command,
    var1: txnid,
    hash,
  });

  const response = await fetch(cfg.verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await response.json()) as any;
  const txnDetail = data?.transaction_details?.[txnid];
  const isSuccess = txnDetail?.status === 'success';
  return {
    verified: isSuccess,
    status: txnDetail?.status || 'unknown',
    mihpayid: txnDetail?.mihpayid || '',
    raw: data,
  };
}

/**
 * Official PayU India Refund API (cancel_refund_transaction)
 */
export async function initiatePayURefund(params: {
  mihpayid: string;
  tokenId: string;
  amount: string;
}): Promise<{ ok: boolean; message: string; raw?: unknown }> {
  const cfg = getPayUConfig();
  if (!cfg.configured) {
    return {
      ok: false,
      message: 'PayU credentials are not configured. Set PAYU_MERCHANT_KEY and PAYU_MERCHANT_SALT.',
    };
  }

  const command = 'cancel_refund_transaction';
  const hash = crypto
    .createHash('sha512')
    .update(`${cfg.key}|${command}|${params.mihpayid}|${cfg.salt}`)
    .digest('hex');

  const body = new URLSearchParams({
    key: cfg.key,
    command,
    var1: params.mihpayid,
    var2: params.tokenId,
    var3: params.amount,
    hash,
  });

  const response = await fetch(cfg.verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await response.json()) as any;
  return {
    ok: data?.status === 1,
    message: data?.msg || (data?.status === 1 ? 'Refund initiated with PayU' : 'Refund request failed'),
    raw: data,
  };
}
