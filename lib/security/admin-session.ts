export const ADMIN_SESSION_COOKIE = 'abhiai_admin_session';

export const DEFAULT_ADMIN_EMAIL = 'abhishekbhardwaj7763@gmail.com';
export const DEFAULT_ADMIN_PASSWORD = 'admin123';

const ALLOWED_ADMIN_EMAILS = new Set([
  'abhishekbhardwaj7763@gmail.com',
  'abhigt6t@gmail.com',
  'admin@abhiai.com',
]);

export function isOwnerAdminEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const configured = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (configured && normalized === configured) return true;
  return ALLOWED_ADMIN_EMAILS.has(normalized);
}

export function verifyMasterAdminCredentials(email: string, password: string): boolean {
  const normalizedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();
  if (!isOwnerAdminEmail(normalizedEmail)) return false;

  const configuredPassword = process.env.ADMIN_PASSWORD?.trim();
  if (configuredPassword) {
    return trimmedPassword === configuredPassword;
  }

  return (
    trimmedPassword === DEFAULT_ADMIN_PASSWORD ||
    trimmedPassword === 'AbhiAI@2026' ||
    trimmedPassword === 'admin@123'
  );
}

function computeSignature(payload: string): string {
  const secret =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.AI_KEYS_ENCRYPTION_KEY ||
    process.env.GEMINI_API_KEY ||
    'abhiai-master-admin-session-key-2026';
  const input = `${payload}:${secret}`;
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export function createAdminSessionCookieValue(email: string, id = 'local-admin-owner'): string {
  const normalizedEmail = email.trim().toLowerCase();
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const payload = encodeURIComponent(JSON.stringify({ id, email: normalizedEmail, exp }));
  const sig = computeSignature(payload);
  return `${payload}.${sig}`;
}

export function verifyAdminSessionCookieValue(
  cookieValue: string | undefined | null,
): { id: string; email: string } | null {
  if (!cookieValue) return null;
  const dotIndex = cookieValue.lastIndexOf('.');
  if (dotIndex <= 0) return null;

  const payload = cookieValue.slice(0, dotIndex);
  const sig = cookieValue.slice(dotIndex + 1);
  if (computeSignature(payload) !== sig) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(payload)) as {
      id?: string;
      email?: string;
      exp?: number;
    };
    if (!parsed.id || !parsed.email || !parsed.exp) return null;
    if (Date.now() > parsed.exp) return null;
    return { id: parsed.id, email: parsed.email };
  } catch {
    return null;
  }
}
