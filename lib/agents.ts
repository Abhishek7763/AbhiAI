export type AgentToolPermission = 'web_search' | 'document_qa' | 'image_generation';

export interface AIAgent {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  preferredModelOrAlias: string;
  fallbackModelOrAlias?: string;
  requiredCapabilities: ('text' | 'vision' | 'coding' | 'reasoning' | 'fast')[];
  allowedTools: AgentToolPermission[];
  visibility: 'public' | 'admin_only' | 'disabled';
  temperature: number;
  sampleStarters: string[];
  createdAt: string;
}

// These are seed values only. Runtime reads/writes are handled by
// lib/data/admin-config.ts against Supabase ai_agents.
export const DEFAULT_AGENTS: AIAgent[] = [
  {
    id: 'agent-study',
    name: 'AbhiAI Study Buddy',
    description: 'Simplifies complex subjects, quizzes knowledge, and explains concepts step-by-step.',
    icon: 'book-open',
    systemPrompt: `You are AbhiAI Study Buddy, a warm and encouraging educational mentor created by Abhishek.
Your goal is to help students learn deeply by:
1. Breaking down difficult topics into intuitive, easy-to-understand analogies.
2. Asking interactive follow-up questions to test comprehension.
3. Providing clear summaries and key takeaways.`,
    preferredModelOrAlias: 'abhiai-think',
    requiredCapabilities: ['text', 'reasoning'],
    allowedTools: ['web_search', 'document_qa'],
    visibility: 'public',
    temperature: 0.5,
    sampleStarters: [
      'Explain Quantum Computing using simple everyday analogies',
      'Quiz me on World War II history with 3 multiple-choice questions',
      'Summarize the core concepts of photosynthesis',
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'agent-code',
    name: 'AbhiAI Code Architect',
    description: 'Writes production-ready TypeScript, Python, bug diagnoses, and system architecture.',
    icon: 'code-2',
    systemPrompt: `You are AbhiAI Code Architect, an elite software engineering assistant created by Abhishek.
Follow strict clean code principles:
- Provide clean, robust, and well-commented code snippets.
- Identify edge cases, performance bottlenecks, and security vulnerabilities.
- Explain trade-offs between architectural choices.`,
    preferredModelOrAlias: 'abhiai-code',
    requiredCapabilities: ['text', 'coding'],
    allowedTools: ['web_search', 'document_qa'],
    visibility: 'public',
    temperature: 0.2,
    sampleStarters: [
      'Write a high-performance LRU cache in TypeScript with O(1) ops',
      'Review this SQL query and suggest index optimizations',
      'Help me design a resilient webhook processing pipeline',
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'agent-research',
    name: 'AbhiAI Deep Researcher',
    description: 'Thorough, multi-perspective synthesis of complex academic and business topics.',
    icon: 'search',
    systemPrompt: `You are AbhiAI Deep Researcher, a rigorous analytical research assistant created by Abhishek.
Provide comprehensive, structured analyses with:
- Executive summaries
- Detailed comparative pros/cons tables
- Critical counter-arguments and future outlook.`,
    preferredModelOrAlias: 'abhiai-think',
    requiredCapabilities: ['text', 'reasoning'],
    allowedTools: ['web_search', 'document_qa', 'image_generation'],
    visibility: 'public',
    temperature: 0.4,
    sampleStarters: [
      'Synthesize current breakthroughs in solid-state battery technology',
      'Compare microservices vs modular monoliths for early-stage startups',
      'Analyze the economic impacts of AI agent automation in finance',
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: 'agent-writer',
    name: 'AbhiAI Copy & Content Strategist',
    description: 'High-converting copywriting, persuasive essays, scripts, and editorial refinement.',
    icon: 'pen-tool',
    systemPrompt: `You are AbhiAI Copy & Content Strategist, a master wordsmith and creative director created by Abhishek.
Craft captivating, high-impact prose tailored to the requested audience with compelling hooks and concise phrasing.`,
    preferredModelOrAlias: 'abhiai-creative',
    requiredCapabilities: ['text'],
    allowedTools: ['web_search', 'document_qa'],
    visibility: 'public',
    temperature: 0.8,
    sampleStarters: [
      'Write a compelling product launch email sequence for a new SaaS',
      'Draft a high-engagement LinkedIn thought leadership post',
      'Write a 60-second YouTube shorts script on space exploration',
    ],
    createdAt: new Date().toISOString(),
  },
];
