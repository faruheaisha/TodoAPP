import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * chatStore — Asha 聊天面板状态与会话历史
 *
 * 会话持久化（localStorage）；面板开关与未读为运行态。
 * 流式输出的 delta 不进 store（在 ChatPanel 局部 state 累积，
 * 完成后一次性 appendMessage），避免每个 token 触发全列表重渲。
 */

export type ChatMode = 'chat' | 'cowork';

export interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  /** cowork 模式下该回复执行过的工具记录（展示用） */
  toolTrace?: { name: string; summary: string }[];
  ts: number;
}

export interface ChatSession {
  id: string;
  title: string;
  mode: ChatMode;
  messages: ChatMsg[];
  createdAt: number;
}

interface ChatState {
  sessions: ChatSession[];
  activeSessionId: string | null;
  isOpen: boolean;
  hasUnread: boolean;
  /** Asha 正在思考/生成（运行态，宠物表情联动） */
  assistantBusy: boolean;

  setIsOpen: (open: boolean) => void;
  setAssistantBusy: (busy: boolean) => void;
  newSession: (mode?: ChatMode) => string;
  switchSession: (id: string) => void;
  deleteSession: (id: string) => void;
  setSessionMode: (id: string, mode: ChatMode) => void;
  appendMessage: (sessionId: string, msg: Omit<ChatMsg, 'id' | 'ts'>) => void;
  markUnread: () => void;
}

const MAX_SESSIONS = 50;

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      isOpen: false,
      hasUnread: false,
      assistantBusy: false,

      setIsOpen: (isOpen) => set({ isOpen, ...(isOpen ? { hasUnread: false } : null) }),
      setAssistantBusy: (assistantBusy) => set({ assistantBusy }),

      newSession: (mode = 'chat') => {
        const id = crypto.randomUUID();
        const session: ChatSession = { id, title: '', mode, messages: [], createdAt: Date.now() };
        set((s) => ({
          sessions: [session, ...s.sessions].slice(0, MAX_SESSIONS),
          activeSessionId: id,
        }));
        return id;
      },

      switchSession: (activeSessionId) => set({ activeSessionId }),

      deleteSession: (id) =>
        set((s) => {
          const sessions = s.sessions.filter((x) => x.id !== id);
          return {
            sessions,
            activeSessionId: s.activeSessionId === id ? (sessions[0]?.id ?? null) : s.activeSessionId,
          };
        }),

      setSessionMode: (id, mode) =>
        set((s) => ({
          sessions: s.sessions.map((x) => (x.id === id ? { ...x, mode } : x)),
        })),

      appendMessage: (sessionId, msg) =>
        set((s) => ({
          sessions: s.sessions.map((x) => {
            if (x.id !== sessionId) return x;
            const full: ChatMsg = { ...msg, id: crypto.randomUUID(), ts: Date.now() };
            // 自动标题：首条用户消息截断
            const title = x.title || (msg.role === 'user' ? msg.content.slice(0, 24) : '');
            return { ...x, title, messages: [...x.messages, full] };
          }),
        })),

      markUnread: () => {
        if (!get().isOpen) set({ hasUnread: true });
      },
    }),
    {
      name: 'todoapp-chat',
      version: 1,
      partialize: (s) => ({ sessions: s.sessions, activeSessionId: s.activeSessionId }),
    }
  )
);
