/**
 * ChatPanel — Asha 聊天面板（chat / cowork 双模式 + 会话历史）
 *
 * - chat   ：纯对话，流式输出，无工具权限
 * - cowork ：模型可调用白名单工具（lib/ai/tools.ts），写操作经确认卡片
 * - 左侧会话历史：新建/切换/删除，自动标题
 * - 流式性能：delta 累积在本组件局部 state，完成后一次性落 chatStore
 *
 * 位置跟随：与 PetWidget 共享 aiStore.petOffset，
 * 通过动态 right/bottom 偏移实现宠物拖拽时面板同步移动。
 *
 * 视觉：玻璃拟态（--glass-bg / backdropFilter blur），无硬边框感。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Plus, Send, Square, Trash2, MessageCircle, Wrench, Check, Loader2, Settings,
} from 'lucide-react';
import { chat, type ChatMessage, type ToolCall } from '../../lib/ai/client';
import { buildSystemPrompt } from '../../lib/ai/appContext';
import { TOOL_REGISTRY, coworkToolDefs } from '../../lib/ai/tools';
import { useChatStore, type ChatMode } from '../../store/chatStore';
import { useAIStore, getActiveAIConfig, getConfiguredProviders } from '../../store/aiStore';
import { useSettingsStore } from '../../store/settingsStore';
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

  const { activeProviderId, setActiveProvider, aiEnabled, petOffset } = useAIStore();

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const session = sessions.find((s) => s.id === activeSessionId) ?? null;
  const configured = getConfiguredProviders();

  // 语言感知宠物名
  const petName = lang === 'zh' ? '阿夏' : 'Asha';

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
      const live = useChatStore.getState().sessions.find((s) => s.id === sid)!;
      const history: ChatMessage[] = [
        { role: 'system', content: buildSystemPrompt(live.mode, lang) },
        ...live.messages.slice(-20).map((m) => ({ role: m.role, content: m.content } as ChatMessage)),
      ];

      if (live.mode === 'chat') {
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

  const streamSnapshot = useRef('');
  useEffect(() => { streamSnapshot.current = streamText; }, [streamText]);
  const streamRefSnapshot = () => streamSnapshot.current;

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // 面板位置：基础 right/bottom + petOffset 偏移（与宠物同步移动）
  const panelRight  = 18 - petOffset.x;
  const panelBottom = 96 - petOffset.y;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="chat-panel"
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          exit={{    opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          className="fixed flex overflow-hidden"
          style={{
            right:  `${panelRight}px`,
            bottom: `${panelBottom}px`,
            zIndex: 40,
            width: 'min(460px, calc(100vw - 36px))',
            height: 'min(540px, calc(100vh - 130px))',
            borderRadius: '16px',
            // 玻璃拟态：无硬边框，渐变透明
            border: '0.5px solid var(--glass-border)',
            backgroundColor: 'var(--glass-bg)',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
            boxShadow: 'var(--shadow-float)',
          }}
        >
          {/* ── 左侧会话历史 ── */}
          <div
            className="flex-shrink-0 flex flex-col"
            style={{
              width: '128px',
              borderRight: '0.5px solid var(--glass-border)',
            }}
          >
            <button
              onClick={() => {
                const id = newSession('chat');
                appendMessage(id, { role: 'assistant', content: t('chat.greeting') });
              }}
              className="flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
              style={{
                margin: '8px', gap: '4px', height: '26px', borderRadius: '7px', fontSize: '10px', fontWeight: 500,
                border: '0.5px dashed var(--glass-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)',
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
            <div
              className="flex items-center flex-shrink-0"
              style={{
                borderBottom: '0.5px solid var(--glass-border)',
                padding: '8px 10px', gap: '8px',
              }}
            >
              <MiniAsha />
              {/* 语言感知名称 + 渐变字体，无边框 */}
              <span
                className="flex-shrink-0"
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  fontStyle: 'italic',
                  letterSpacing: '0.01em',
                  background: 'linear-gradient(135deg, var(--clay) 20%, var(--fig, #c46686) 110%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {petName}
              </span>
              {/* 模式切换 */}
              {session && (
                <div
                  className="flex rounded-md overflow-hidden flex-shrink-0"
                  style={{ border: '0.5px solid var(--glass-border)' }}
                >
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
                  border: '0.5px solid var(--glass-border)',
                  backgroundColor: 'transparent',
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
                className="w-5 h-5 rounded flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors"
                style={{ color: 'var(--color-text-tertiary)', border: 'none', background: 'transparent' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <X size={12} />
              </button>
            </div>

            {/* AI 未启用时展示引导卡片 */}
            {!aiEnabled ? (
              <SetupPromptCard lang={lang} t={t} />
            ) : (
              <>
                {/* 消息区 */}
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto tools-scroll"
                  style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}
                >
                  {session?.messages.map((m) => (
                    <MessageBubble key={m.id} role={m.role} content={m.content} toolTrace={m.toolTrace} />
                  ))}
                  {busy && streamText && (
                    <MessageBubble role="assistant" content={streamText} streaming />
                  )}
                  {busy && !streamText && !pending && (
                    <div className="flex items-center" style={{ gap: '6px', color: 'var(--color-text-tertiary)', fontSize: '10px' }}>
                      <Loader2 size={11} className="animate-spin" style={{ color: 'var(--clay)' }} />
                      {t('chat.thinking')}
                    </div>
                  )}
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
                          style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '10px', border: '0.5px solid var(--glass-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}
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
                <div
                  className="flex items-end flex-shrink-0"
                  style={{
                    borderTop: '0.5px solid var(--glass-border)',
                    padding: '9px 10px', gap: '7px',
                  }}
                >
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={session?.mode === 'cowork' ? t('chat.placeholderCowork') : t('chat.placeholder')}
                    rows={Math.min(3, Math.max(1, input.split('\n').length))}
                    className="flex-1 text-xs outline-none resize-none"
                    style={{
                      padding: '7px 10px', borderRadius: '9px',
                      border: '0.5px solid var(--glass-border)',
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
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── 子组件 ────────────────────────────────────────────────────────────

/** AI 未启用时的设置引导卡片 */
function SetupPromptCard({ lang, t }: { lang: string; t: (k: string) => string }) {
  const { setIsOpen: setSettingsOpen } = useSettingsStore();
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center"
      style={{ padding: '24px 20px', gap: '16px', textAlign: 'center' }}
    >
      <MiniAsha size={36} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <span
          style={{
            fontSize: '13px', fontWeight: 700, fontStyle: 'italic',
            background: 'linear-gradient(135deg, var(--clay) 20%, var(--fig, #c46686) 110%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}
        >
          {lang === 'zh' ? '嗨，我是阿夏 ✨' : 'Hi, I\'m Asha ✨'}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', lineHeight: 1.65 }}>
          {lang === 'zh'
            ? '配置一个 AI 接口后，我就能帮你拆解任务、规划时间啦～'
            : 'Set up an AI provider and I\'ll help you break down tasks and plan your time!'}
        </span>
      </div>
      <button
        onClick={() => setSettingsOpen(true)}
        className="flex items-center cursor-pointer transition-all"
        style={{
          gap: '6px', padding: '8px 18px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
          border: 'none', backgroundColor: 'var(--clay)', color: 'var(--ivory-light, #fff)',
          boxShadow: '0 2px 10px rgba(217, 119, 87, 0.30)',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.88'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      >
        <Settings size={12} />
        {lang === 'zh' ? '前往设置' : 'Open Settings'}
      </button>
    </div>
  );
}

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

/** 轻量静态 Asha 头像 */
function MiniAsha({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 124" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
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
