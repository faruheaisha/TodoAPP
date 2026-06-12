/**
 * BreakdownPopover — AI 任务拆解弹层（挂在 TodoCard 行下方）
 *
 * 流程：挂载即调用 breakdownTodo → 预览清单（可勾选/可编辑）→ 确认写入子任务。
 * 沙盒原则：AI 输出只进入预览，经用户确认后才通过 subtaskStore 白名单 API 写入。
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, RotateCcw, Settings, Check } from 'lucide-react';
import { breakdownTodo } from '../lib/ai/workflows';
import { useSubtaskStore } from '../store/subtaskStore';
import { useSettingsStore } from '../store/settingsStore';

type Phase = 'loading' | 'ready' | 'error' | 'nokey';

export function BreakdownPopover({ todoId, title, onClose }: {
  todoId: string;
  title: string;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const addSubtask = useSubtaskStore((s) => s.addSubtask);
  const openSettings = useSettingsStore((s) => s.setIsOpen);

  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<{ text: string; checked: boolean }[]>([]);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  const run = async () => {
    setPhase('loading');
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const list = await breakdownTodo(title, lang, controller.signal);
      if (list.length === 0) throw new Error(lang === 'zh' ? '未能解析出子任务' : 'No subtasks parsed');
      setItems(list.map((text) => ({ text, checked: true })));
      setPhase('ready');
    } catch (e) {
      if (controller.signal.aborted) return;
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'NO_API_KEY') { setPhase('nokey'); return; }
      setError(msg);
      setPhase('error');
    }
  };

  useEffect(() => {
    run();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = () => {
    items.filter((it) => it.checked && it.text.trim()).forEach((it) => addSubtask(todoId, it.text.trim()));
    onClose();
  };

  return (
    <div
      style={{
        position: 'absolute', top: '100%', right: 'var(--pad-x)', zIndex: 200,
        width: '300px', borderRadius: '10px',
        border: '0.5px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-primary)',
        boxShadow: 'var(--shadow-md)',
        padding: '12px',
        display: 'flex', flexDirection: 'column', gap: '9px',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 头 */}
      <div className="flex items-center" style={{ gap: '6px' }}>
        <Sparkles size={12} style={{ color: 'var(--clay)' }} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {t('breakdown.title')}
        </span>
        <button onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', fontSize: '12px', lineHeight: 1 }}>×</button>
      </div>

      {phase === 'loading' && (
        <div className="flex items-center justify-center" style={{ gap: '8px', padding: '18px 0', color: 'var(--color-text-tertiary)', fontSize: '11px' }}>
          <Loader2 size={13} className="animate-spin" style={{ color: 'var(--clay)' }} />
          {t('breakdown.thinking')}
        </div>
      )}

      {phase === 'nokey' && (
        <div className="flex flex-col items-center" style={{ gap: '8px', padding: '12px 0' }}>
          <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', textAlign: 'center', lineHeight: 1.6 }}>
            {t('breakdown.noKey')}
          </span>
          <button
            onClick={() => {
              onClose();
              openSettings(true);
              // 等抽屉挂载后直达 AI 实验室页
              setTimeout(() => window.dispatchEvent(new CustomEvent('open-settings-nav', { detail: 'ai' })), 80);
            }}
            className="flex items-center cursor-pointer"
            style={{ gap: '5px', padding: '5px 12px', borderRadius: '6px', fontSize: '10px', border: 'none', backgroundColor: 'var(--clay)', color: 'var(--ivory-light, #fff)' }}
          >
            <Settings size={11} />
            {t('breakdown.goSettings')}
          </button>
        </div>
      )}

      {phase === 'error' && (
        <div className="flex flex-col" style={{ gap: '8px', padding: '6px 0' }}>
          <span style={{ fontSize: '10px', color: '#e5484d', lineHeight: 1.5, wordBreak: 'break-all' }}>
            {error}
          </span>
          <button
            onClick={run}
            className="flex items-center self-start cursor-pointer"
            style={{ gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '10px', border: '0.5px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-secondary)' }}
          >
            <RotateCcw size={10} />
            {t('breakdown.retry')}
          </button>
        </div>
      )}

      {phase === 'ready' && (
        <>
          <div className="flex flex-col" style={{ gap: '3px', maxHeight: '200px', overflowY: 'auto' }}>
            {items.map((item, i) => (
              <div key={i} className="flex items-center" style={{ gap: '7px' }}>
                <button
                  onClick={() => setItems((prev) => prev.map((it, j) => j === i ? { ...it, checked: !it.checked } : it))}
                  className="flex items-center justify-center flex-shrink-0 cursor-pointer"
                  style={{
                    width: '13px', height: '13px', borderRadius: '3px',
                    border: '1.5px solid ' + (item.checked ? 'var(--clay)' : 'var(--color-checkbox-border)'),
                    backgroundColor: item.checked ? 'var(--clay)' : 'transparent',
                  }}
                >
                  {item.checked && (
                    <svg width="7" height="5" viewBox="0 0 7 5" fill="none">
                      <path d="M1 2.5L2.8 4.2L6 1" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
                <input
                  type="text"
                  value={item.text}
                  onChange={(e) => setItems((prev) => prev.map((it, j) => j === i ? { ...it, text: e.target.value } : it))}
                  className="flex-1 text-xs outline-none bg-transparent"
                  style={{
                    color: item.checked ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)',
                    border: 'none', padding: '3px 0',
                    textDecoration: item.checked ? 'none' : 'line-through',
                  }}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center" style={{ gap: '6px' }}>
            <button
              onClick={confirm}
              disabled={!items.some((it) => it.checked)}
              className="flex items-center cursor-pointer"
              style={{
                gap: '5px', padding: '5px 14px', borderRadius: '6px', fontSize: '10px', fontWeight: 600,
                border: 'none', backgroundColor: 'var(--clay)', color: 'var(--ivory-light, #fff)',
                opacity: items.some((it) => it.checked) ? 1 : 0.5,
              }}
            >
              <Check size={11} />
              {t('breakdown.confirm', { count: items.filter((it) => it.checked).length })}
            </button>
            <button
              onClick={run}
              className="flex items-center cursor-pointer"
              title={t('breakdown.retry')}
              style={{ gap: '4px', padding: '5px 9px', borderRadius: '6px', fontSize: '10px', border: '0.5px solid var(--color-border)', backgroundColor: 'transparent', color: 'var(--color-text-tertiary)' }}
            >
              <RotateCcw size={10} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
