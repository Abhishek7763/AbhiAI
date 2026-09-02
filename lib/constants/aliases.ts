export interface PublicAliasOption {
  id: string;
  displayName: string;
}

export const DEFAULT_PUBLIC_ALIASES: PublicAliasOption[] = [
  { id: 'abhiai-fast', displayName: 'AbhiAI Fast (Quick queries)' },
  { id: 'abhiai-think', displayName: 'AbhiAI Think (Deep reasoning)' },
  { id: 'abhiai-code', displayName: 'AbhiAI Code (Software engineering)' },
  { id: 'abhiai-vision', displayName: 'AbhiAI Vision (Multimodal analysis)' },
  { id: 'abhiai-creative', displayName: 'AbhiAI Creative (Writing & ideas)' },
];
