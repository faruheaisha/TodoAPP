import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore, type Priority } from '../store/todoStore';
import { useRecurrenceStore, RECURRENCE_OPTIONS, type RecurrenceType } from '../store/recurrenceStore';
import { useTagStore, TAG_PALETTE } from '../store/tagStore';
import { TagChip } from './TagChip';
import DatePicker from './DatePicker';
import { parseNLP } from '../lib/nlpDate';
import { PRIORITY_META, priorityColor, priorityLabel } from '../lib/priority';
import { useIsTouch } from '../lib/responsive';
import { useAIStore } from '../store/aiStore';
import { classifyTodo } from '../lib/ai/workflows';

/* ─── 内联 SVG 图标 ─── */
const PlusIcon = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 2v11M2 7.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const FlagIcon = ({ filled, color }: { filled?: boolean; color?: string }) => (
  <svg width="11" height="11" viewBox="0 0 15 15" fill="none">
    <path d="M2.5 13V2.5h6l1 2h3V9h-5l-1-2H2.5" stroke={color || 'currentColor'} strokeWidth="1.3" strokeLinejoin="round" fill={filled ? (color || 'currentColor') : 'none'} />
  </svg>
);

const RepeatIcon = () => (
  <svg width="11" height="11" viewBox="0 0 15 15" fill="none">
    <path d="M11.5 3.5H5a3 3 0 000 6h2m4-6l-2-2m2 2l-2 2m-5 5H10a3 3 0 000-6H8m-4 6l2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CalendarIcon = ({ size = 11 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M1.5 5.5h12M4.5 1v3m6-3v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const SparklesIcon = () => (
  <svg width="10" height="10" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 1l1.1 3.4L12 5.5l-3.4 1.1L7.5 10 6.4 6.6 3 5.5l3.4-1.1L7.5 1z" fill="currentColor" stroke="none" />
  </svg>
);

const SunIcon = () => (
  <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
    <circle cx="7.5" cy="7.5" r="3" stroke="currentColor" strokeWidth="1.3" />
    <path d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2M3 3l1.5 1.5M10.5 10.5L12 12M12 3l-1.5 1.5M4.5 10.5L3 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const BriefcaseIcon = () => (
  <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="4.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M5 4.5v-2a1 1 0 011-1h3a1 1 0 011 1v2" stroke="currentColor" strokeWidth="1.3" />
  </svg>
);

const CalendarDaysIcon = () => (
  <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M1.5 5.5h12M4.5 1v3m6-3v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <circle cx="5" cy="9" r=".5" fill="currentColor" />
    <circle cx="7.5" cy="9" r=".5" fill="currentColor" />
    <circle cx="10" cy="9" r=".5" fill="currentColor" />
  </svg>
);

const CalendarRangeIcon = () => (
  <svg width="12" height="12" viewBox="0 0 15 15" fill="none">
    <rect x="1.5" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
    <path d="M1.5 5.5h12M4.5 1v3m6-3v3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    <path d="M3.5 8.5h8M3.5 10.5h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);

const TagGridIcon = () => (
  <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
    <rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <rect x="8" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <rect x="1" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    <rect x="8" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

/* ─── 重复类型 → 图标映射 ─── */
const RECURRENCE_ICON_MAP: Record<string, React.FC> = {
  daily: SunIcon,
  weekdays: BriefcaseIcon,
  weekly: CalendarDaysIcon,
  monthly: CalendarRangeIcon,
};

/* ─── Tab button (Linear Composer style) ─── */
function TypeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        appearance: 'none',
        border: 'none',
        cursor: 'pointer',
        font: 'inherit',
        fontSize: 13,
        fontWeight: active ? 600 : 500,
        padding: '6px 12px',
        borderRadius: 7,
        transition: 'all .14s',
        whiteSpace: 'nowrap',
        lineHeight: 1,
        background: active ? 'var(--clay)' : 'transparent',
        color: active ? '#fff' : 'var(--color-text-tertiary)',
      }}
    >
      {children}
    </button>
  );
}

export default function AddTodoBar() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const { addTodo } = useTodoStore();
  const { setRule } = useRecurrenceStore();
  const { tags, addTag, addTagToTodo } = useTagStore();
  const aiEnabled = useAIStore((s) => s.aiEnabled);

  const isTouch = useIsTouch();
  const [title, setTitle] = useState('');
  const [todoType, setTodoType] = useState<'quick' | 'longterm'>('quick');
  const [deadline, setDeadline] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceType | ''>('');
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [priority, setPriority] = useState<Priority>(0);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // EmptyState 的引导按钮触发：聚焦标题输入框
  useEffect(() => {
    const handler = () => titleInputRef.current?.focus();
    window.addEventListener('focus-add-input', handler);
    return () => window.removeEventListener('focus-add-input', handler);
  }, []);

  // NLP 解析结果
  const [nlpHint, setNlpHint] = useState<string | null>(null);
  const [nlpDeadline, setNlpDeadline] = useState<string | null>(null);

  // 实时 NLP 解析
  useEffect(() => {
    if (!title.trim()) { setNlpHint(null); setNlpDeadline(null); return; }
    const result = parseNLP(title);
    if (result.deadline && result.deadline !== deadline) {
      setNlpHint(result.hint);
      setNlpDeadline(result.deadline);
    } else {
      setNlpHint(null);
      setNlpDeadline(null);
    }
  }, [title]);

  // 接受 NLP 建议
  const acceptNLP = () => {
    if (!nlpDeadline) return;
    const result = parseNLP(title);
    setTitle(result.title);
    setDeadline(nlpDeadline);
    setTodoType('longterm');
    setNlpHint(null);
    setNlpDeadline(null);
  };

  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return;
    // 若有 NLP 结果且用户未手动拒绝，自动应用
    let finalTitle = title.trim();
    let finalDeadline = todoType === 'longterm' && deadline ? deadline : null;
    if (nlpDeadline && !deadline) {
      const result = parseNLP(title);
      finalTitle = result.title;
      finalDeadline = nlpDeadline;
    }
    await addTodo(finalTitle, finalDeadline ? 'longterm' : todoType, finalDeadline, priority).catch(console.error);
    const { useTodoStore: store } = await import('../store/todoStore');
    const todos = store.getState().todos;
    const latest = [...todos].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    if (latest) {
      if (recurrence) setRule(latest.id, { type: recurrence });
      selectedTagIds.forEach(tid => addTagToTodo(latest.id, tid));

      // 启用 AI 时：用户未手动分类/定优先级则后台静默智能分类（不阻塞 UI，失败静默）
      if (aiEnabled && selectedTagIds.length === 0) {
        const todoId = latest.id;
        const todoTitle = finalTitle;
        const userPriority = priority;
        void (async () => {
          try {
            const ts = useTagStore.getState();
            const { tags: suggested, priority: aiPriority } = await classifyTodo(
              todoTitle, ts.tags.map(t => t.name), lang
            );
            for (const name of suggested) {
              const trimmed = name.trim();
              if (!trimmed) continue;
              const found = ts.tags.find(t => t.name.toLowerCase() === trimmed.toLowerCase());
              const tag = found ?? ts.addTag(trimmed, TAG_PALETTE[ts.tags.length % TAG_PALETTE.length]);
              ts.addTagToTodo(todoId, tag.id);
            }
            if (userPriority === 0 && aiPriority > 0) {
              await useTodoStore.getState().setPriority(todoId, aiPriority as Priority);
            }
          } catch { /* 无 API Key 或网络失败：静默跳过 */ }
        })();
      }
    }
    setTitle('');
    setDeadline('');
    setRecurrence('');
    setSelectedTagIds([]);
    setPriority(0);
    setShowRecurrencePicker(false);
    setShowTagPicker(false);
    setShowPriorityPicker(false);
    setShowDatePicker(false);
    setNlpHint(null);
    setNlpDeadline(null);
  }, [title, todoType, deadline, recurrence, selectedTagIds, priority, nlpDeadline, addTodo, setRule, addTagToTodo, aiEnabled, lang]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (nlpDeadline && !deadline) acceptNLP();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setNlpHint(null); setNlpDeadline(null);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  return (
    <div
      className="border-b flex-shrink-0"
      style={{
        borderColor: 'var(--color-border)',
        backgroundColor: 'var(--color-bg-primary)',
        padding: '7px var(--pad-x)',
      }}
    >
      {/* ─── 主行：Tab 组 + 输入框 ─── */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, height: 'var(--input-row-h)' }}>
        {/* Tab 容器 */}
        <div
          style={{
            display: 'flex',
            gap: 2,
            padding: 3,
            background: '#fff',
            border: '0.5px solid var(--color-border)',
            borderRadius: 10,
            flexShrink: 0,
            alignItems: 'center',
          }}
        >
          <TypeBtn active={todoType === 'quick'} onClick={() => setTodoType('quick')}>
            {t('app.quick')}
          </TypeBtn>
          <TypeBtn active={todoType === 'longterm'} onClick={() => setTodoType('longterm')}>
            {t('app.longterm')}
          </TypeBtn>
        </div>

        {/* 输入框容器 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            marginLeft: 8,
            background: '#fff',
            border: '0.5px solid ' + (inputFocused ? 'var(--clay)' : 'var(--color-border)'),
            borderRadius: 10,
            padding: '0 6px 0 14px',
            transition: 'all .16s',
            boxShadow: inputFocused ? '0 0 0 3px rgba(217,119,87,.12)' : 'none',
          }}
        >
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={lang === 'zh' ? '输入任务… 支持「明天下午3点」等自然语言' : 'Add task… try "tomorrow at 3pm"'}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              font: 'inherit',
              fontSize: 14,
              color: 'var(--color-text-primary)',
              padding: '12px 0',
            }}
          />
          <button
            onClick={handleSubmit}
            style={{
              appearance: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: 'var(--clay)',
              color: '#fff',
              fontSize: 13.5,
              fontWeight: 600,
              padding: '8px 16px',
              borderRadius: 7,
              flexShrink: 0,
              lineHeight: 1,
            }}
          >
            <PlusIcon />
            {t('app.addButton')}
          </button>
        </div>
      </div>

      {/* ─── Meta Chips 行 ─── */}
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 8, position: 'relative' }}>

        {/* 优先级 */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowPriorityPicker(v => !v); setShowRecurrencePicker(false); setShowTagPicker(false); setShowDatePicker(false); }}
            className="linear-ghost-btn"
            style={{
              color: priority > 0 ? priorityColor(priority) : undefined,
            }}
          >
            <FlagIcon filled={priority > 0} color={priority > 0 ? priorityColor(priority) : undefined} />
            {priority > 0 ? priorityLabel(priority, lang) : (lang === 'zh' ? '优先级' : 'Priority')}
          </button>
          {showPriorityPicker && (
            <div style={{ position: 'absolute', top: '30px', left: 0, zIndex: 100, borderRadius: 7, border: '0.5px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)', boxShadow: 'var(--shadow-md)', minWidth: 120, padding: 2 }}>
              {PRIORITY_META.map(meta => (
                <button
                  key={meta.value}
                  onClick={() => { setPriority(meta.value); setShowPriorityPicker(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 10px', fontSize: 12,
                    cursor: 'pointer', borderRadius: 5, textAlign: 'left',
                    color: priority === meta.value ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    backgroundColor: priority === meta.value ? 'var(--color-bg-tertiary)' : 'transparent',
                    border: 'none', lineHeight: 1,
                  }}
                  onMouseEnter={e => { if (priority !== meta.value) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                  onMouseLeave={e => { if (priority !== meta.value) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <FlagIcon filled={meta.value > 0} color={meta.color} />
                  <span style={{ color: meta.color }}>{lang === 'zh' ? meta.labelZh : meta.labelEn}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 重复规则 */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowRecurrencePicker(v => !v); setShowTagPicker(false); setShowPriorityPicker(false); setShowDatePicker(false); }}
            className="linear-ghost-btn"
          >
            <RepeatIcon />
            {recurrence
              ? (RECURRENCE_OPTIONS.find(o => o.type === recurrence)?.[lang === 'zh' ? 'labelZh' : 'labelEn'] ?? recurrence)
              : (lang === 'zh' ? '不重复' : 'No repeat')}
          </button>
          {showRecurrencePicker && (
            <div style={{ position: 'absolute', top: '30px', left: 0, zIndex: 100, borderRadius: 7, border: '0.5px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)', boxShadow: 'var(--shadow-md)', minWidth: 130 }}>
              <button
                onClick={() => { setRecurrence(''); setShowRecurrencePicker(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 12px', fontSize: 12,
                  cursor: 'pointer', textAlign: 'left', lineHeight: 1,
                  color: !recurrence ? 'var(--clay)' : 'var(--color-text-secondary)',
                  backgroundColor: 'transparent', border: 'none',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >{lang === 'zh' ? '不重复' : 'No repeat'}</button>
              {RECURRENCE_OPTIONS.map(opt => {
                const RecurrenceIcon = RECURRENCE_ICON_MAP[opt.type] ?? RepeatIcon;
                return (
                  <button
                    key={opt.type}
                    onClick={() => { setRecurrence(opt.type); setShowRecurrencePicker(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '5px 12px', fontSize: 12,
                      cursor: 'pointer', textAlign: 'left', lineHeight: 1,
                      color: recurrence === opt.type ? 'var(--clay)' : 'var(--color-text-secondary)',
                      backgroundColor: 'transparent', border: 'none',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                  >
                    <RecurrenceIcon />
                    {lang === 'zh' ? opt.labelZh : opt.labelEn}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 标签 */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowTagPicker(v => !v); setShowRecurrencePicker(false); setShowPriorityPicker(false); setShowDatePicker(false); }}
            className="linear-ghost-btn"
          >
            <TagGridIcon />
            {selectedTagIds.length > 0
              ? (lang === 'zh' ? `${selectedTagIds.length} 个标签` : `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? 's' : ''}`)
              : (lang === 'zh' ? '添加标签' : 'Add tags')}
          </button>
          {showTagPicker && (
            <div style={{ position: 'absolute', top: '30px', left: 0, zIndex: 100, borderRadius: 8, border: '0.5px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)', boxShadow: 'var(--shadow-md)', minWidth: 170, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {tags.map(tag => (
                    <TagChip key={tag.id} tag={tag} size="sm" active={selectedTagIds.includes(tag.id)} onClick={() => toggleTag(tag.id)} />
                  ))}
                </div>
              )}
              <input
                autoFocus={tags.length === 0}
                type="text"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newTagName.trim()) {
                    const color = TAG_PALETTE[tags.length % TAG_PALETTE.length];
                    const tag = addTag(newTagName.trim(), color);
                    setSelectedTagIds(prev => [...prev, tag.id]);
                    setNewTagName('');
                  }
                  if (e.key === 'Escape') setShowTagPicker(false);
                }}
                placeholder={lang === 'zh' ? '新建标签 Enter 确认…' : 'New tag, Enter…'}
                style={{ fontSize: 10, padding: '4px 8px', background: 'var(--color-bg-tertiary)', border: '0.5px solid var(--color-border)', borderRadius: 5, color: 'var(--color-text-primary)', outline: 'none', width: '100%' }}
              />
            </div>
          )}
        </div>

        {/* 已选标签预览 */}
        {selectedTagIds.map(tid => {
          const tag = tags.find(t => t.id === tid);
          if (!tag) return null;
          return <TagChip key={tid} tag={tag} size="xs" onRemove={() => setSelectedTagIds(prev => prev.filter(id => id !== tid))} />;
        })}
      </div>

      {/* ─── NLP 解析提示 + 截止日期 ─── */}
      {nlpHint && nlpDeadline && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 6,
            overflow: 'hidden',
            opacity: 1,
            transition: 'opacity .15s',
          }}
        >
          <SparklesIcon />
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
            {lang === 'zh' ? '识别到截止时间：' : 'Detected deadline: '}
          </span>
          <button
            onClick={acceptNLP}
            style={{
              fontSize: 10, padding: '1px 8px', borderRadius: 10,
              backgroundColor: 'var(--clay-light)', color: 'var(--clay)',
              border: '0.5px solid var(--clay)', cursor: 'pointer', fontWeight: 600, lineHeight: '16px',
            }}
          >{nlpHint}</button>
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)' }}>
            {lang === 'zh' ? '← 点击应用，Enter 直接确认' : '← click to apply, Enter to confirm'}
          </span>
          <button
            onClick={() => { setNlpHint(null); setNlpDeadline(null); }}
            style={{ marginLeft: 'auto', fontSize: 11, background: 'none', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', lineHeight: 1 }}
          >x</button>
        </div>
      )}

      {/* ─── Deadline picker — 仅 longterm ─── */}
      {todoType === 'longterm' && (
        <div style={{ marginTop: 6, position: 'relative' }}>
          <div
            onClick={() => { setShowDatePicker(v => !v); setShowRecurrencePicker(false); setShowTagPicker(false); setShowPriorityPicker(false); }}
            style={{
              display: 'flex', alignItems: 'center', cursor: 'pointer',
              height: isTouch ? 40 : 26, padding: '0 10px', borderRadius: 7,
              border: '0.5px solid ' + (deadline ? 'var(--clay)' : 'var(--color-border)'),
              backgroundColor: deadline ? 'var(--clay-light)' : 'transparent',
              gap: 6, userSelect: 'none', transition: 'all .14s',
              color: deadline ? 'var(--clay)' : 'var(--color-text-tertiary)',
              fontSize: 12,
            }}
            onMouseEnter={e => { if (!deadline) (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
            onMouseLeave={e => { if (!deadline) (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <CalendarIcon size={12} />
            <span style={{ flex: 1, color: deadline ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)', fontSize: 12 }}>
              {deadline
                ? new Date(deadline).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : t('app.deadline')}
            </span>
            {deadline && (
              <button
                onClick={(e) => { e.stopPropagation(); setDeadline(''); }}
                style={{
                  width: 14, height: 14, borderRadius: '50%',
                  backgroundColor: 'var(--color-bg-tertiary)', border: 'none',
                  cursor: 'pointer', flexShrink: 0, color: 'var(--color-text-tertiary)',
                  fontSize: 10, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >x</button>
            )}
          </div>
          {showDatePicker && (
            <DatePicker
              value={deadline}
              onChange={setDeadline}
              onClose={() => setShowDatePicker(false)}
              lang={lang}
            />
          )}
        </div>
      )}
    </div>
  );
}
