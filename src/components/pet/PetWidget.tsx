/**
 * PetWidget — Asha 浮动入口
 *
 * 右下角浮动，长按拖拽换位（offset 持久化），单击打开聊天面板。
 * 拖拽自动钳制到窗口边缘（保持 18px 间距），弹回流畅。
 */
import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/chatStore';
import { useAIStore } from '../../store/aiStore';
import AshaPet, { type AshaState } from './AshaPet';
import { getRandomPhrase, getPeriodMood } from '../../lib/petPhrases';

const POS_KEY = 'todoapp-pet-pos';
const POS_VERSION = 2;
const EDGE_MARGIN = 18;
const PET_SIZE = 70;

function getDefaultPos(): { x: number; y: number } {
  const vh = window.innerHeight;
  return { x: 0, y: EDGE_MARGIN + PET_SIZE / 2 - vh / 2 };
}

function loadPos(): { x: number; y: number } {
  try {
    const raw = localStorage.getItem(POS_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      // v1 stored {x,y} at bottom-right; v2 resets to right-center
      if (p.v === POS_VERSION && typeof p.x === 'number' && typeof p.y === 'number') return p;
    }
  } catch { /* 损坏则复位 */ }
  return getDefaultPos();
}

function savePos(pos: { x: number; y: number }) {
  try { localStorage.setItem(POS_KEY, JSON.stringify({ ...pos, v: POS_VERSION })); } catch { /* */ }
}

function computeClampedPos(x: number, y: number): { x: number; y: number } {
  const vw = window.innerWidth, vh = window.innerHeight;
  // wrapper: position fixed; right: EDGE_MARGIN; bottom: EDGE_MARGIN
  // inner:  translate(x,y).  Natural: wrapper is shrink-to-fit on AshaPet (PET_SIZE)
  // Right-edge visibility: vw - EDGE_MARGIN + x ≤ vw - EDGE_MARGIN → x ≤ 0
  // Left-edge visibility:  vw - EDGE_MARGIN - PET_SIZE + x ≥ EDGE_MARGIN → x ≥ 2*EDGE_MARGIN + PET_SIZE - vw
  // Same logic for y
  return {
    x: Math.max(2 * EDGE_MARGIN + PET_SIZE - vw, Math.min(0, x)),
    y: Math.max(2 * EDGE_MARGIN + PET_SIZE - vh, Math.min(0, y)),
  };
}

export default function PetWidget() {
  const { i18n } = useTranslation();
  const lang = i18n.language.startsWith('zh') ? 'zh' : 'en';

  const { isOpen, setIsOpen, hasUnread, assistantBusy } = useChatStore();
  const setPetOffset = useAIStore((s) => s.setPetOffset);
  const [hovered,   setHovered]   = useState(false);
  const [dragging,  setDragging]  = useState(false);
  const [phrase,    setPhrase]    = useState<string | null>(null);
  const [petPos,    setPetPos]    = useState(() => loadPos());
  const posRef      = useRef(petPos);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef  = useRef(false);
  const pointerDownPos = useRef({ x: 0, y: 0 });
  const startPosRef    = useRef({ x: 0, y: 0 });

  const clearTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    isDraggingRef.current = false;
    pointerDownPos.current = { x: e.clientX, y: e.clientY };
    startPosRef.current = { ...posRef.current };

    longPressTimer.current = setTimeout(() => {
      isDraggingRef.current = true;
      setDragging(true);
    }, 300);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - pointerDownPos.current.x;
      const dy = ev.clientY - pointerDownPos.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        if (!isDraggingRef.current) {
          isDraggingRef.current = true;
          setDragging(true);
          clearTimer();
        }
      }
      if (isDraggingRef.current) {
        const newPos = computeClampedPos(
          startPosRef.current.x + dx,
          startPosRef.current.y + dy,
        );
        posRef.current = newPos;
        setPetPos(newPos);
      }
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      clearTimer();
      const wasDrag = isDraggingRef.current;
      isDraggingRef.current = false;
      requestAnimationFrame(() => setDragging(false));

      if (wasDrag) {
        setPetOffset(posRef.current);
        savePos(posRef.current);
      } else {
        setIsOpen(!isOpen);
      }
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  };

  const handleHoverStart = useCallback(() => {
    setHovered(true);
    setPhrase(getRandomPhrase(lang));
  }, [lang]);

  const handleHoverEnd = useCallback(() => {
    setHovered(false);
    setTimeout(() => setPhrase(null), 300);
  }, []);

  const baseMood   = getPeriodMood();
  const state: AshaState = dragging
    ? 'dragging'
    : assistantBusy
      ? 'thinking'
      : hovered
        ? 'speaking'
        : baseMood;

  const showBubble = hovered && !dragging && !isOpen && phrase !== null;
  const petName = lang === 'zh' ? '阿夏' : 'Asha';

  return (
    <div
      style={{
        position: 'fixed',
        right: `${EDGE_MARGIN}px`,
        bottom: `${EDGE_MARGIN}px`,
        zIndex: 30,
        touchAction: 'none',
      }}
    >
      {/* 普通 div 控制 transform 位置，无 framer 动画冲突 */}
      <div
        onPointerDown={onPointerDown}
        onMouseEnter={handleHoverStart}
        onMouseLeave={handleHoverEnd}
        className="select-none"
        style={{
          transform: `translate(${petPos.x}px, ${petPos.y}px)`,
          transition: dragging ? 'none' : 'transform 0.3s cubic-bezier(0.22, 0.61, 0.36, 1)',
          cursor: dragging ? 'grabbing' : 'pointer',
          position: 'relative',
          width: 'fit-content',
        }}
      >
        {/* 话语气泡 — framer-motion */}
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
                zIndex: 1,
              }}
            >
              {phrase}
              <span
                style={{
                  position: 'absolute',
                  bottom: '-8px',
                  right: '26px',
                  width: 0, height: 0,
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
                  width: 0, height: 0,
                  borderLeft: '6px solid transparent',
                  borderRight: '6px solid transparent',
                  borderTop: '7px solid var(--glass-bg)',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 宠物本体 — hover 缩放用 CSS transition */}
        <div style={{
          filter: 'drop-shadow(0 4px 10px rgba(20,20,19,0.18))',
          transform: `scale(${hovered && !dragging ? 1.06 : 1})`,
          transition: 'transform 0.18s ease',
        }}>
          <AshaPet state={state} size={PET_SIZE} />
        </div>

        {/* 名字标签 */}
        <AnimatePresence>
          {hovered && !dragging && !isOpen && (
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
              <span style={{
                fontSize: '10px', fontWeight: 700, fontStyle: 'italic',
                letterSpacing: '0.02em',
                background: 'linear-gradient(135deg, var(--clay) 20%, var(--fig, #c46686) 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {petName}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 未读小红点 */}
        {hasUnread && !isOpen && (
          <span style={{
            position: 'absolute', top: '6px', right: '8px',
            width: '9px', height: '9px', borderRadius: '50%',
            backgroundColor: 'var(--clay)',
            border: '1.5px solid var(--color-bg-primary)',
          }} />
        )}
      </div>
    </div>
  );
}
