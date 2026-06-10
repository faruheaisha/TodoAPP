import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

/**
 * EmptyState — 空状态
 *
 * 插图：三行抽象任务卡的纵向堆叠，首行已完成（coral 勾），
 * 余下两行虚位以待 —— 暗示「第一件事已经可以开始」。
 * 文案走 i18n；CTA 聚焦输入框（AddTodoBar 监听 focus-add-input）。
 */
export default function EmptyState() {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="flex-1 flex flex-col items-center justify-center px-8 text-center"
    >
      {/* 插图 — 抽象任务列表 */}
      <motion.svg
        width="148" height="110" viewBox="0 0 148 110" fill="none"
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-6"
        aria-hidden
      >
        {/* 第一行 — 已完成 */}
        <rect x="10" y="8" width="128" height="26" rx="8"
          fill="var(--color-bg-secondary)" stroke="var(--color-border)" strokeWidth="1" />
        <circle cx="26" cy="21" r="7" fill="var(--clay)" />
        <path d="M22.8 21 L25.2 23.4 L29.5 18.6" stroke="var(--ivory-light, #faf9f5)"
          strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="42" y="18" width="62" height="6" rx="3" fill="var(--color-border)" />

        {/* 第二行 — 待办 */}
        <rect x="10" y="42" width="128" height="26" rx="8"
          fill="var(--color-bg-secondary)" stroke="var(--color-border)" strokeWidth="1" />
        <circle cx="26" cy="55" r="7" fill="none" stroke="var(--color-checkbox-border)" strokeWidth="1.6" />
        <rect x="42" y="52" width="80" height="6" rx="3" fill="var(--color-bg-tertiary)" />

        {/* 第三行 — 半透明，暗示延伸 */}
        <g opacity="0.45">
          <rect x="10" y="76" width="128" height="26" rx="8"
            fill="var(--color-bg-secondary)" stroke="var(--color-border)" strokeWidth="1" />
          <circle cx="26" cy="89" r="7" fill="none" stroke="var(--color-checkbox-border)" strokeWidth="1.6" />
          <rect x="42" y="86" width="48" height="6" rx="3" fill="var(--color-bg-tertiary)" />
        </g>
      </motion.svg>

      <p
        className="select-none mb-1.5"
        style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          letterSpacing: 'var(--tracking-tight)',
        }}
      >
        {t('app.empty')}
      </p>
      <p
        className="text-xs max-w-xs select-none mb-5"
        style={{ color: 'var(--color-text-tertiary)', lineHeight: 1.6 }}
      >
        {t('app.emptyHint')}
      </p>

      {/* 引导动作 — 聚焦上方输入框 */}
      <motion.button
        onClick={() => window.dispatchEvent(new CustomEvent('focus-add-input'))}
        whileTap={{ scale: 0.97 }}
        className="flex items-center cursor-pointer"
        style={{
          height: '34px',
          padding: '0 16px',
          gap: '6px',
          borderRadius: '8px',
          border: 'none',
          backgroundColor: 'var(--clay)',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 550,
          boxShadow: 'var(--shadow-sm)',
          transition: 'background-color var(--transition-fast)',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--clay-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--clay)'; }}
      >
        <Plus size={14} strokeWidth={2.2} />
        {t('app.emptyCta')}
      </motion.button>
    </motion.div>
  );
}
