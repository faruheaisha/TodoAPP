/**
 * PetWidget — Asha 浮动入口
 *
 * 右下角浮动，可拖拽换位（offset 持久化），点击打开聊天面板。
 * 仅 aiEnabled 时渲染（由 App 控制）。
 * z-index 30：低于 overlay(40) 与各模态(50)，不遮挡核心交互。
 */
import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useChatStore } from '../../store/chatStore';
import AshaPet, { type AshaState } from './AshaPet';

const POS_KEY = 'todoapp-pet-pos';

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

export default function PetWidget() {
  const { isOpen, setIsOpen, hasUnread, assistantBusy } = useChatStore();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const posRef = useRef(loadPos());

  const state: AshaState = dragging
    ? 'dragging'
    : assistantBusy
      ? 'thinking'
      : hovered
        ? 'hover'
        : 'idle';

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ x: posRef.current.x, y: posRef.current.y }}
      onDragStart={() => setDragging(true)}
      onDragEnd={(_, info) => {
        setDragging(false);
        posRef.current = {
          x: posRef.current.x + info.offset.x,
          y: posRef.current.y + info.offset.y,
        };
        try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch { /* 配额满忽略 */ }
      }}
      onTap={() => { if (!dragging) setIsOpen(!isOpen); }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.94 }}
      className="select-none"
      style={{
        position: 'fixed',
        right: '18px',
        bottom: '18px',
        zIndex: 30,
        cursor: 'pointer',
        // 给吉祥物一个柔和的落地阴影
        filter: 'drop-shadow(0 4px 10px rgba(20, 20, 19, 0.18))',
      }}
      title="Asha · 阿夏"
    >
      <AshaPet state={state} size={68} />
      {/* 未读小红点 */}
      {hasUnread && !isOpen && (
        <span
          style={{
            position: 'absolute', top: '6px', right: '8px',
            width: '9px', height: '9px', borderRadius: '50%',
            backgroundColor: 'var(--clay)',
            border: '1.5px solid var(--color-bg-primary)',
          }}
        />
      )}
    </motion.div>
  );
}
