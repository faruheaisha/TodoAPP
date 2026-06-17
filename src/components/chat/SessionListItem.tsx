import { useRef, useState } from 'react';
import type { ChatSession } from '../../store/chatStore';
import SessionContextMenu from './SessionContextMenu';

interface Props {
  session: ChatSession;
  isActive: boolean;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onExport: (id: string) => void;
  lang: 'zh' | 'en';
}

function relativeTime(ts: number, lang: 'zh' | 'en'): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === 'zh' ? '刚刚' : 'just now';
  if (mins < 60) return lang === 'zh' ? `${mins}分钟前` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return lang === 'zh' ? `${hours}小时前` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return lang === 'zh' ? '昨天' : 'yesterday';
  if (days < 7) return lang === 'zh' ? `${days}天前` : `${days}d ago`;
  return new Date(ts).toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
}

function getLastPreview(session: ChatSession): string {
  const last = session.messages[session.messages.length - 1];
  if (!last) return '';
  return last.content.slice(0, 60).replace(/\n/g, ' ');
}

export default function SessionListItem({ session, isActive, onSelect, onRename, onDelete, onExport, lang }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(session.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handleRename = () => {
    setEditing(true);
    setEditVal(session.title || '');
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 50);
  };

  const commitRename = () => {
    const title = editVal.trim() || session.title;
    if (title !== session.title) onRename(session.id, title);
    setEditing(false);
  };

  const preview = getLastPreview(session);

  return (
    <div
      onClick={() => { if (!editing) onSelect(session.id); }}
      style={{
        display: 'flex', flexDirection: 'column', gap: '2px',
        padding: '8px 10px 7px', borderRadius: '8px', cursor: 'pointer',
        background: isActive ? 'var(--color-fill)' : 'transparent',
        color: isActive ? 'var(--color-fill-text)' : 'var(--color-text-secondary)',
        transition: 'background .1s',
        position: 'relative',
      }}
      onMouseEnter={(e) => { if (!isActive && !editing) (e.currentTarget as HTMLElement).style.background = 'var(--color-bg-tertiary)'; }}
      onMouseLeave={(e) => { if (!isActive && !editing) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '18px' }}>
        {editing ? (
          <input
            ref={inputRef}
            value={editVal}
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
            style={{
              flex: 1, fontSize: '12px', fontWeight: 600, padding: '2px 4px',
              border: '0.5px solid var(--color-border)', borderRadius: '4px',
              background: 'var(--color-fill)', color: 'var(--color-fill-text)',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        ) : (
          <span style={{
            fontSize: '12px', fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, lineHeight: 1.3,
          }}>
            {session.title || (lang === 'zh' ? '新对话' : 'New chat')}
          </span>
        )}
        <span style={{ fontSize: '10px', opacity: 0.5, flexShrink: 0, marginLeft: '6px', lineHeight: 1 }}>
          {relativeTime(session.createdAt, lang)}
        </span>
      </div>
      {preview && !editing && (
        <span style={{
          fontSize: '10.5px', opacity: 0.55, lineHeight: 1.3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
        }}>
          {preview}
        </span>
      )}
      <button
        ref={btnRef}
        onClick={handleContextMenu}
        style={{
          position: 'absolute', right: '4px', top: '4px',
          width: '20px', height: '20px', display: 'none',
          alignItems: 'center', justifyContent: 'center',
          border: 'none', borderRadius: '4px',
          background: 'var(--color-bg-tertiary)', cursor: 'pointer',
          color: 'var(--color-text-tertiary)',
          padding: 0, lineHeight: 1,
        }}
        className="session-menu-btn"
        title={lang === 'zh' ? '更多' : 'More'}
      />
      {showMenu && (
        <SessionContextMenu
          sessionId={session.id}
          position={menuPos}
          onRename={handleRename}
          onDelete={() => onDelete(session.id)}
          onExport={() => onExport(session.id)}
          onClose={() => setShowMenu(false)}
          lang={lang}
        />
      )}
      <style>{`
        .session-menu-btn { display: none; }
        div:hover > .session-menu-btn { display: flex !important; }
      `}</style>
    </div>
  );
}
