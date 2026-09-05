export type PublicAiScope = 'chat' | 'image';

export const HARD_MAX_PUBLIC_PROMPT_CHARS = 20_000;
const AUTHENTICATED_RPM_MULTIPLIER = 3;
const AUTHENTICATED_DAILY_MULTIPLIER = 5;
const GUEST_IMAGE_RPM_CAP = 6;
const AUTHENTICATED_IMAGE_RPM_CAP = 12;
const GUEST_IMAGE_DAILY_CAP = 40;
const AUTHENTICATED_IMAGE_DAILY_CAP = 80;

export function resolveConfiguredPromptLimit(configuredLimit: number | null | undefined) {
  const parsed = Number(configuredLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) return HARD_MAX_PUBLIC_PROMPT_CHARS;
  return Math.max(100, Math.min(HARD_MAX_PUBLIC_PROMPT_CHARS, Math.floor(parsed)));
}

export function resolvePublicRateLimits(args: {
  scope: PublicAiScope;
  configuredRpm: number;
  configuredDaily: number;
  authenticated: boolean;
}) {
  const configuredRpm = Math.max(1, Math.floor(Number(args.configuredRpm) || 30));
  const configuredDaily = Math.max(1, Math.floor(Number(args.configuredDaily) || 200));

  if (args.scope === 'image') {
    const rpmCap = args.authenticated ? AUTHENTICATED_IMAGE_RPM_CAP : GUEST_IMAGE_RPM_CAP;
    const dailyCap = args.authenticated ? AUTHENTICATED_IMAGE_DAILY_CAP : GUEST_IMAGE_DAILY_CAP;
    const multipliedRpm = args.authenticated ? configuredRpm * AUTHENTICATED_RPM_MULTIPLIER : configuredRpm;
    const multipliedDaily = args.authenticated ? configuredDaily * AUTHENTICATED_DAILY_MULTIPLIER : configuredDaily;
    return {
      rpm: Math.min(rpmCap, multipliedRpm),
      daily: Math.min(dailyCap, multipliedDaily),
    };
  }

  return {
    rpm: args.authenticated ? configuredRpm * AUTHENTICATED_RPM_MULTIPLIER : configuredRpm,
    daily: args.authenticated ? configuredDaily * AUTHENTICATED_DAILY_MULTIPLIER : configuredDaily,
  };
}

export function resolvePublicConcurrencyLimit(scope: PublicAiScope, authenticated: boolean) {
  if (scope === 'image') return 1;
  return authenticated ? 3 : 2;
}

export function resolvePublicConcurrencyLeaseSeconds(scope: PublicAiScope) {
  return scope === 'image' ? 240 : 150;
}
