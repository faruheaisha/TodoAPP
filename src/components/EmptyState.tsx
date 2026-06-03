import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';

export default function EmptyState() {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex-1 flex flex-col items-center justify-center px-8 text-center"
    >
      {/* Illustration */}
      <motion.div
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-6"
      >
        <svg
          width="80"
          height="80"
          viewBox="0 0 80 80"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="40" cy="40" r="36" stroke="var(--color-border)" strokeWidth="1.5" />
          <circle cx="40" cy="40" r="6" fill="var(--color-accent)" opacity="0.3" />
          <circle cx="40" cy="40" r="16" stroke="var(--color-accent)" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />
          <path d="M36 40 L39 43 L45 37" stroke="var(--color-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
        </svg>
      </motion.div>

      <h2
        className="text-sm font-semibold mb-2"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {t('app.empty')}
      </h2>
      <p
        className="text-xs max-w-xs"
        style={{ color: 'var(--color-text-tertiary)' }}
      >
        在上方输入框中添加你的第一个待办事项
      </p>
    </motion.div>
  );
}
