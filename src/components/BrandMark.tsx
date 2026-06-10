/**
 * BrandMark — TodoApp 品牌符号
 *
 * 设计语言：Anthropic 式的克制几何 —— 连续圆角方（squircle 近似）+
 * 一笔自信的勾。勾的起笔略低、收笔出头，带手写的「确认感」，
 * 区别于通用 checkmark 图标。陶土橙底 + 羊皮纸白笔画，随 accent 变量换色。
 */
export default function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      aria-label="TodoApp"
      style={{ flexShrink: 0, display: 'block' }}
    >
      {/* 连续圆角方底 — 圆角率 36% 接近 squircle 质感 */}
      <rect x="0" y="0" width="28" height="28" rx="9" fill="var(--clay)" />
      {/* 一笔勾 — 起笔低、转折圆、收笔向右上出头 */}
      <path
        d="M7.5 14.5 L12 19 L20.5 9.5"
        stroke="var(--ivory-light, #faf9f5)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
