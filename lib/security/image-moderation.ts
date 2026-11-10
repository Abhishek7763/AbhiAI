export type ImageModerationCategory =
  | 'sexual-content'
  | 'sexual-minors'
  | 'graphic-violence'
  | 'self-harm';

export type ImageModerationResult = {
  allowed: boolean;
  category?: ImageModerationCategory;
};

const MINOR_TERMS = /\b(child|children|kid|kids|minor|minors|underage|teenager|teenagers|young girl|young boy)\b/i;
const SEXUAL_TERMS = /\b(porn|pornographic|explicit sex|sexual intercourse|genitals|masturbat(?:e|ion)|oral sex|anal sex|rape|raping|nude sex|fully nude|explicit nude|naked body)\b/i;
const GRAPHIC_VIOLENCE_TERMS = /\b(dismember(?:ed|ment)|decapitat(?:e|ed|ion)|severed head|severed limb|guts spilling|graphic gore|extreme gore|blood-soaked corpse|mutilated corpse)\b/i;
const SELF_HARM_TERMS = /\b(suicide scene|committing suicide|self-harm scene|cutting wrists|slitting wrists|hanging oneself|self immolation)\b/i;

export function moderateImagePrompt(prompt: string, negativePrompt = ''): ImageModerationResult {
  const text = `${prompt}\n${negativePrompt}`.replace(/\s+/g, ' ').trim();
  if (!text) return { allowed: true };

  const hasMinor = MINOR_TERMS.test(text);
  const hasSexual = SEXUAL_TERMS.test(text);

  if (hasMinor && hasSexual) {
    return { allowed: false, category: 'sexual-minors' };
  }

  if (hasSexual) {
    return { allowed: false, category: 'sexual-content' };
  }

  if (GRAPHIC_VIOLENCE_TERMS.test(text)) {
    return { allowed: false, category: 'graphic-violence' };
  }

  if (SELF_HARM_TERMS.test(text)) {
    return { allowed: false, category: 'self-harm' };
  }

  return { allowed: true };
}
