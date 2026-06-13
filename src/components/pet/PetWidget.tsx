/**
 * PetWidget — Asha 浮动入口
 *
 * 右下角浮动，可拖拽换位（offset 持久化），点击打开聊天面板。
 * 悬停时显示时段化话语气泡（framer-motion 淡入上浮）。
 * 宠物情绪随时间段自动切换（晨/午/傍晚/深夜）。
 * 拖拽结束后同步 aiStore.petOffset，供 ChatPanel 跟随定位。
 */
import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/chatStore';
import { useAIStore } from '../../store/aiStore';
import AshaPet, { type AshaState } from './AshaPet';
import { getRandomPhrase, getPeriodMood } from '../../lib/petPhrases';

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
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  const { isOpen, setIsOpen, hasUnread, assistantBusy } = useChatStore();
  const setPetOffset = useAIStore((s) => s.setPetOffset);
  const [hovered,  setHovered]  = useState(false);
  const [dragging, setDragging] = useState(false);
  const [phrase,   setPhrase]   = useState<string | null>(null);
  const posRef = useRef(loadPos());

  // 悬停开始：抽话语
  const handleHoverStart = useCallback(() => {
    setHovered(true);
    setPhrase(getRandomPhrase(lang));
  }, [lang]);

  const handleHoverEnd = useCallback(() => {
    setHovered(false);
    setTimeout(() => setPhrase(null), 300);
  }, []);

  // 宠物动画状态优先级：dragging > thinking > speaking(hover) > 时段情绪
  const baseMood   = getPeriodMood();
  const state: AshaState = dragging
    ? 'dragging'
    : assistantBusy
      ? 'thinking'
      : hovered
        ? 'speaking'
        : baseMood;

  const showBubble = hovered && !dragging && phrase !== null;

  // 语言感知名字
  const petName = lang === 'zh' ? '阿夏' : 'Asha';

  return (
    <div
      style={{
        position: 'fixed',
        right: '18px',
        bottom: '18px',
        zIndex: 30,
      }}
    >
      {/* 话语气泡（悬停时出现，宠物上方） */}
      <AnimatePresence>
        {showBubble && (
          <motion.div
            key="phrase-bubble"
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={{    opacity: 0, y: 5,  scale: 0.95 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              bottom: '82px',
              right: '0px',
              maxWidth: '168px',
              minWidth: '100px',
              padding: '9px 13px',
              borderRadius: '14px',
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.13), 0 1px 4px rgba(0,0,0,0.08)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              fontSize: '11.5px',
              lineHeight: '1.55',
              color: 'var(--color-text-primary)',
              pointerEvents: 'none',
              userSelect: 'none',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {phrase}
            {/* 小三角 —— 指向宠物 */}
            <span
              style={{
                position: 'absolute',
                bottom: '-8px',
                right: '26px',
                width: 0,
                height: 0,
                borderLeft: '7px solid transparent',
                borderRight: '7px solid transparent',
                borderTop: '8px solid var(--glass-border)',
              }}
            />
            <span
              style={{
                position: 'absolute',
                bottom: '-6px',
                right: '27px',
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '7px solid var(--glass-bg)',
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 宠物本体 */}
      <motion.div
        drag
        dragMomentum={false}
        initial={{ x: posRef.current.x, y: posRef.current.y }}
        onDragStart={() => setDragging(true)}
        onDragEnd={(_, info) => {
          setDragging(false);
          const newPos = {
            x: posRef.current.x + info.offset.x,
            y: posRef.current.y + info.offset.y,
          };
          posRef.current = newPos;
          // 同步到 aiStore，供 ChatPanel 跟随定位
          setPetOffset(newPos);
          try { localStorage.setItem(POS_KEY, JSON.stringify(newPos)); } catch { /* 配额满忽略 */ }
        }}
        onTap={() => { if (!dragging) setIsOpen(!isOpen); }}
        onHoverStart={handleHoverStart}
        onHoverEnd={handleHoverEnd}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="select-none"
        style={{
          cursor: 'pointer',
          filter: 'drop-shadow(0 4px 10px rgba(20, 20, 19, 0.18))',
        }}
      >
        <AshaPet state={state} size={68} />

        {/* 名字标签 — 悬停时渐显 */}
        <AnimatePresence>
          {hovered && !dragging && (
            <motion.div
              key="name-tag"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{    opacity: 0, y: 2 }}
              transition={{ duration: 0.18, delay: 0.05 }}
              style={{
                position: 'absolute',
                bottom: '-18px',
                left: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  fontStyle: 'italic',
                  letterSpacing: '0.02em',
                  background: 'linear-gradient(135deg, var(--clay) 20%, var(--fig, #c46686) 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {petName}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

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
    </div>
  );
}
