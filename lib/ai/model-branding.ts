const DEFAULT_ABHIAI_MODEL_NAMES: Record<string, string> = {
  'gemini-3.7-flash': 'AbhiAI Think',
  'gemini-3.6-flash': 'AbhiAI Code',
  'gemini-3.5-flash-lite': 'AbhiAI Fast',
  'gemini-3.1-flash-lite': 'AbhiAI Lite',
};

function looksLikeTechnicalModelName(value: string, modelId: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === modelId.toLowerCase() ||
    normalized.includes('gemini') ||
    normalized.includes('google')
  );
}

export function getDefaultAbhiAIModelName(modelId: string) {
  return DEFAULT_ABHIAI_MODEL_NAMES[modelId] ?? 'AbhiAI';
}

export function getBrandedModelName(modelId: string, storedAlias?: string | null) {
  const alias = storedAlias?.trim();
  if (alias && !looksLikeTechnicalModelName(alias, modelId)) {
    return alias;
  }
  return getDefaultAbhiAIModelName(modelId);
}

export function isBrandedRuntimeModel(modelId: string) {
  return modelId in DEFAULT_ABHIAI_MODEL_NAMES;
}
