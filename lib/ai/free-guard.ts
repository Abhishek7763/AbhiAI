export type BillingClassification = 'FREE_VERIFIED' | 'FREE_LIMITED' | 'UNKNOWN' | 'PAID' | 'DISABLED';

export interface FreeGuardRule {
  providerId: string;
  modelPattern: string;
  classification: BillingClassification;
  notes: string;
}

export const KNOWN_FREE_MODELS: FreeGuardRule[] = [
  {
    providerId: 'openrouter',
    modelPattern: ':free$',
    classification: 'FREE_VERIFIED',
    notes: 'Official OpenRouter free-tagged model',
  },
  {
    providerId: 'nvidia',
    modelPattern: '^(meta/llama|mistralai/|deepseek-ai/|google/gemma|qwen/)',
    classification: 'FREE_LIMITED',
    notes: 'NVIDIA developer access can be limited by credits and quota',
  },
  {
    providerId: 'groq',
    modelPattern: '^(llama-3|llama3|mixtral|gemma|deepseek|whisper)',
    classification: 'FREE_LIMITED',
    notes: 'Groq free access is subject to account rate limits',
  },
  {
    providerId: 'google',
    modelPattern: '^gemini-(3\\.7-flash|3\\.6-flash|3\\.5-flash(?:-lite)?|3\\.1-flash-lite)$',
    classification: 'FREE_LIMITED',
    notes: 'Verified against the Google Gemini Developer API free-tier pricing published in September 2026',
  },
  {
    providerId: 'together',
    modelPattern: 'free|preview',
    classification: 'FREE_LIMITED',
    notes: 'Together availability and free promotional access can change',
  },
];

export function classifyModelBilling(providerId: string, modelId: string): BillingClassification {
  const normalizedModel = modelId.toLowerCase();
  const normalizedProvider = providerId.toLowerCase();

  if (normalizedModel.includes(':free') || normalizedModel.includes('-free') || normalizedModel.includes('_free')) {
    return 'FREE_VERIFIED';
  }

  for (const rule of KNOWN_FREE_MODELS) {
    if (rule.providerId === normalizedProvider || rule.providerId === 'all') {
      const reg = new RegExp(rule.modelPattern, 'i');
      if (reg.test(modelId)) {
        return rule.classification;
      }
    }
  }

  return 'UNKNOWN';
}

export function isModelAllowedUnderFreeGuard(
  providerId: string,
  modelId: string,
  freeOnlyModeEnabled: boolean = true,
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
      reason: 'Free-Only Safety Guard: This model is classified as PAID. Request blocked to prevent billing.',
    };
  }

  return {
    allowed: false,
    classification,
    reason: 'Free-Only Safety Guard: This model pricing is UNKNOWN. Verify it in Admin before allowing requests.',
  };
}
