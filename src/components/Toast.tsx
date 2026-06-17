import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type ToastType = 'success' | 'info' | 'warning';

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
  const [toast, setToast] = useState<Toast | null>(null);

  const show = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToast({ id, message, type });
    setTimeout(() => dismiss(id), 3000);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToast((prev) => (prev?.id === id ? null : prev));
  }, []);

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center" style={{ isolation: 'isolate' }}>
        <AnimatePresence mode="wait">
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, scale: 0.92, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ type: 'spring', damping: 26, stiffness: 280, duration: 0.25 }}
              className="pointer-events-auto flex items-center gap-3 px-5 py-3 rounded-xl border shadow-lg"
              style={{
                backgroundColor: 'var(--color-bg-secondary, #ffffff)',
                borderColor: toast.type === 'success' ? 'rgba(120,140,93,0.3)' : toast.type === 'warning' ? 'rgba(217,119,87,0.3)' : 'var(--color-border)',
                color: 'var(--color-text-primary)',
                backdropFilter: 'blur(12px)',
              }}
            >
              {/* Status dot */}
              <span
                style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: toast.type === 'success' ? 'var(--olive, #788c5d)' : toast.type === 'warning' ? 'var(--clay, #d97757)' : 'var(--clay, #d97757)',
                }}
              />
              <span style={{ fontSize: 12.5, fontWeight: 500, letterSpacing: '0.01em' }}>
                {toast.message}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
