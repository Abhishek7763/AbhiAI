import 'server-only';

import { createHmac } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getStoredSettings } from '@/lib/data/admin-config';
import { logger } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { extractClientIp, isTrustedRequestSource, parseAllowedOrigins } from '@/lib/security/request-origin';

type PublicApiScope = 'chat' | 'image';

type GuardSuccess = {
  ok: true;
  settings: Awaited<ReturnType<typeof getStoredSettings>>;
};

type GuardFailure = {
  ok: false;
  response: NextResponse;
};

export type PublicApiGuardResult = GuardSuccess | GuardFailure;

type RateLimitRow = {
  allowed: boolean;
  minute_count: number;
  daily_count: number;
  minute_limit: number;
  daily_limit: number;
  retry_after_seconds: number;
};

type TurnstileResult = {
  success?: boolean;
  hostname?: string;
  action?: string;
  'error-codes'?: string[];
};

function configuredAllowedOrigins(requestUrl: string) {
  const origins = parseAllowedOrigins(process.env.PUBLIC_API_ALLOWED_ORIGINS);
  const vercelUrls = [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.startsWith('http://') || value.startsWith('https://') ? value : `https://${value}`);

  origins.push(...vercelUrls);
  origins.push(new URL(requestUrl).origin);
  return origins;
}

function rateLimitIdentifier(req: Request, scope: PublicApiScope) {
  const secret =
    process.env.RATE_LIMIT_HASH_SALT ||
    process.env.AI_KEYS_ENCRYPTION_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) return null;

  const ip = extractClientIp(req.headers);
  const fallbackIdentity = `${ip}|${(req.headers.get('user-agent') || 'unknown').slice(0, 160)}`;
  const identity = ip === 'unknown' ? fallbackIdentity : ip;
  const digest = createHmac('sha256', secret).update(identity).digest('hex');
  return `${scope}:${digest}`;
}

async function checkRateLimit(
  req: Request,
  scope: PublicApiScope,
  rpm: number,
  daily: number,
): Promise<NextResponse | null> {
  const identifier = rateLimitIdentifier(req, scope);
  if (!identifier) {
    logger.error('Rate limiting is unavailable because no server-side hashing secret is configured.');
    return NextResponse.json(
      { error: 'AbhiAI security configuration is incomplete.' },
      { status: 503 },
    );
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('check_public_rate_limit', {
      p_identifier: identifier,
      p_rpm: Math.max(1, Math.floor(rpm || 30)),
      p_daily: Math.max(1, Math.floor(daily || 200)),
    });

    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as RateLimitRow | null;
    if (!row) throw new Error('Rate limiter returned no decision.');

    if (!row.allowed) {
      const retryAfter = Math.max(1, Number(row.retry_after_seconds) || 1);
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment and try again.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit-Minute': String(row.minute_limit),
            'X-RateLimit-Limit-Day': String(row.daily_limit),
          },
        },
      );
    }

    return null;
  } catch (error) {
    logger.error('Public API rate limiter failed.', error);
    return NextResponse.json(
      { error: 'AbhiAI security checks are temporarily unavailable. Please try again shortly.' },
      { status: 503 },
    );
  }
}

function turnstileHostnames(req: Request) {
  const hostnames = new Set<string>([new URL(req.url).hostname.toLowerCase()]);
  for (const value of (process.env.TURNSTILE_ALLOWED_HOSTNAMES || '').split(',')) {
    const hostname = value.trim().toLowerCase();
    if (hostname) hostnames.add(hostname);
  }
  return hostnames;
}

async function verifyTurnstile(req: Request): Promise<NextResponse | null> {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();

  if (!siteKey && !secret) return null;

  if (!siteKey || !secret) {
    logger.error('Cloudflare Turnstile is partially configured. Both site key and secret are required.');
    return NextResponse.json(
      { error: 'AbhiAI bot protection configuration is incomplete.' },
      { status: 503 },
    );
  }

  const token = req.headers.get('x-turnstile-token')?.trim();
  if (!token) {
    return NextResponse.json(
      { error: 'Security verification is required. Refresh the page and try again.' },
      { status: 403 },
    );
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
        remoteip: extractClientIp(req.headers),
      }),
      signal: AbortSignal.timeout(7_000),
      cache: 'no-store',
    });

    if (!response.ok) {
      logger.warn(`Turnstile Siteverify returned HTTP ${response.status}.`);
      return NextResponse.json(
        { error: 'Security verification is temporarily unavailable. Please try again.' },
        { status: 503 },
      );
    }

    const result = await response.json() as TurnstileResult;
    const hostnameAllowed = !result.hostname || turnstileHostnames(req).has(result.hostname.toLowerCase());
    const actionAllowed = result.action === 'public-ai';

    if (!result.success || !hostnameAllowed || !actionAllowed) {
      logger.warn('Turnstile rejected a public AI request.', {
        hostname: result.hostname,
        action: result.action,
        errorCodes: result['error-codes'],
      });
      return NextResponse.json(
        { error: 'Security verification failed. Please refresh and try again.' },
        { status: 403 },
      );
    }

    return null;
  } catch (error) {
    logger.warn('Turnstile Siteverify request failed.', error);
    return NextResponse.json(
      { error: 'Security verification is temporarily unavailable. Please try again.' },
      { status: 503 },
    );
  }
}

export async function protectPublicAiRequest(req: Request, scope: PublicApiScope): Promise<PublicApiGuardResult> {
  const trustedSource = isTrustedRequestSource({
    requestUrl: req.url,
    origin: req.headers.get('origin'),
    referer: req.headers.get('referer'),
    secFetchSite: req.headers.get('sec-fetch-site'),
    allowedOrigins: configuredAllowedOrigins(req.url),
  });

  if (!trustedSource) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Cross-site requests are not allowed for this endpoint.' },
        { status: 403 },
      ),
    };
  }

  let settings: Awaited<ReturnType<typeof getStoredSettings>>;
  try {
    settings = await getStoredSettings();
  } catch (error) {
    logger.error('Could not load public AI security limits.', error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'AbhiAI security settings are temporarily unavailable.' },
        { status: 503 },
      ),
    };
  }

  const rateLimitFailure = await checkRateLimit(
    req,
    scope,
    settings.rateLimitRPM,
    settings.maxDailyRequestsPerIP,
  );
  if (rateLimitFailure) return { ok: false, response: rateLimitFailure };

  const turnstileFailure = await verifyTurnstile(req);
  if (turnstileFailure) return { ok: false, response: turnstileFailure };

  return { ok: true, settings };
}
