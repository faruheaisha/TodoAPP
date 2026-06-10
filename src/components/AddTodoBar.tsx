import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useTodoStore } from '../store/todoStore';
import { useRecurrenceStore, RECURRENCE_OPTIONS, type RecurrenceType } from '../store/recurrenceStore';
import { useTagStore, TAG_PALETTE } from '../store/tagStore';
import { TagChip } from './TagChip';
import { parseNLP } from '../lib/nlpDate';
import { useIsTouch } from '../lib/responsive';
import { Plus, Calendar, Repeat, Sparkles } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function AddTodoBar() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';
  const { addTodo } = useTodoStore();
  const { setRule } = useRecurrenceStore();
  const { tags, addTag, addTagToTodo } = useTagStore();

  const isTouch = useIsTouch();
  const [title, setTitle] = useState('');
  const [todoType, setTodoType] = useState<'quick' | 'longterm'>('quick');
  const [deadline, setDeadline] = useState('');
  const [recurrence, setRecurrence] = useState<RecurrenceType | ''>('');
  const [showRecurrencePicker, setShowRecurrencePicker] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const deadlineInputRef = useRef<HTMLInputElement>(null);

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
    await addTodo(finalTitle, finalDeadline ? 'longterm' : todoType, finalDeadline).catch(console.error);
    const { useTodoStore: store } = await import('../store/todoStore');
    const todos = store.getState().todos;
    const latest = [...todos].sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];
    if (latest) {
      if (recurrence) setRule(latest.id, { type: recurrence });
      selectedTagIds.forEach(tid => addTagToTodo(latest.id, tid));
    }
    setTitle('');
    setDeadline('');
    setRecurrence('');
    setSelectedTagIds([]);
    setShowRecurrencePicker(false);
    setShowTagPicker(false);
    setNlpHint(null);
    setNlpDeadline(null);
  }, [title, todoType, deadline, recurrence, selectedTagIds, nlpDeadline, addTodo, setRule, addTagToTodo]);

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
      {/* 主输入行 */}
      <div className="flex items-stretch" style={{ gap: 0, height: 'var(--input-row-h)' }}>
        {/* Type selector */}
        <div
          className="flex items-stretch overflow-hidden flex-shrink-0"
          style={{ border: '0.5px solid var(--color-border)', borderRight: 'none', borderRadius: '5px 0 0 5px' }}
        >
          <TypeBtn active={todoType === 'quick'} onClick={() => setTodoType('quick')}>
            <span className="type-btn-long">{t('app.quick')}</span>
          </TypeBtn>
          <TypeBtn active={todoType === 'longterm'} onClick={() => setTodoType('longterm')}>
            <span className="type-btn-long">{t('app.longterm')}</span>
          </TypeBtn>
        </div>

        {/* Input field */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={lang === 'zh' ? '输入任务… 支持「明天下午3点」等自然语言' : 'Add task… try "tomorrow at 3pm"'}
            className="w-full h-full text-sm outline-none transition-colors"
            style={{
              backgroundColor: 'var(--color-bg-input)',
              color: 'var(--color-text-secondary)',
              border: '0.5px solid var(--color-border)',
              borderRight: 'none', borderLeft: 'none',
              padding: '5px 9px',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-border-hover)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-border)'; }}
          />
        </div>

        {/* Add button */}
        <button
          onClick={handleSubmit}
          className="flex items-center justify-center font-medium transition-colors flex-shrink-0"
          style={{
            padding: '5px 12px', backgroundColor: 'var(--color-fill)', color: 'var(--color-fill-text)',
            border: 'none', borderRadius: '0 5px 5px 0', cursor: 'pointer', fontSize: '11px', gap: '4px',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--clay)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-fill)'; }}
        >
          <Plus size={15} />
          <span className="add-btn-text">{t('app.addButton')}</span>
        </button>
      </div>

      {/* NLP 解析提示条 */}
      <AnimatePresence>
        {nlpHint && nlpDeadline && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="flex items-center"
            style={{ gap: '6px', marginTop: '4px', overflow: 'hidden' }}
          >
            <Sparkles size={10} style={{ color: 'var(--clay)', flexShrink: 0 }} />
            <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
              {lang === 'zh' ? '识别到截止时间：' : 'Detected deadline: '}
            </span>
            <button
              onClick={acceptNLP}
              style={{
                fontSize: '10px', padding: '1px 8px', borderRadius: '10px',
                backgroundColor: 'var(--clay-light)', color: 'var(--clay)',
                border: '0.5px solid var(--clay)', cursor: 'pointer', fontWeight: 600,
              }}
            >{nlpHint}</button>
            <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
              {lang === 'zh' ? '← 点击应用，Enter 直接确认' : '← click to apply, Enter to confirm'}
            </span>
            <button
              onClick={() => { setNlpHint(null); setNlpDeadline(null); }}
              style={{ marginLeft: 'auto', fontSize: '11px', background: 'none', border: 'none', color: 'var(--color-text-tertiary)', cursor: 'pointer', lineHeight: 1 }}
            >×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Deadline picker */}
      {todoType === 'longterm' && (
        <div className="mt-1.5" style={{ position: 'relative' }}>
          <div
            onClick={() => deadlineInputRef.current?.showPicker?.()}
            className="flex items-center cursor-pointer transition-colors"
            style={{
              height: isTouch ? '40px' : '28px', padding: '0 10px', borderRadius: '5px',
              border: '0.5px solid ' + (deadline ? 'var(--clay)' : 'var(--color-border)'),
              backgroundColor: 'var(--color-bg-input)', gap: '7px', userSelect: 'none',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = deadline ? 'var(--clay)' : 'var(--color-border-hover)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = deadline ? 'var(--clay)' : 'var(--color-border)'; }}
          >
            <Calendar size={12} style={{ color: deadline ? 'var(--clay)' : 'var(--color-text-tertiary)', flexShrink: 0 }} />
            <span className="text-xs flex-1" style={{ color: deadline ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)' }}>
              {deadline
                ? new Date(deadline).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                : t('app.deadline')}
            </span>
            {deadline && (
              <button
                onClick={(e) => { e.stopPropagation(); setDeadline(''); }}
                className="flex items-center justify-center"
                style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'var(--color-bg-tertiary)', border: 'none', cursor: 'pointer', flexShrink: 0, color: 'var(--color-text-tertiary)', fontSize: '10px', lineHeight: 1 }}
              >×</button>
            )}
          </div>
          <input ref={deadlineInputRef} type="datetime-local" value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, opacity: 0, pointerEvents: 'none', border: 'none' }}
            tabIndex={-1}
          />
        </div>
      )}

      {/* 底部工具栏：重复规则 + 标签 */}
      <div className="mt-1.5 flex items-center flex-wrap" style={{ gap: '6px', position: 'relative' }}>
        {/* 重复规则 */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowRecurrencePicker((v) => !v); setShowTagPicker(false); }}
            className="flex items-center transition-colors cursor-pointer"
            style={{
              height: isTouch ? '36px' : '24px', padding: isTouch ? '0 14px' : '0 9px', gap: '5px', borderRadius: '5px',
              border: '0.5px solid', borderColor: recurrence ? 'var(--clay)' : 'var(--color-border)',
              backgroundColor: recurrence ? 'var(--clay-light)' : 'transparent',
              fontSize: isTouch ? '12px' : '10px', color: recurrence ? 'var(--clay)' : 'var(--color-text-tertiary)',
            }}
          >
            <Repeat size={10} />
            {recurrence
              ? (RECURRENCE_OPTIONS.find(o => o.type === recurrence)?.[lang === 'zh' ? 'labelZh' : 'labelEn'] ?? recurrence)
              : (lang === 'zh' ? '不重复' : 'No repeat')}
          </button>
          {showRecurrencePicker && (
            <div className="absolute flex flex-col overflow-hidden" style={{ top: '26px', left: 0, zIndex: 100, borderRadius: '7px', border: '0.5px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', minWidth: '120px' }}>
              <button onClick={() => { setRecurrence(''); setShowRecurrencePicker(false); }}
                className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer"
                style={{ color: !recurrence ? 'var(--clay)' : 'var(--color-text-secondary)', backgroundColor: 'transparent', border: 'none', textAlign: 'left' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
              >{lang === 'zh' ? '不重复' : 'No repeat'}</button>
              {RECURRENCE_OPTIONS.map(opt => (
                <button key={opt.type} onClick={() => { setRecurrence(opt.type); setShowRecurrencePicker(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs cursor-pointer"
                  style={{ color: recurrence === opt.type ? 'var(--clay)' : 'var(--color-text-secondary)', backgroundColor: 'transparent', border: 'none', textAlign: 'left' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--color-bg-tertiary)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <span>{opt.icon}</span>{lang === 'zh' ? opt.labelZh : opt.labelEn}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 标签选择器 */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowTagPicker((v) => !v); setShowRecurrencePicker(false); }}
            className="flex items-center transition-colors cursor-pointer"
            style={{
              height: isTouch ? '36px' : '24px', padding: isTouch ? '0 14px' : '0 9px', gap: '5px', borderRadius: '5px',
              border: '0.5px solid', borderColor: selectedTagIds.length ? 'var(--clay)' : 'var(--color-border)',
              backgroundColor: selectedTagIds.length ? 'var(--clay-light)' : 'transparent',
              fontSize: isTouch ? '12px' : '10px', color: selectedTagIds.length ? 'var(--clay)' : 'var(--color-text-tertiary)',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="8" y="1" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="1" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
              <rect x="8" y="8" width="5" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.4"/>
            </svg>
            {selectedTagIds.length > 0
              ? (lang === 'zh' ? `${selectedTagIds.length} 个标签` : `${selectedTagIds.length} tag${selectedTagIds.length > 1 ? 's' : ''}`)
              : (lang === 'zh' ? '添加标签' : 'Add tags')}
          </button>
          {showTagPicker && (
            <div style={{ position: 'absolute', top: '26px', left: 0, zIndex: 100, borderRadius: '8px', border: '0.5px solid var(--color-border)', backgroundColor: 'var(--color-bg-primary)', boxShadow: '0 8px 24px rgba(0,0,0,0.14)', minWidth: '170px', padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {tags.map(tag => (
                    <TagChip key={tag.id} tag={tag} size="sm" active={selectedTagIds.includes(tag.id)} onClick={() => toggleTag(tag.id)} />
                  ))}
                </div>
              )}
              <input autoFocus={tags.length === 0} type="text" value={newTagName}
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
                style={{ fontSize: '10px', padding: '4px 8px', background: 'var(--color-bg-tertiary)', border: '0.5px solid var(--color-border)', borderRadius: '5px', color: 'var(--color-text-primary)', outline: 'none', width: '100%' }}
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
    </div>
  );
}

function TypeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="font-medium transition-colors"
      style={{ padding: '5px 9px', fontSize: '11px', border: 'none', borderRight: '0.5px solid var(--color-border)', color: active ? 'var(--color-fill-text)' : 'var(--color-text-tertiary)', backgroundColor: active ? 'var(--color-fill)' : 'transparent', cursor: 'pointer' }}
    >{children}</button>
  );
}
