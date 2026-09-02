export interface ErrorDiagnosis {
  code: number | string;
  userTitle: string;
  userMessage: string;
  recommendedAction: string;
}

export function diagnoseAIError(errorString: string, statusCode?: number): ErrorDiagnosis {
  const lower = (errorString || '').toLowerCase();

  if (statusCode === 401 || lower.includes('401') || lower.includes('unauthorized') || lower.includes('invalid api key')) {
    return {
      code: 401,
      userTitle: 'API Key Invalid or Expired',
      userMessage: 'The API key provided for this provider is either invalid, revoked, or has expired.',
      recommendedAction: 'Go to Admin Connections, click Edit on this provider, and paste a fresh API key.'
    };
  }

  if (statusCode === 403 || lower.includes('403') || lower.includes('forbidden') || lower.includes('permission denied')) {
    return {
      code: 403,
      userTitle: 'Model Permission Denied',
      userMessage: 'Your API key does not have access or permissions to invoke this specific model ID.',
      recommendedAction: 'Check if you have accepted the model terms in provider catalog or switch to an alternate model.'
    };
  }

  if (statusCode === 429 || lower.includes('429') || lower.includes('rate limit') || lower.includes('quota exceeded')) {
    return {
      code: 429,
      userTitle: 'Free Rate Limit Reached',
      userMessage: 'The provider temporarily limited requests because the free quota or RPM limit was reached.',
      recommendedAction: 'AbhiAI smart failover will automatically use your backup model. You can also wait 60 seconds.'
    };
  }

  if (statusCode === 404 || lower.includes('404') || lower.includes('not found')) {
    return {
      code: 404,
      userTitle: 'Model or Endpoint Not Found',
      userMessage: 'The requested model ID or API Base URL does not exist on this provider server.',
      recommendedAction: 'Use the Quick Provider Wizard to auto-discover and import currently active models.'
    };
  }

  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('slow')) {
    return {
      code: 'TIMEOUT',
      userTitle: 'Provider Response Timeout',
      userMessage: 'The upstream AI provider took too long to generate a reply (>60s).',
      recommendedAction: 'Check provider server status or configure a faster fallback model in AbhiAI.'
    };
  }

  return {
    code: 'UNKNOWN',
    userTitle: 'Provider Connection Issue',
    userMessage: errorString || 'An unexpected error occurred while communicating with the AI service.',
    recommendedAction: 'Test connection in Admin Connections or check your internet connection.'
  };
}
