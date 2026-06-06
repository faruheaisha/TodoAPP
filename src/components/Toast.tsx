import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, Loader } from 'lucide-react';

type ToastType = 'success' | 'loading' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  show: (message: string, type?: ToastType) => string;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType>({
  show: () => '',
  dismiss: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    if (type !== 'loading') {
      setTimeout(() => dismiss(id), 3000);
    }
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -12, x: 20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border text-xs font-medium"
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderColor: 'var(--color-border)',
                color: 'var(--color-text-primary)',
                maxWidth: '320px',
              }}
            >
              {toast.type === 'loading' ? (
                <Loader size={14} className="animate-spin" style={{ color: 'var(--clay)' }} />
              ) : (
                <Check size={14} style={{ color: 'var(--olive)' }} />
              )}
              {toast.message}
              <button
                onClick={() => dismiss(toast.id)}
                className="ml-1 flex-shrink-0"
                style={{ color: 'var(--color-text-tertiary)' }}
              >
                <X size={12} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}