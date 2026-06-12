/**
 * ChatPanel — Asha 聊天面板（chat / cowork 双模式 + 会话历史）
 *
 * - chat   ：纯对话，流式输出，无工具权限
 * - cowork ：模型可调用白名单工具（lib/ai/tools.ts），写操作经确认卡片
 * - 左侧会话历史：新建/切换/删除，自动标题
 * - 流式性能：delta 累积在本组件局部 state，完成后一次性落 chatStore
 *
 * 视觉复用模态体系（--shadow-lg / 0.5px 边框 / CSS 变量），
 * 右下角浮动卡片（GitHub Copilot Chat 的入口模式），不打断主界面。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, Send, Square, Trash2, MessageCircle, Wrench, Check, Loader2,
} from 'lucide-react';
import { chat, type ChatMessage, type ToolCall } from '../../lib/ai/client';
import { buildSystemPrompt } from '../../lib/ai/appContext';
import { TOOL_REGISTRY, coworkToolDefs } from '../../lib/ai/tools';
import { useChatStore, type ChatMode } from '../../store/chatStore';
import { useAIStore, getActiveAIConfig, getConfiguredProviders } from '../../store/aiStore';
import { getProvider } from '../../lib/ai/providers';

interface PendingConfirm {
  calls: ToolCall[];
  resolve: (approved: boolean) => void;
}

export default function ChatPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const {
    sessions, activeSessionId, isOpen,
    setIsOpen, newSession, switchSession, deleteSession, setSessionMode,
    appendMessage, markUnread, setAssistantBusy,
  } = useChatStore();
  const { activeProviderId, setActiveProvider } = useAIStore();

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const session = sessions.find((s) => s.id === activeSessionId) ?? null;
  const configured = getConfiguredProviders();

  // 首次打开：建会话 + Asha 自我介绍
  useEffect(() => {
    if (isOpen && sessions.length === 0) {
      const id = newSession('chat');
      appendMessage(id, { role: 'assistant', content: t('chat.greeting') });
    } else if (isOpen && !activeSessionId && sessions.length > 0) {
      switchSession(sessions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // 新消息/流式时滚到底
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session?.messages.length, streamText, pending]);

  const stop = () => {
    // 确认卡片挂起时先释放 Promise，避免循环死等
    pending?.resolve(false);
    abortRef.current?.abort();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || busy || !session) return;
    const cfg = getActiveAIConfig();
    if (!cfg) { setError(t('chat.noProvider')); return; }
    setError('');
    setInput('');
    appendMessage(session.id, { role: 'user', content: text });

    setBusy(true);
    setAssistantBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const sid = session.id;

    try {
      // 取最新会话内容构造上下文（system + 近 20 条）
      const live = useChatStore.getState().sessions.find((s) => s.id === sid)!;
      const history: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt(live.mode, lang) },
        ...live.messages.slice(-20).map((m) => ({ role: m.role, content: m.content } as ChatMessage)),
      ];

      if (live.mode === 'chat') {
        // 纯对话：流式
        setStreamText('');
        let acc = '';
        const { text: full } = await chat(history, {
          ...cfg, stream: true, maxTokens: 2048,
          onDelta: (d) => { acc += d; setStreamText(acc); },
          signal: controller.signal,
        });
        appendMessage(sid, { role: 'assistant', content: full || acc });
        markUnread();
      } else {
        // cowork：工具循环（≤5 轮），写操作确认
        const working = [...history];
        const trace: { name: string; summary: string }[] = [];
        for (let round = 0; round < 5; round++) {
          const res = await chat(working, {
            ...cfg, tools: coworkToolDefs(), maxTokens: 1600, signal: controller.signal,
          });
          if (res.toolCalls.length === 0 || round === 4) {
            appendMessage(sid, {
              role: 'assistant',
              content: res.text || (lang === 'zh' ? '（已完成）' : '(done)'),
              toolTrace: trace.length ? trace : undefined,
            });
            markUnread();
            break;
          }
          working.push({ role: 'assistant', content: res.text, toolCalls: res.toolCalls });

          // 写操作 → 确认卡片
          const writes = res.toolCalls.filter((tc) => TOOL_REGISTRY[tc.name]?.isWrite);
          let approved = true;
          if (writes.length > 0) {
            approved = await new Promise<boolean>((resolve) => setPending({ calls: writes, resolve }));
            setPending(null);
            if (controller.signal.aborted) return;
          }

          for (const tc of res.toolCalls) {
            const reg = TOOL_REGISTRY[tc.name];
            const args = safeParse(tc.arguments);
            let result: string;
            if (!reg) {
              result = JSON.stringify({ error: 'unknown tool' });
            } else if (reg.isWrite && !approved) {
              result = JSON.stringify({ ok: false, cancelled: 'user declined' });
            } else {
              result = await reg.run(args);
              trace.push({ name: tc.name, summary: reg.summarize(args, lang) });
            }
            working.push({ role: 'tool', toolCallId: tc.id, content: result });
          }
        }
      }
    } catch (e) {
      if (controller.signal.aborted) {
        // 中断：保留已生成的部分
        const partial = streamRefSnapshot();
        if (partial) appendMessage(sid, { role: 'assistant', content: partial });
      } else {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg === 'NO_API_KEY' ? t('chat.noProvider') : msg);
      }
    } finally {
      setBusy(false);
      setAssistantBusy(false);
      setStreamText('');
      abortRef.current = null;
    }
  };

  // 中断时读取当前流式快照（streamText 闭包可能滞后，从 DOM 状态外置一个 ref 更稳）
  const streamSnapshot = useRef('');
  useEffect(() => { streamSnapshot.current = streamText; }, [streamText]);
  const streamRefSnapshot = () => streamSnapshot.current;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          className="fixed flex overflow-hidden"
          style={{
            right: '18px', bottom: '96px', zIndex: 40,
            width: 'min(460px, calc(100vw - 36px))',
            height: 'min(540px, calc(100vh - 130px))',
            borderRadius: '14px',
            border: '0.5px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-secondary)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* ── 左侧会话历史 ── */}
          <div className="flex-shrink-0 flex flex-col border-r" style={{ width: '128px', borderColor: 'var(--color-border)' }}>
            <button
              onClick={() => { const id = newSession('chat'); appendMessage(id, { role: 'assistant', content: t('chat.greeting') }); }}
              className="flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
              style={{
                margin: '8px', gap: '4px', height: '26px', borderRadius: '7px', fontSize: '10px', fontWeight: 500,
                border: '0.5px dashed var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              <Plus size={11} />
              {t('chat.newChat')}
            </button>
            <div className="flex-1 overflow-y-auto tools-scroll" style={{ padding: '0 6px 8px' }}>
              {sessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => switchSession(s.id)}
                  className="group flex items-center cursor-pointer transition-colors"
                  style={{
                    gap: '4px', padding: '6px 7px', borderRadius: '6px', marginBottom: '2px',
                    backgroundColor: s.id === activeSessionId ? 'var(--color-bg-tertiary)' : 'transparent',
                  }}
                >
                  <span
                    className="flex-1"
                    style={{
                      fontSize: '10px', lineHeight: 1.4,
                      color: s.id === activeSessionId ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {s.title || t('chat.untitled')}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-pointer"
                    style={{ border: 'none', background: 'none', color: 'var(--color-text-tertiary)', padding: 0 }}
                  >
                    <Trash2 size={9} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── 右侧主区 ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* 头部 */}
            <div className="flex items-center flex-shrink-0 border-b" style={{ borderColor: 'var(--color-border)', padding: '8px 10px', gap: '8px' }}>
              <MiniAsha />
              <span className="text-xs font-semibold flex-shrink-0" style={{ color: 'var(--color-text-primary)' }}>
                Asha · 阿夏
              </span>
              {/* 模式切换 */}
              {session && (
                <div className="flex rounded-md overflow-hidden border flex-shrink-0" style={{ borderColor: 'var(--color-border)' }}>
                  {(['chat', 'cowork'] as ChatMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setSessionMode(session.id, m)}
                      className="cursor-pointer transition-all flex items-center"
                      title={m === 'chat' ? t('chat.modeChatHint') : t('chat.modeCoworkHint')}
                      style={{
                        gap: '3px', padding: '3px 8px', fontSize: '9px', fontWeight: 500, border: 'none',
                        color: session.mode === m ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
                        backgroundColor: session.mode === m ? 'var(--color-fill)' : 'transparent',
                      }}
                    >
                      {m === 'chat' ? <MessageCircle size={9} /> : <Wrench size={9} />}
                      {m === 'chat' ? t('chat.modeChat') : t('chat.modeCowork')}
                    </button>
                  ))}
                </div>
              )}
              {/* 模型切换 */}
              <select
                value={activeProviderId}
                onChange={(e) => setActiveProvider(e.target.value)}
                className="text-[9px] outline-none cursor-pointer min-w-0"
                style={{
                  marginLeft: 'auto', maxWidth: '110px',
                  padding: '3px 5px', borderRadius: '5px',
                  border: '0.5px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-tertiary)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {configured.length === 0 && <option value={activeProviderId}>{t('chat.noProviderShort')}</option>}
                {configured.map((c) => (
                  <option key={c.providerId} value={c.providerId}>
                    {getProvider(c.providerId)?.name ?? c.providerId}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setIsOpen(false)}
                className="w-5 h-5 rounded flex items-center justify-center hover:bg-[var(--color-bg-tertiary)] transition-colors cursor-pointer flex-shrink-0"
                style={{ color: 'var(--color-text-tertiary)', border: 'none', background: 'transparent' }}
              >
                <X size={12} />
              </button>
            </div>

            {/* 消息区 */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto tools-scroll" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {session?.messages.map((m) => (
                <MessageBubble key={m.id} role={m.role} content={m.content} toolTrace={m.toolTrace} />
              ))}
              {/* 流式中的临时气泡 */}
              {busy && streamText && (
                <MessageBubble role="assistant" content={streamText} streaming />
              )}
              {busy && !streamText && !pending && (
                <div className="flex items-center" style={{ gap: '6px', color: 'var(--color-text-tertiary)', fontSize: '10px' }}>
                  <Loader2 size={11} className="animate-spin" style={{ color: 'var(--clay)' }} />
                  {t('chat.thinking')}
                </div>
              )}
              {/* 写操作确认卡片 */}
              {pending && (
                <div
                  style={{
                    borderRadius: '10px', border: '0.5px solid var(--clay)',
                    backgroundColor: 'var(--clay-light)', padding: '10px 12px',
                    display: 'flex', flexDirection: 'column', gap: '7px',
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--clay)' }}>
                    {t('chat.confirmTitle')}
                  </span>
                  {pending.calls.map((tc) => (
                    <div key={tc.id} className="flex items-center" style={{ gap: '6px', fontSize: '11px', color: 'var(--color-text-primary)' }}>
                      <Wrench size={10} style={{ color: 'var(--clay)', flexShrink: 0 }} />
                      {TOOL_REGISTRY[tc.name]?.summarize(safeParse(tc.arguments), lang) ?? tc.name}
                    </div>
                  ))}
                  <div className="flex items-center" style={{ gap: '6px', marginTop: '2px' }}>
                    <button
                      onClick={() => pending.resolve(true)}
                      className="flex items-center cursor-pointer"
                      style={{ gap: '4px', padding: '4px 14px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, border: 'none', backgroundColor: 'var(--clay)', color: 'var(--ivory-light, #fff)' }}
                    >
                      <Check size={10} />
                      {t('chat.approve')}
                    </button>
                    <button
                      onClick={() => pending.resolve(false)}
                      className="cursor-pointer"
                      style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '10px', border: '0.5px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}
                    >
                      {t('chat.decline')}
                    </button>
                  </div>
                </div>
              )}
              {error && (
                <span style={{ fontSize: '10px', color: '#e5484d', lineHeight: 1.5, wordBreak: 'break-all' }}>{error}</span>
              )}
            </div>

            {/* 输入区 */}
            <div className="flex items-end flex-shrink-0 border-t" style={{ borderColor: 'var(--color-border)', padding: '9px 10px', gap: '7px' }}>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder={session?.mode === 'cowork' ? t('chat.placeholderCowork') : t('chat.placeholder')}
                rows={Math.min(3, Math.max(1, input.split('\n').length))}
                className="flex-1 text-xs outline-none resize-none"
                style={{
                  padding: '7px 10px', borderRadius: '9px',
                  border: '0.5px solid var(--color-border)',
                  backgroundColor: 'var(--color-bg-input)',
                  color: 'var(--color-text-primary)',
                  lineHeight: 1.5,
                  fontFamily: 'var(--font-family)',
                }}
              />
              <button
                onClick={busy ? stop : send}
                disabled={!busy && !input.trim()}
                className="flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
                title={busy ? t('chat.stop') : t('chat.send')}
                style={{
                  width: '30px', height: '30px', borderRadius: '9px', border: 'none',
                  backgroundColor: busy ? 'var(--color-bg-tertiary)' : 'var(--clay)',
                  color: busy ? 'var(--color-text-secondary)' : 'var(--ivory-light, #fff)',
                  opacity: !busy && !input.trim() ? 0.45 : 1,
                }}
              >
                {busy ? <Square size={11} /> : <Send size={12} style={{ marginLeft: '-1px' }} />}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── 子组件 ────────────────────────────────────────────────────────────

function MessageBubble({ role, content, toolTrace, streaming }: {
  role: 'user' | 'assistant';
  content: string;
  toolTrace?: { name: string; summary: string }[];
  streaming?: boolean;
}) {
  const isUser = role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`} style={{ gap: '7px' }}>
      {!isUser && <MiniAsha />}
      <div className="flex flex-col" style={{ maxWidth: '82%', gap: '4px' }}>
        {/* 工具痕迹 */}
        {toolTrace && toolTrace.length > 0 && (
          <div className="flex flex-col" style={{ gap: '2px' }}>
            {toolTrace.map((tr, i) => (
              <span key={i} className="flex items-center" style={{ gap: '4px', fontSize: '9px', color: 'var(--color-text-tertiary)' }}>
                <Wrench size={8} style={{ color: 'var(--olive)' }} />
                {tr.summary}
              </span>
            ))}
          </div>
        )}
        <div
          style={{
            padding: '7px 11px',
            borderRadius: isUser ? '11px 11px 3px 11px' : '11px 11px 11px 3px',
            backgroundColor: isUser ? 'var(--clay)' : 'var(--color-bg-tertiary)',
            color: isUser ? 'var(--ivory-light, #fff)' : 'var(--color-text-primary)',
            fontSize: '12px',
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {content}
          {streaming && <span className="animate-pulse" style={{ opacity: 0.6 }}>▍</span>}
        </div>
      </div>
    </div>
  );
}

/** 轻量静态 Asha 头像（不带动画定时器，消息列表批量渲染友好） */
function MiniAsha() {
  return (
    <svg width="22" height="22" viewBox="0 0 120 124" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
      <path d="M24 34 Q 26 12, 44 18 Q 36 26, 33 38 Z" fill="#ECE8E1" />
      <path d="M96 34 Q 94 12, 76 18 Q 84 26, 87 38 Z" fill="#ECE8E1" />
      <circle cx="60" cy="56" r="36" fill="#ECE8E1" />
      <circle cx="44" cy="32" r="3" fill="#A39C90" />
      <circle cx="76" cy="32" r="3" fill="#A39C90" />
      <ellipse cx="60" cy="70" rx="18" ry="13" fill="#FAF8F4" />
      <ellipse cx="46" cy="54" rx="6.5" ry="7.5" fill="#8FB3A3" />
      <circle cx="46" cy="55" r="3.6" fill="#3A3733" />
      <ellipse cx="74" cy="54" rx="6.5" ry="7.5" fill="#8FB3A3" />
      <circle cx="74" cy="55" r="3.6" fill="#3A3733" />
      <path d="M56.5 64.5 Q 60 62.5, 63.5 64.5 Q 62 68.5, 60 68.5 Q 58 68.5, 56.5 64.5 Z" fill="#C98A7D" />
    </svg>
  );
}

function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
