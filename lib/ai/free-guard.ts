export type BillingClassification = 'FREE_VERIFIED' | 'FREE_LIMITED' | 'UNKNOWN' | 'PAID' | 'DISABLED';

export interface FreeGuardRule {
  providerId: string;
  modelPattern: string; // regex pattern or substring
  classification: BillingClassification;
  notes: string;
}

// Known free/free-tier models across popular providers (NVIDIA NIM, Groq, OpenRouter :free, Gemini Free tier)
export const KNOWN_FREE_MODELS: FreeGuardRule[] = [
  // OpenRouter Free Models
  {
    providerId: 'openrouter',
    modelPattern: ':free$',
    classification: 'FREE_VERIFIED',
    notes: 'Official OpenRouter free tier model'
  },
  // NVIDIA NIM Free Cloud Developer Credits/Endpoints
  {
    providerId: 'nvidia',
    modelPattern: '^(meta/llama|mistralai/|deepseek-ai/|google/gemma|qwen/)',
    classification: 'FREE_LIMITED',
    notes: 'NVIDIA API Catalog 1000 free developer calls'
  },
  // Groq Cloud Free Tier
  {
    providerId: 'groq',
    modelPattern: '^(llama-3|llama3|mixtral|gemma|deepseek|whisper)',
    classification: 'FREE_LIMITED',
    notes: 'Groq Cloud free tier with rate limits'
  },
  // Google Gemini Free Tier
  {
    providerId: 'google',
    modelPattern: 'gemini-.*(flash|pro)',
    classification: 'FREE_LIMITED',
    notes: 'Google AI Studio standard free tier (15 RPM)'
  },
  // Together AI free preview models
  {
    providerId: 'together',
    modelPattern: 'free|preview',
    classification: 'FREE_LIMITED',
    notes: 'Together AI free promotional/starter model'
  }
];

/**
 * Classifies any model based on provider, model ID, and free patterns
 */
export function classifyModelBilling(providerId: string, modelId: string): BillingClassification {
  const normalizedModel = modelId.toLowerCase();
  const normalizedProvider = providerId.toLowerCase();

  // 1. Check if model name explicitly contains 'free' (e.g. openrouter/auto:free or llama-3-8b:free)
  if (normalizedModel.includes(':free') || normalizedModel.includes('-free') || normalizedModel.includes('_free')) {
    return 'FREE_VERIFIED';
  }

  // 2. Check rule table
  for (const rule of KNOWN_FREE_MODELS) {
    if (rule.providerId === normalizedProvider || rule.providerId === 'all') {
      const reg = new RegExp(rule.modelPattern, 'i');
      if (reg.test(modelId)) {
        return rule.classification;
      }
    }
  }

  // Default to UNKNOWN to prevent accidental billing when Free-Only Mode is active
  return 'UNKNOWN';
}

/**
 * Free Guard Checker: Verifies if a model is allowed to run under current settings
 */
export function isModelAllowedUnderFreeGuard(
  providerId: string,
  modelId: string,
  freeOnlyModeEnabled: boolean = true
): { allowed: boolean; classification: BillingClassification; reason?: string } {
  const classification = classifyModelBilling(providerId, modelId);

  if (!freeOnlyModeEnabled) {
    return { allowed: true, classification };
  }

  if (classification === 'FREE_VERIFIED' || classification === 'FREE_LIMITED') {
    return { allowed: true, classification };
  }

  if (classification === 'PAID') {
    return {
      allowed: false,
      classification,
      reason: 'Free-Only Safety Guard: This model is classified as PAID. Request blocked to prevent billing.'
    };
  }

  // UNKNOWN requires explicit admin approval if in free-only mode
  return {
    allowed: false,
    classification,
    reason: 'Free-Only Safety Guard: This model pricing is UNKNOWN. Enable or verify in Admin Settings.'
  };
}
