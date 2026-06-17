/**
 * ChatPanel — Asha 聊天面板（增强版）
 *
 * 功能：
 * - 长按拖拽：长按（300ms）面板任意空白区域拖拽移动，碰壁弹回（12px 固定间距）
 * - 窗口调节：右下/右侧/下侧拖拽缩放（最小值 400×420，最大 = 窗口尺寸）
 * - 位置记忆：拖拽和关闭时自动保存，下次在相同位置出现
 * - 会话历史：侧边栏管理（新建/切换/重命名/删除）
 * - 模型 ID 下拉不截断，宽度自适应
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Send, Square, MessageCircle, Wrench, Check, KeyRound,
  ChevronDown, PanelLeftClose, PanelLeftOpen, Plus,
  GripVertical,
} from 'lucide-react';
import { chat, type ChatMessage, type ToolCall } from '../../lib/ai/client';
import { buildSystemPrompt } from '../../lib/ai/appContext';
import { TOOL_REGISTRY, coworkToolDefs, requiresConfirm, canExecuteTool } from '../../lib/ai/tools';
import { useChatStore, type ChatMode } from '../../store/chatStore';
import { useAIStore, getAIConfigByKey } from '../../store/aiStore';
import { useSettingsStore } from '../../store/settingsStore';
import { exportSessionAsMarkdown, downloadMarkdown } from '../../lib/export-chat';
import SessionSidebar from './SessionSidebar';

interface PendingConfirm {
  calls: ToolCall[];
  resolve: (approved: boolean) => void;
}

// ── 尺寸常量 ──────────────────────────────────────────────────────────
const MIN_W = 400;
const MIN_H = 420;
const DEF_W = 420;
const DEF_H = 480;
const CHAT_EDGE_GAP = 12; // 聊天面板距窗口边缘最小间距
const POS_KEY = 'todoapp-chat-pos';
const SIZE_KEY = 'todoapp-chat-size';

function clampPanelPos(x: number, y: number, w: number, h: number): { x: number; y: number } {
  const vw = window.innerWidth, vh = window.innerHeight;
  return {
    x: Math.max(CHAT_EDGE_GAP, Math.min(vw - w - CHAT_EDGE_GAP, x)),
    y: Math.max(CHAT_EDGE_GAP, Math.min(vh - h - CHAT_EDGE_GAP, y)),
  };
}

function loadPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p.x === 'number' && typeof p.y === 'number') return p;
    }
  } catch { /* 损坏则复位 */ }
  return { x: 0, y: 0 };
}

function loadSize(): { w: number; h: number } {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (typeof s.w === 'number' && typeof s.h === 'number') {
        return { w: Math.max(MIN_W, s.w), h: Math.max(MIN_H, s.h) };
      }
    }
  } catch { /* */ }
  return { w: DEF_W, h: DEF_H };
}

export default function ChatPanel() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  const {
    sessions, activeSessionId, isOpen,
    setIsOpen, newSession, switchSession, setSessionMode,
    appendMessage, markUnread, setAssistantBusy, deleteSession, renameSession,
  } = useChatStore();

  const { activeChatProviderId: activeProviderId, aiEnabled, providers } = useAIStore();

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [error, setError] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const session = sessions.find((s) => s.id === activeSessionId) ?? null;
  // 实时响应：每次 render 重新计算已启用供应商列表
  const configured = useMemo(() => {
    if (!aiEnabled) return [];
    const result: { providerId: string; model: string; name: string }[] = [];
    for (const p of providers) {
      if (!p.apiKey || !p.enabled) continue;
      const models = p.selectedModels && p.selectedModels.length > 0 ? p.selectedModels : (p.activeModel ? [p.activeModel] : []);
      for (const model of models) {
        result.push({ providerId: p.id, model, name: p.name });
      }
    }
    return result;
  }, [aiEnabled, providers]);
  const hasProvider = configured.length > 0;

  // 当前选中的 composite key = "providerId::model" — 同步 derived, 无缓存
  const [activeComposite, setActiveComposite] = useState<string>('');

  // 每次 configured 变化时立即同步：无可用模型则清空，否则保当前选中或切到第一个
  // useLayoutEffect 保证在 paint 前完成同步，用户看不到闪烁
  useLayoutEffect(() => {
    if (!hasProvider) {
      if (activeComposite !== '') setActiveComposite('');
      if (showModelPicker) setShowModelPicker(false);
      return;
    }
    const first = `${configured[0].providerId}::${configured[0].model}`;
    if (!activeComposite || !configured.some((c) => `${c.providerId}::${c.model}` === activeComposite)) {
      setActiveComposite(first);
    }
  }, [hasProvider, configured]);

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    };
    if (showModelPicker) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [showModelPicker]);

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
    const composite = activeComposite;
    const [provId, modelName] = composite ? composite.split('::') : [activeProviderId, ''];
    const modelLabel = modelName;
    const cfg = getAIConfigByKey(provId, modelName);
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
        { role: 'system', content: buildSystemPrompt(live.mode, lang, modelLabel) },
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
            ...cfg, tools: coworkToolDefs(activeComposite ?? undefined), maxTokens: 1600, signal: controller.signal,
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

          const writes = res.toolCalls.filter((tc) => {
            const reg = TOOL_REGISTRY[tc.name];
            return reg && composite && requiresConfirm(composite, reg.permissions, reg.alwaysConfirm);
          });
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
            } else if (composite && !canExecuteTool(composite, reg.permissions)) {
              result = JSON.stringify({ ok: false, denied: true });
            } else if (composite && requiresConfirm(composite, reg.permissions, reg.alwaysConfirm) && !approved) {
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

  // ── 位置 & 尺寸状态 ──────────────────────────────────────────────────
  const posRef = useRef(loadPos());
  const [panelPos, setPanelPos] = useState(loadPos());
  const [panelSize, setPanelSize] = useState<{ w: number; h: number }>(loadSize);
  const panelSizeRef = useRef(panelSize);
  panelSizeRef.current = panelSize;

  // 打开时：如果位置无效（超出视窗过远）则重算
  useLayoutEffect(() => {
    if (isOpen) {
      const vw = window.innerWidth, vh = window.innerHeight;
      let { x, y } = posRef.current;
      // 如果保存的位置完全不显示（在视窗外很远），回到右下默认
      if (x + 50 > vw || y + 50 > vh || x + panelSize.w < 50) {
        x = vw - panelSize.w - CHAT_EDGE_GAP - 6;
        y = vh - panelSize.h - CHAT_EDGE_GAP - 48;
      }
      const clamped = clampPanelPos(x, y, panelSize.w, panelSize.h);
      setPanelPos(clamped);
      posRef.current = clamped;
    }
  }, [isOpen]);

  // ── 全局长按拖拽（300ms 长按任意位置，或移动>5px 立即激活） ────────────
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragPosRef = useRef({ x: 0, y: 0 });

  const clearDragTimer = () => {
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current);
      dragTimerRef.current = null;
    }
  };

  const onPanelPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // 跳过交互元素：按钮、输入框、选择器、缩放手柄
    const target = e.target as HTMLElement;
    if (target.closest('button, input, textarea, select, [data-resize-handle]')) return;

    isDraggingRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    dragPosRef.current = { ...posRef.current };

    clearDragTimer();
    dragTimerRef.current = setTimeout(() => {
      isDraggingRef.current = true;
    }, 300);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        if (!isDraggingRef.current) {
          isDraggingRef.current = true;
          clearDragTimer();
        }
      }
      if (isDraggingRef.current) {
        const { w, h } = panelSizeRef.current;
        const newPos = clampPanelPos(
          dragPosRef.current.x + dx,
          dragPosRef.current.y + dy,
          w, h,
        );
        posRef.current = newPos;
        setPanelPos(newPos);
      }
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      clearDragTimer();
      if (isDraggingRef.current) {
        try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch { /* */ }
      }
      isDraggingRef.current = false;
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, []);

  // ── 缩放（边缘拖拽） ──────────────────────────────────────────────────
  const resizeRef = useRef<{ startW: number; startH: number; startX: number; startY: number; edge: string }>({
    startW: 0, startH: 0, startX: 0, startY: 0, edge: '',
  });

  const onResizeStart = useCallback((e: React.PointerEvent, edge: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = {
      startW: panelSize.w,
      startH: panelSize.h,
      startX: e.clientX,
      startY: e.clientY,
      edge,
    };
    const currentSize = { w: panelSize.w, h: panelSize.h };
    const vw = window.innerWidth, vh = window.innerHeight;
    const onMove = (ev: PointerEvent) => {
      const { startW, startH, startX, startY, edge } = resizeRef.current;
      let newW = startW + ev.clientX - startX;
      let newH = startH + ev.clientY - startY;
      if (edge.includes('r')) newW = Math.max(MIN_W, Math.min(vw - CHAT_EDGE_GAP * 2, newW));
      if (edge.includes('b')) newH = Math.max(MIN_H, Math.min(vh - CHAT_EDGE_GAP * 2, newH));
      currentSize.w = newW;
      currentSize.h = newH;
      setPanelSize({ w: newW, h: newH });
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      try { localStorage.setItem(SIZE_KEY, JSON.stringify(currentSize)); } catch { /* */ }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  }, [panelSize.w, panelSize.h]);

  // ── 会话历史侧边栏 ────────────────────────────────────────────────────
  const [showHistory, setShowHistory] = useState(false);

  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) {
      newSession(session?.mode ?? 'chat');
    }
    deleteSession(id);
    if (sessions.length <= 1) {
      setShowHistory(false);
    }
  };

  const handleNewSession = () => {
    const id = newSession(session?.mode ?? 'chat');
    appendMessage(id, { role: 'assistant', content: t('chat.greeting') });
    setShowHistory(false);
  };

  const handleExportSession = (sessionId: string) => {
    const s = sessions.find((s) => s.id === sessionId);
    if (!s) return;
    const md = exportSessionAsMarkdown(s, lang);
    downloadMarkdown(md, `asha-${s.title || 'chat'}.md`);
  };

  // ── Keyboard navigation ───────────────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        if (!showHistory) setShowHistory(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, showHistory]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          onPointerDown={onPanelPointerDown}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{    opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.22, ease: [0.2, 0.7, 0.3, 1] }}
          style={{
            position: 'fixed',
            left:  `${panelPos.x}px`,

            top: `${panelPos.y}px`,
            zIndex: 40,
            width: `${panelSize.w}px`,
            height: `${panelSize.h}px`,
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            transformOrigin: 'bottom right',
            overflow: 'hidden',
            /* glass morphism — matches claude design */
            background: 'var(--glass-bg)',
            backdropFilter: 'blur(20px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
            border: '0.5px solid var(--glass-border)',
            boxShadow: 'var(--shadow-float)',
            touchAction: 'none',        // 防止触摸时浏览器默认滚动/缩放
          }}
        >
          {/* ═══ Header (drag handle) ═══ */}
          <div
            className="flex items-center flex-shrink-0"
            style={{
              padding: '11px 12px',
              borderBottom: '0.5px solid var(--glass-border)',
              background: 'rgba(255,255,255,0.5)',
              gap: '10px',
              userSelect: 'none',
              minHeight: '48px',
            }}
          >
            {/* 会话历史 toggle */}
            <button
              onClick={(e) => { e.stopPropagation(); setShowHistory(!showHistory); }}
              className="flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
              title={lang === 'zh' ? '会话历史' : 'Chat history'}
              style={{
                padding: '4px',
                borderRadius: '6px',
                border: 'none',
                background: showHistory ? 'var(--color-bg-tertiary)' : 'transparent',
                color: 'var(--color-text-tertiary)',
                lineHeight: 1,
              }}
            >
              {showHistory ? <PanelLeftClose size={15} /> : <PanelLeftOpen size={15} />}
            </button>

            {/* 新对话 */}
            <button
              onClick={(e) => { e.stopPropagation(); handleNewSession(); }}
              className="flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
              title={lang === 'zh' ? '新对话' : 'New chat'}
              style={{
                padding: '4px',
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                color: 'var(--color-text-tertiary)',
                lineHeight: 1,
              }}
            >
              <Plus size={15} />
            </button>

            {/* Avatar + name */}
            <Avatar26 />
            <span
              style={{
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--clay)',
                whiteSpace: 'nowrap',
                flex: '0 0 auto',
              }}
            >
              {petName}
            </span>

            {/* Pill toggle — chat / cowork */}
            <div
              className="flex"
              style={{
                gap: '2px',
                padding: '2px',
                background: 'var(--color-bg-tertiary)',
                borderRadius: '8px',
                marginLeft: '2px',
              }}
            >
              {(['chat', 'cowork'] as ChatMode[]).map((m) => {
                const active = session?.mode === m;
                return (
                  <button
                    key={m}
                    onClick={(e) => { e.stopPropagation(); session && setSessionMode(session.id, m); }}
                    className="flex items-center cursor-pointer transition-all"
                    title={m === 'chat' ? t('chat.modeChatHint') : t('chat.modeCoworkHint')}
                    style={{
                      gap: '4px',
                      padding: '4px 9px',
                      borderRadius: '6px',
                      border: 'none',
                      font: 'inherit',
                      fontSize: '11.5px',
                      fontWeight: active ? 600 : 500,
                      whiteSpace: 'nowrap',
                      flex: '0 0 auto',
                      background: active ? 'var(--color-fill)' : 'transparent',
                      color: active ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)',
                    }}
                  >
                    {m === 'chat' ? <MessageCircle size={13} /> : <Wrench size={13} />}
                    {m === 'chat' ? t('chat.modeChat') : t('chat.modeCowork')}
                  </button>
                );
              })}
            </div>

            {/* Model chip — 自定义下拉菜单 */}
            <div ref={modelPickerRef} style={{ position: 'relative', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px', overflow: 'visible' }}>
              <div
                onClick={() => { if (hasProvider) setShowModelPicker((v) => !v); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '4px 9px 4px 7px',
                  borderRadius: '999px',
                  border: `0.5px solid ${showModelPicker ? 'var(--clay)' : 'var(--color-border)'}`,
                  background: showModelPicker ? 'var(--clay-light)' : 'var(--color-bg-secondary)',
                  cursor: hasProvider ? 'pointer' : 'default', userSelect: 'none', lineHeight: 1,
                  transition: 'all .14s',
                  maxWidth: '220px',
                  opacity: hasProvider ? 1 : 0.45,
                }}
              >
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                  background: hasProvider ? '#4FA46A' : 'var(--color-text-tertiary)',
                }} />
                <span style={{
                  fontSize: '11px', fontWeight: 500,
                  color: 'var(--color-text-secondary)',
                  maxWidth: '130px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {activeComposite ? activeComposite.split('::')[1] : (lang === 'zh' ? '无模型' : 'No model')}
                </span>
                <ChevronDown size={10} style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }} />
              </div>

              {/* 下拉列表 */}
              {showModelPicker && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 50,
                  minWidth: '210px', maxHeight: '240px', overflowY: 'auto',
                  background: 'var(--color-bg-secondary)',
                  border: '0.5px solid var(--color-border)',
                  borderRadius: '10px',
                  boxShadow: '0 6px 24px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)',
                  padding: '4px',
                }}>
                  {configured.map((c) => {
                    const key = `${c.providerId}::${c.model}`;
                    const active = key === activeComposite;
                    return (
                      <div
                        key={key}
                        onClick={() => { setActiveComposite(key); setShowModelPicker(false); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '6px',
                          padding: '6px 10px', borderRadius: '7px', cursor: 'pointer',
                          background: active ? 'var(--clay-light)' : 'transparent',
                          color: active ? 'var(--clay)' : 'var(--color-text-secondary)',
                          fontSize: '11.5px', fontWeight: active ? 600 : 400,
                          lineHeight: 1.3, transition: 'background .1s',
                        }}
                        onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-tertiary)'; }}
                        onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.model}
                        </span>
                        <span style={{
                          fontSize: '9.5px', color: active ? 'var(--clay)' : 'var(--color-text-tertiary)',
                          opacity: 0.6, flexShrink: 0, whiteSpace: 'nowrap',
                        }}>
                          {c.name}
                        </span>
                        {active && <Check size={10} style={{ flexShrink: 0, color: 'var(--clay)' }} />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Close */}
              <button
                onClick={() => {
                  try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch { /* */ }
                  try { localStorage.setItem(SIZE_KEY, JSON.stringify(panelSize)); } catch { /* */ }
                  setIsOpen(false);
                }}
                className="flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
                style={{
                  padding: '6px',
                  borderRadius: '7px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--color-text-tertiary)',
                  lineHeight: 1,
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                title={lang === 'zh' ? '最小化' : 'Minimize'}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* ═══ Body area: history sidebar + chat ───────────────── */}
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
            {/* 会话历史侧边栏 */}
            <AnimatePresence>
              {showHistory && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 240, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                  style={{ overflow: 'hidden', flexShrink: 0 }}
                >
                  <SessionSidebar
                    sessions={sessions}
                    activeSessionId={activeSessionId}
                    onSelectSession={(id) => { switchSession(id); setShowHistory(false); }}
                    onNewSession={handleNewSession}
                    onRenameSession={renameSession}
                    onDeleteSession={handleDeleteSession}
                    onExportSession={handleExportSession}
                    onClose={() => setShowHistory(false)}
                    lang={lang}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 聊天主区域 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              {/* Messages */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto"
                style={{
                  padding: '16px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                {!hasProvider ? (
                  <UnconfiguredCard lang={lang} />
                ) : (
                  <>
                    {session?.messages.map((m, i) => (
                      <MessageBubble key={m.id} role={m.role} content={m.content} toolTrace={m.toolTrace} index={i} />
                    ))}
                    {busy && !streamText && !pending && <TypingBubble />}
                    {busy && streamText && (
                      <MessageBubble role="assistant" content={streamText} streaming index={-1} />
                    )}
                    {pending && (
                      <ToolConfirmCard pending={pending} lang={lang} />
                    )}
                    {error && (
                      <span style={{ fontSize: '10px', color: '#e5484d', lineHeight: 1.5, wordBreak: 'break-all' }}>{error}</span>
                    )}
                  </>
                )}
              </div>

              {/* Input area */}
              {hasProvider && (
                <div
                  className="flex-shrink-0"
                  style={{
                    padding: '10px 12px 12px',
                    borderTop: '0.5px solid var(--glass-border)',
                    background: 'rgba(255,255,255,0.5)',
                  }}
                >
                  <div
                    className="flex items-end"
                    style={{
                      gap: '8px',
                      background: 'var(--color-bg-secondary)',
                      border: '0.5px solid var(--color-border)',
                      borderRadius: '13px',
                      padding: '6px 6px 6px 14px',
                      boxShadow: '0 1px 2px rgba(40,35,30,0.04)',
                    }}
                  >
                    <textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKey}
                      rows={1}
                      placeholder={session?.mode === 'cowork' ? t('chat.placeholderCowork') : t('chat.placeholder')}
                      className="flex-1 text-sm outline-none resize-none"
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: 'var(--color-text-primary)',
                        font: 'inherit',
                        fontSize: '13.5px',
                        lineHeight: 1.5,
                        padding: '5px 0',
                        maxHeight: '80px',
                        fontFamily: 'var(--font-family)',
                      }}
                    />
                    <button
                      onClick={busy ? stop : send}
                      disabled={!busy && !input.trim()}
                      className="flex items-center justify-center flex-shrink-0 cursor-pointer transition-all"
                      title={busy ? t('chat.stop') : t('chat.send')}
                      style={{
                        width: '34px',
                        height: '34px',
                        borderRadius: '9px',
                        border: 'none',
                        background: input.trim() || busy ? 'var(--clay)' : 'var(--color-accent-light)',
                        color: '#fff',
                        display: 'grid',
                        placeItems: 'center',
                        transition: 'background 0.14s',
                      }}
                    >
                      {busy ? <Square size={16} /> : <Send size={16} style={{ marginLeft: '-1px' }} />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── 缩放手柄（置于 overflow hidden 内部，贴在边框上） ── */}
          {/* 右侧手柄 */}
          <div
            data-resize-handle
            onPointerDown={(e) => onResizeStart(e, 'r')}
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0,
              width: '6px', cursor: 'ew-resize', zIndex: 5,
            }}
          />
          {/* 下侧手柄 */}
          <div
            data-resize-handle
            onPointerDown={(e) => onResizeStart(e, 'b')}
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: '6px', cursor: 'ns-resize', zIndex: 5,
            }}
          />
          {/* 右下角手柄 */}
          <div
            data-resize-handle
            onPointerDown={(e) => onResizeStart(e, 'rb')}
            style={{
              position: 'absolute', right: 0, bottom: 0,
              width: '16px', height: '16px', cursor: 'nwse-resize', zIndex: 6,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
              padding: '2px',
              color: 'var(--color-text-tertiary)',
              opacity: 0.4,
            }}
          >
            <GripVertical size={12} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Sub-components ──────────────────────────────────────────────────

/** Avatar — simplified snow-leopard face in a circular container (26px header version) */
function Avatar26() {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{
        width: '26px',
        height: '26px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 50% 35%, #fff, #ECE7E0)',
        border: '0.5px solid var(--color-border)',
      }}
    >
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
        <ellipse cx="12" cy="13" rx="7" ry="6.5" fill="#F4F1EC" />
        <path d="M6 7l2 3M18 7l-2 3" stroke="#D8D2C8" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="9.5" cy="12.5" r="1.1" fill="#3B7A5A" />
        <circle cx="14.5" cy="12.5" r="1.1" fill="#3B7A5A" />
        <path d="M11 15.4h2l-1 1z" fill="#C98B7A" />
        <circle cx="8" cy="16" r="0.7" fill="#D8D2C8" />
        <circle cx="16" cy="16" r="0.7" fill="#D8D2C8" />
      </svg>
    </div>
  );
}

/** Avatar — 22px version used in message bubbles */
function Avatar22() {
  return (
    <div
      className="flex items-center justify-center flex-shrink-0 overflow-hidden"
      style={{
        width: '22px',
        height: '22px',
        borderRadius: '50%',
        flex: '0 0 auto',
        background: 'radial-gradient(circle at 50% 35%, #fff, #ECE7E0)',
        border: '0.5px solid var(--color-border)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <ellipse cx="12" cy="13" rx="7" ry="6.5" fill="#F4F1EC" />
        <path d="M6 7l2 3M18 7l-2 3" stroke="#D8D2C8" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="9.5" cy="12.5" r="1.1" fill="#3B7A5A" />
        <circle cx="14.5" cy="12.5" r="1.1" fill="#3B7A5A" />
        <path d="M11 15.4h2l-1 1z" fill="#C98B7A" />
        <circle cx="8" cy="16" r="0.7" fill="#D8D2C8" />
        <circle cx="16" cy="16" r="0.7" fill="#D8D2C8" />
      </svg>
    </div>
  );
}

/** Message bubble — user / assistant */
function MessageBubble({ role, content, toolTrace, streaming, index }: {
  role: 'user' | 'assistant';
  content: string;
  toolTrace?: { name: string; summary: string }[];
  streaming?: boolean;
  index: number;
}) {
  const isUser = role === 'user';

  return (
    <div
      className="flex items-end"
      style={{
        gap: '8px',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        animation: `asha-msgIn 0.2s ease both`,
        animationDelay: `${Math.max(0, Math.min(index, 6)) * 40}ms`,
      }}
    >
      {!isUser && <Avatar22 />}
      <div className="flex flex-col" style={{ maxWidth: '78%', gap: '4px' }}>
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
            padding: '9px 13px',
            fontSize: '13.5px',
            lineHeight: 1.6,
            borderRadius: isUser ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
            backgroundColor: isUser ? 'var(--clay)' : 'var(--color-bg-secondary)',
            color: isUser ? '#fff' : 'var(--color-text-primary)',
            border: isUser ? 'none' : '0.5px solid var(--color-border)',
            boxShadow: isUser
              ? '0 2px 8px -2px rgba(217,119,87,0.4)'
              : '0 1px 2px rgba(40,35,30,0.04)',
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

/** Typing indicator — three jumping dots (dotJump animation) */
function TypingBubble() {
  return (
    <div className="flex items-end" style={{ gap: '8px' }}>
      <Avatar22 />
      <div
        className="flex items-center"
        style={{
          background: 'var(--color-bg-secondary)',
          border: '0.5px solid var(--color-border)',
          borderRadius: '4px 14px 14px 14px',
          padding: '12px 14px',
          gap: '4px',
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--color-text-tertiary)',
              animation: `asha-dotJump 1.2s ${i * 0.16}s infinite ease-in-out`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/** Tool confirmation card — appears before executing write operations */
function ToolConfirmCard({ pending, lang }: { pending: PendingConfirm; lang: 'zh' | 'en' }) {
  return (
    <div
      style={{
        borderRadius: '10px',
        border: '0.5px solid var(--clay)',
        backgroundColor: 'var(--clay-light)',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
      }}
    >
      <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--clay)' }}>
        {lang === 'zh' ? '确认操作' : 'Confirm Action'}
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
          style={{ gap: '4px', padding: '4px 14px', borderRadius: '6px', fontSize: '10px', fontWeight: 600, border: 'none', backgroundColor: 'var(--clay)', color: '#fff' }}
        >
          <Check size={10} />
          {lang === 'zh' ? '批准' : 'Approve'}
        </button>
        <button
          onClick={() => pending.resolve(false)}
          className="cursor-pointer"
          style={{ padding: '4px 12px', borderRadius: '6px', fontSize: '10px', border: '0.5px solid var(--glass-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}
        >
          {lang === 'zh' ? '拒绝' : 'Decline'}
        </button>
      </div>
    </div>
  );
}

/** Unconfigured state — centered card */
function UnconfiguredCard({ lang }: { lang: 'zh' | 'en' }) {
  const { setIsOpen: setSettingsOpen } = useSettingsStore();
  return (
    <div
      className="flex flex-col items-center justify-center flex-1"
      style={{
        textAlign: 'center',
        maxWidth: '240px',
        margin: 'auto',
      }}
    >
      <div
        style={{
          width: '56px',
          height: '56px',
          margin: '0 auto 14px',
          borderRadius: '14px',
          background: 'var(--clay-light)',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--clay)',
        }}
      >
        <KeyRound size={24} />
      </div>

      <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '6px', color: 'var(--color-text-primary)' }}>
        {lang === 'zh' ? '还没有可用的模型' : 'No models available'}
      </div>

      <div style={{ fontSize: '12.5px', color: 'var(--color-text-tertiary)', lineHeight: 1.6, marginBottom: '14px' }}>
        {lang === 'zh'
          ? '配置一个 AI 供应商后，阿夏就能陪你聊天、帮你拆解任务了。'
          : 'Add an AI provider to start chatting with Asha.'}
      </div>

      <button
        onClick={() => setSettingsOpen(true)}
        className="inline-flex items-center cursor-pointer transition-colors"
        style={{
          gap: '6px',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--clay)',
          textDecoration: 'none',
          padding: '8px 14px',
          borderRadius: '8px',
          background: 'var(--clay-light)',
          border: 'none',
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
      >
        {lang === 'zh' ? '前往设置 › AI 配置供应商' : 'Settings › AI Providers'}
        <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} />
      </button>
    </div>
  );
}

function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s); } catch { return {}; }
}
