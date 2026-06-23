/**
 * Store Zustand — Estado do assistente de IA offline (ELIAS).
 */

import { create } from 'zustand';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isError?: boolean;
}

export const DEFAULT_MODEL = 'llama3.2:3b';

export const AVAILABLE_MODELS = [
  { name: 'llama3.2:3b', size: '~2 GB', description: 'Leve e rápido, bom em português' },
  { name: 'qwen2.5:3b', size: '~2 GB', description: 'Excelente em português e técnico' },
  { name: 'mistral:7b', size: '~4 GB', description: 'Alta qualidade, mais memória' },
  { name: 'phi3:mini', size: '~2.3 GB', description: 'Raciocínio técnico eficiente' },
];

interface ModelStatus {
  available: boolean;
  models: string[];
  default_model?: string;
}

interface AIStore {
  messages: AIMessage[];
  isStreaming: boolean;
  includeContext: boolean;
  modelStatus: ModelStatus | null;
  selectedModel: string;
  isPulling: boolean;
  pullProgress: string;

  addMessage: (role: AIMessage['role'], content: string) => AIMessage;
  appendToLastMessage: (content: string) => void;
  setLastMessageError: (error: string) => void;
  clearMessages: () => void;
  setIsStreaming: (v: boolean) => void;
  setIncludeContext: (v: boolean) => void;
  setModelStatus: (status: ModelStatus | null) => void;
  setSelectedModel: (model: string) => void;
  setIsPulling: (v: boolean) => void;
  setPullProgress: (msg: string) => void;
}

export const useAiStore = create<AIStore>((set) => ({
  messages: [],
  isStreaming: false,
  includeContext: true,
  modelStatus: null,
  selectedModel: DEFAULT_MODEL,
  isPulling: false,
  pullProgress: '',

  addMessage: (role, content) => {
    const msg: AIMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: new Date(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return msg;
  },

  appendToLastMessage: (content) => {
    set((s) => {
      const messages = [...s.messages];
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content: messages[messages.length - 1].content + content,
        };
      }
      return { messages };
    });
  },

  setLastMessageError: (error) => {
    set((s) => {
      const messages = [...s.messages];
      if (messages.length > 0) {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          content: error,
          isError: true,
        };
      }
      return { messages };
    });
  },

  clearMessages: () => set({ messages: [] }),
  setIsStreaming: (v) => set({ isStreaming: v }),
  setIncludeContext: (v) => set({ includeContext: v }),
  setModelStatus: (status) => set({ modelStatus: status }),
  setSelectedModel: (model) => set({ selectedModel: model }),
  setIsPulling: (v) => set({ isPulling: v }),
  setPullProgress: (msg) => set({ pullProgress: msg }),
}));
