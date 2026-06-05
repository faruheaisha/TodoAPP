import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

export default function EmptyState() {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col items-center justify-center px-8 text-center"
    >
      {/* Minimal icon — no dotted line, just solid */}
      <motion.div
        animate={{ y: [0, -3, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        className="mb-5"
      >
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            backgroundColor: 'var(--clay-light)',
            border: '1px solid var(--clay)',
          }}
        >
          <Plus size={18} style={{ color: 'var(--clay)' }} />
        </div>
      </motion.div>

      <p
        className="text-sm font-medium mb-1.5 select-none"
        style={{
          color: 'var(--slate-md)',
          letterSpacing: 'var(--tracking-loose)',
        }}
      >
        {t('app.empty')}
      </p>
      <p
        className="text-xs max-w-xs select-none"
        style={{
          color: 'var(--cloud)',
          lineHeight: 1.6,
        }}
      >
        在上方输入你的第一个待办事项
      </p>
    </motion.div>
  );
}