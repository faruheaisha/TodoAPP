import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Search, X, Plus } from 'lucide-react';
import type { ChatSession } from '../../store/chatStore';
import SessionListItem from './SessionListItem';

interface Props {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  onExportSession: (id: string) => void;
  onClose: () => void;
  lang: 'zh' | 'en';
}

function getDateGroup(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const weekAgo = today - 7 * 86400000;
  if (d.getTime() >= today) return 'today';
  if (d.getTime() >= yesterday) return 'yesterday';
  if (d.getTime() >= weekAgo) return 'week';
  return 'earlier';
}

const GROUP_LABELS_ZH: Record<string, string> = { today: '今天', yesterday: '昨天', week: '本周', earlier: '更早' };
const GROUP_LABELS_EN: Record<string, string> = { today: 'Today', yesterday: 'Yesterday', week: 'This Week', earlier: 'Earlier' };
const GROUP_ORDER = ['today', 'yesterday', 'week', 'earlier'];

function searchFilter(session: ChatSession, query: string): boolean {
  const q = query.toLowerCase();
  if (session.title.toLowerCase().includes(q)) return true;
  return session.messages.some((m) => m.content.toLowerCase().includes(q));
}

export default function SessionSidebar({
  sessions, activeSessionId, onSelectSession, onNewSession,
  onRenameSession, onDeleteSession, onExportSession, onClose, lang,
}: Props) {
  const labels = lang === 'zh' ? GROUP_LABELS_ZH : GROUP_LABELS_EN;
  const [searchQuery, setSearchQuery] = useState('');
  const [clearConfirm, setClearConfirm] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Expose searchRef for parent keyboard nav
  useEffect(() => {
    (window as any).__sidebarSearchRef = searchRef.current;
    return () => { delete (window as any).__sidebarSearchRef; };
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.trim().toLowerCase();
    return sessions.filter((s) => searchFilter(s, q));
  }, [sessions, searchQuery]);

  const grouped = useMemo(() => {
    if (searchQuery.trim()) {
      return [{ label: lang === 'zh' ? '搜索结果' : 'Search results', sessions: filtered }];
    }
    const groups: { label: string; sessions: ChatSession[] }[] = [];
    for (const key of GROUP_ORDER) {
      const groupSessions = filtered.filter((s) => getDateGroup(s.createdAt) === key);
      if (groupSessions.length > 0) groups.push({ label: labels[key], sessions: groupSessions });
    }
    return groups;
  }, [filtered, searchQuery, lang, labels]);

  const hasClearBtn = sessions.length > 1 && !searchQuery.trim();

  return (
    <div
      style={{
        width: 240, overflow: 'hidden', flexShrink: 0,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(255,255,255,0.4)',
        borderRight: '0.5px solid var(--glass-border)',
      }}
    >
      {/* Search bar */}
      <div style={{ padding: '8px 10px 4px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '6px 8px', borderRadius: '8px',
          background: 'var(--color-bg-tertiary)',
        }}>
          <Search size={13} style={{ flexShrink: 0, color: 'var(--color-text-tertiary)' }} />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={lang === 'zh' ? '搜索对话…' : 'Search conversations…'}
            style={{
              flex: 1, border: 'none', background: 'transparent',
              font: 'inherit', fontSize: '12px', color: 'var(--color-text-primary)',
              outline: 'none', lineHeight: 1,
            }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: 'var(--color-text-tertiary)', padding: 0, display: 'flex', lineHeight: 1,
            }}>
              <X size={12} />
            </button>
          )}
        </div>
        {hasClearBtn && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            {clearConfirm ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: 'var(--color-text-tertiary)' }}>
                  {lang === 'zh' ? '确认清空？' : 'Are you sure?'}
                </span>
                <button onClick={() => {
                  sessions.forEach((s) => onDeleteSession(s.id));
                  setClearConfirm(false);
                  onNewSession();
                }} style={{
                  fontSize: '10px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px',
                  border: 'none', cursor: 'pointer', background: '#C4502E', color: '#fff',
                  lineHeight: 1,
                }}>
                  {lang === 'zh' ? '确认' : 'Confirm'}
                </button>
                <button onClick={() => setClearConfirm(false)} style={{
                  fontSize: '10px', padding: '2px 6px', borderRadius: '4px',
                  border: 'none', cursor: 'pointer', background: 'transparent',
                  color: 'var(--color-text-secondary)', lineHeight: 1,
                }}>
                  {lang === 'zh' ? '取消' : 'Cancel'}
                </button>
              </div>
            ) : (
              <button onClick={() => setClearConfirm(true)} style={{
                fontSize: '10px', color: 'var(--color-text-tertiary)',
                border: 'none', background: 'transparent', cursor: 'pointer',
                padding: '2px 4px', lineHeight: 1,
              }}>
                {lang === 'zh' ? '清空全部' : 'Clear all'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px' }}>
        {grouped.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
            padding: '24px 12px', textAlign: 'center',
          }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
              {searchQuery.trim()
                ? (lang === 'zh' ? '没有匹配的对话' : 'No matching conversations')
                : (lang === 'zh' ? '还没有对话' : 'No conversations yet')}
            </span>
            {searchQuery.trim() ? (
              <button onClick={() => setSearchQuery('')} style={{
                fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
                border: '0.5px solid var(--color-border)', background: 'transparent',
                cursor: 'pointer', color: 'var(--color-text-secondary)',
              }}>
                {lang === 'zh' ? '清除筛选' : 'Clear filter'}
              </button>
            ) : (
              <button onClick={() => { onNewSession(); onClose(); }} style={{
                fontSize: '11px', padding: '4px 10px', borderRadius: '6px',
                border: '0.5px solid var(--color-border)', background: 'transparent',
                cursor: 'pointer', color: 'var(--color-text-secondary)',
              }}>
                {lang === 'zh' ? '开始对话' : 'Start one'}
              </button>
            )}
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label} style={{ marginBottom: '4px' }}>
              <div style={{
                fontSize: '10px', fontWeight: 600, color: 'var(--color-text-tertiary)',
                padding: '6px 8px 3px', letterSpacing: '0.02em', textTransform: 'uppercase',
              }}>
                {group.label}
              </div>
              {group.sessions.map((s) => (
                <SessionListItem
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  onSelect={onSelectSession}
                  onRename={onRenameSession}
                  onDelete={onDeleteSession}
                  onExport={onExportSession}
                  lang={lang}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* New chat button */}
      <div style={{ padding: '6px 8px 8px' }}>
        <button onClick={() => { onNewSession(); onClose(); }} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
          width: '100%', padding: '7px', borderRadius: '8px',
          border: '0.5px solid var(--color-border)', background: 'var(--color-bg-secondary)',
          font: 'inherit', fontSize: '12px', fontWeight: 500, cursor: 'pointer',
          color: 'var(--color-text-secondary)', lineHeight: 1,
          transition: 'background .14s',
        }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-tertiary)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-bg-secondary)')}
        >
          <Plus size={14} />
          {lang === 'zh' ? '新对话' : 'New chat'}
        </button>
      </div>
    </div>
  );
}
