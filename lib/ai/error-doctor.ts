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
      recommendedAction: 'Open Admin > Integrations, choose this provider, and save a fresh API key.',
    };
  }

  if (statusCode === 403 || lower.includes('403') || lower.includes('forbidden') || lower.includes('permission denied')) {
    return {
      code: 403,
      userTitle: 'Model Permission Denied',
      userMessage: 'Your API key does not have access or permissions to invoke this specific model ID.',
      recommendedAction: 'Check the provider model permissions or switch to another healthy model in Smart Routing.',
    };
  }

  if (statusCode === 429 || lower.includes('429') || lower.includes('rate limit') || lower.includes('quota exceeded')) {
    return {
      code: 429,
      userTitle: 'Free Rate Limit Reached',
      userMessage: 'The provider temporarily limited requests because the free quota or RPM limit was reached.',
      recommendedAction: 'AbhiAI Smart Routing will temporarily cool this model and prefer another healthy model.',
    };
  }

  if (statusCode === 404 || lower.includes('404') || lower.includes('not found')) {
    return {
      code: 404,
      userTitle: 'Model or Endpoint Not Found',
      userMessage: 'The requested model ID or API Base URL does not exist on this provider server.',
      recommendedAction: 'Open Admin > Integrations and rediscover the provider models or verify the Base URL.',
    };
  }

  if (lower.includes('timeout') || lower.includes('aborted') || lower.includes('slow')) {
    return {
      code: 'TIMEOUT',
      userTitle: 'Provider Response Timeout',
      userMessage: 'The upstream AI provider did not respond within AbhiAI’s safe response window.',
      recommendedAction: 'Check provider health or keep multiple healthy models in the Smart Routing pool.',
    };
  }

  return {
    code: 'UNKNOWN',
    userTitle: 'Provider Connection Issue',
    userMessage: errorString || 'An unexpected error occurred while communicating with the AI service.',
    recommendedAction: 'Check Admin > Integrations and Health, then test the provider again.',
  };
}
