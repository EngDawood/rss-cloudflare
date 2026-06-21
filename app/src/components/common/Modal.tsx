import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-[#1a140f]/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-surface border border-line-strong w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4.5 border-b border-line flex justify-between items-center">
              <h3 className="font-display font-semibold text-lg text-ink">{title}</h3>
              <button 
                type="button" 
                onClick={onClose} 
                className="text-text-muted hover:text-text-base text-xl cursor-pointer transition"
              >
                &times;
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
              {children}
            </div>

            {footer && (
              <div className="px-6 py-4 border-t border-line bg-bg-base flex justify-end gap-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
