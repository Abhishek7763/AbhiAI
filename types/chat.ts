export type Role = 'user' | 'assistant';

export interface Message {
  id: string;
  role: Role;
  content: string;
}

export interface AIModel {
  id: string;
  name: string;
  icon?: React.ReactNode;
}
