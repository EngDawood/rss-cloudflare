import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  const springTransition = { type: 'spring', stiffness: 100, damping: 20 } as const;

  return (
    <div className="fixed bottom-6 right-6 flex flex-col gap-2.5 z-[9999]">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 50, y: 10 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 50, scale: 0.9 }}
            transition={springTransition}
            className={`flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl text-sm min-w-[300px] max-w-[400px] shadow-2xl backdrop-blur-md border border-border-base ${
              toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30' :
              toast.type === 'error' ? 'bg-rose-950/90 text-rose-300 border-rose-500/30' :
              toast.type === 'warning' ? 'bg-amber-950/90 text-amber-300 border-amber-500/30' :
              'bg-bg-card text-text-base'
            }`}
          >
            <span>{toast.message}</span>
            <button 
              onClick={() => removeToast(toast.id)} 
              className="text-text-muted hover:text-text-base text-lg cursor-pointer transition flex items-center justify-center"
            >
              <X size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
