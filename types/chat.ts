export type Role = 'user' | 'assistant';

export interface Attachment {
  name: string;
  type: string;
  data: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
  timestamp?: number;
  model?: string;
  failoverUsed?: boolean;
  isStreaming?: boolean;
}

export interface AIModel {
  id: string;
  name: string;
  icon?: React.ReactNode;
}
