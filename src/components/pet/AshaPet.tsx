/**
 * AshaPet — 雪豹「Asha · 阿夏」吉祥物
 *
 * 状态机（由父组件传入）：
 *  idle     — 呼吸起伏 + 随机眨眼 + 尾巴缓摆
 *  happy    — 眯眼微笑（早晨时段）
 *  hover    — 竖耳 + 眼睛微张
 *  thinking — 歪头 + 省略号气泡
 *  speaking — 嘴部微动 + 头部小幅点动
 *  sleepy   — 半闭眼 + 缓慢呼吸（深夜时段）
 *  dragging — 压扁挤压（被拎起感）
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export type AshaState = 'idle' | 'happy' | 'hover' | 'thinking' | 'speaking' | 'sleepy' | 'dragging';

// 品牌固定配色 — 雪豹灰白皮毛
const FUR       = '#ECE8E1';
const FUR_SHADE = '#D8D3CA';
const SPOT      = '#A39C90';
const SPOT_DARK = '#7E776B';
const MUZZLE    = '#FAF8F4';
const NOSE      = '#C98A7D';
const EYE_IRIS  = '#8FB3A3';
const EYE_DARK  = '#3A3733';

export default function AshaPet({ state = 'idle', size = 72 }: { state?: AshaState; size?: number }) {
  // 随机眨眼：2.4-5.2s 间隔，眨 130ms（sleepy 时跳过）
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (state === 'sleepy') return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        setBlink(true);
        setTimeout(() => { if (alive) setBlink(false); }, 130);
        loop();
      }, 2400 + Math.random() * 2800);
    };
    loop();
    return () => { alive = false; clearTimeout(timer); };
  }, [state]);

  const eyesClosed  = blink || state === 'dragging';
  const headTilt    = state === 'thinking' ? -8 : 0;

  // 各状态眼睛 scaleY
  const eyeScaleY = eyesClosed
    ? 0.08
    : state === 'happy'
      ? 0.72          // 眯眼微笑
      : state === 'sleepy'
        ? 0.42          // 半闭眼
        : state === 'hover'
          ? 1.08
          : 1;

  // 呼吸速度：sleepy 更慢
  const breathDuration = state === 'sleepy' ? 5.5 : 3.2;

  // happy 状态：嘴角上扬偏移
  const happyMouthY = state === 'happy' ? -1.5 : 0;

  return (
    <motion.svg
      width={size}
      height={size}
      viewBox="0 0 120 124"
      fill="none"
      animate={
        state === 'dragging'
          ? { scaleX: 1.06, scaleY: 0.92 }
          : { scaleY: [1, 1.025, 1], scaleX: 1 }
      }
      transition={
        state === 'dragging'
          ? { duration: 0.15 }
          : { duration: breathDuration, repeat: Infinity, ease: 'easeInOut' }
      }
      style={{ transformOrigin: '50% 100%', display: 'block' }}
    >
      {/* ── 尾巴（最底层）── */}
      <motion.g
        animate={{ rotate: state === 'idle' || state === 'happy' ? [0, 4, 0, -2, 0] : 0 }}
        transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transformOrigin: '86px 100px' }}
      >
        <path
          d="M84 102 C 106 100, 114 84, 108 70 C 104 61, 94 60, 92 68 C 90 75, 98 76, 100 71"
          stroke={FUR}
          strokeWidth="13"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="104" cy="88" r="3.4" fill={SPOT} />
        <circle cx="108" cy="76" r="3" fill={SPOT_DARK} />
        <circle cx="97"  cy="97" r="3.2" fill={SPOT} />
      </motion.g>

      {/* ── 身体 ── */}
      <ellipse cx="58" cy="96" rx="30" ry="24" fill={FUR} />
      <ellipse cx="58" cy="100" rx="18" ry="15" fill={MUZZLE} opacity="0.7" />
      <circle cx="36" cy="90"  r="2.6" fill={SPOT} />
      <circle cx="80" cy="92"  r="2.4" fill={SPOT} />
      <circle cx="42" cy="102" r="2.2" fill={SPOT_DARK} opacity="0.7" />
      <ellipse cx="46" cy="116" rx="9" ry="6" fill={FUR_SHADE} />
      <ellipse cx="70" cy="116" rx="9" ry="6" fill={FUR_SHADE} />

      {/* happy 状态：爪子小星星 ✨ */}
      {state === 'happy' && (
        <motion.g
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          style={{ transformOrigin: '28px 110px' }}
        >
          <text x="22" y="114" fontSize="8" fill={NOSE} opacity="0.9">✨</text>
        </motion.g>
      )}

      {/* sleepy 状态：Zzz */}
      {state === 'sleepy' && (
        <motion.g>
          <motion.text
            x="88" y="42" fontSize="7" fill={SPOT} opacity="0.8"
            animate={{ opacity: [0.2, 0.8, 0.2], y: [42, 39, 42] }}
            transition={{ duration: 2.8, repeat: Infinity, delay: 0 }}
          >z</motion.text>
          <motion.text
            x="95" y="34" fontSize="9" fill={SPOT} opacity="0.8"
            animate={{ opacity: [0.2, 0.8, 0.2], y: [34, 31, 34] }}
            transition={{ duration: 2.8, repeat: Infinity, delay: 0.5 }}
          >z</motion.text>
          <motion.text
            x="104" y="24" fontSize="11" fill={SPOT} opacity="0.8"
            animate={{ opacity: [0.2, 0.8, 0.2], y: [24, 20, 24] }}
            transition={{ duration: 2.8, repeat: Infinity, delay: 1 }}
          >Z</motion.text>
        </motion.g>
      )}

      {/* ── 头部（歪头由此组控制）── */}
      <motion.g
        animate={{
          rotate: headTilt,
          y: state === 'speaking' ? [0, -1.5, 0] : happyMouthY,
        }}
        transition={
          state === 'speaking'
            ? { y: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }, rotate: { duration: 0.25 } }
            : { duration: 0.25, ease: 'easeOut' }
        }
        style={{ transformOrigin: '60px 56px' }}
      >
        {/* 耳朵（hover/happy 时竖起） */}
        <motion.g
          animate={{ rotate: (state === 'hover' || state === 'happy') ? -8 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ transformOrigin: '34px 26px' }}
        >
          <path d="M24 34 Q 26 12, 44 18 Q 36 26, 33 38 Z" fill={FUR} />
          <path d="M29 30 Q 31 19, 40 22 Q 35 27, 33 33 Z" fill={FUR_SHADE} />
        </motion.g>
        <motion.g
          animate={{ rotate: (state === 'hover' || state === 'happy') ? 8 : 0 }}
          transition={{ duration: 0.18 }}
          style={{ transformOrigin: '86px 26px' }}
        >
          <path d="M96 34 Q 94 12, 76 18 Q 84 26, 87 38 Z" fill={FUR} />
          <path d="M91 30 Q 89 19, 80 22 Q 85 27, 87 33 Z" fill={FUR_SHADE} />
        </motion.g>

        {/* 脸 */}
        <circle cx="60" cy="52" r="33" fill={FUR} />
        {/* 头顶斑点 */}
        <circle cx="44" cy="30" r="2.6" fill={SPOT} />
        <circle cx="58" cy="25" r="2.2" fill={SPOT_DARK} opacity="0.75" />
        <circle cx="74" cy="29" r="2.6" fill={SPOT} />
        <circle cx="34" cy="44" r="2.3" fill={SPOT} opacity="0.8" />
        <circle cx="86" cy="44" r="2.3" fill={SPOT} opacity="0.8" />
        {/* 颊毛 */}
        <path d="M27 56 Q 20 58, 26 63 Q 21 64, 28 68 L 32 62 Z" fill={FUR} />
        <path d="M93 56 Q 100 58, 94 63 Q 99 64, 92 68 L 88 62 Z" fill={FUR} />

        {/* 口鼻部 */}
        <ellipse cx="60" cy="64" rx="17" ry="13" fill={MUZZLE} />

        {/* 眼睛 */}
        <motion.g
          animate={{ scaleY: eyeScaleY }}
          transition={{ duration: eyesClosed ? 0.09 : 0.22 }}
          style={{ transformOrigin: '60px 51px' }}
        >
          <ellipse cx="46" cy="51" rx="6.5" ry="7.5" fill={EYE_IRIS} />
          <circle  cx="46" cy="52" r="3.6"  fill={EYE_DARK} />
          <circle  cx="47.6" cy="49.6" r="1.5" fill="#FFFFFF" />
          <ellipse cx="74" cy="51" rx="6.5" ry="7.5" fill={EYE_IRIS} />
          <circle  cx="74" cy="52" r="3.6"  fill={EYE_DARK} />
          <circle  cx="75.6" cy="49.6" r="1.5" fill="#FFFFFF" />
        </motion.g>

        {/* 鼻 + 嘴 */}
        <path d="M56.5 60.5 Q 60 58.5, 63.5 60.5 Q 62 64.5, 60 64.5 Q 58 64.5, 56.5 60.5 Z" fill={NOSE} />
        <motion.g
          animate={
            state === 'speaking'
              ? { scaleY: [1, 1.6, 1] }
              : state === 'happy'
                ? { scaleY: 1, scaleX: 1.15 }   // happy 嘴角略宽
                : { scaleY: 1, scaleX: 1 }
          }
          transition={{
            duration: 0.45,
            repeat: state === 'speaking' ? Infinity : 0,
            ease: 'easeInOut',
          }}
          style={{ transformOrigin: '60px 68px' }}
        >
          <path d="M60 64.5 Q 60 68, 56 69" stroke={SPOT_DARK} strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <path d="M60 64.5 Q 60 68, 64 69" stroke={SPOT_DARK} strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </motion.g>

        {/* 眉斑 */}
        <circle cx="46" cy="39" r="1.6" fill={SPOT_DARK} opacity="0.6" />
        <circle cx="74" cy="39" r="1.6" fill={SPOT_DARK} opacity="0.6" />
      </motion.g>

      {/* ── 思考省略号气泡 ── */}
      {state === 'thinking' && (
        <g>
          <motion.circle
            cx="98" cy="26" r="3"
            fill={SPOT}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
          />
          <motion.circle
            cx="107" cy="20" r="3.8"
            fill={SPOT}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.25 }}
          />
          <motion.circle
            cx="116" cy="12" r="4.6"
            fill={SPOT}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1.2, repeat: Infinity, delay: 0.5 }}
          />
        </g>
      )}
    </motion.svg>
  );
}
