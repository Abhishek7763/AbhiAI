export function toSpeakableText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' Code snippet omitted. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' Image omitted. ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#*_~>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectSpeechLanguage(text: string, fallback = 'en-US') {
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';
  return fallback || 'en-US';
}
