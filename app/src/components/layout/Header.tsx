import React from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun, ShieldCheck, ShieldWarning, Gear } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';

export const Header: React.FC = () => {
  const {
    theme,
    setTheme,
    isAuthenticated,
    token,
    setTempToken,
    setIsTokenModalOpen
  } = useApp();

  return (
    <header className="sticky top-0 bg-bg-card/75 backdrop-blur-md border-b border-border-base px-8 py-5 flex items-center justify-between z-40">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-accent-primary flex items-center justify-center font-bold text-white shadow-lg shadow-accent-primary/10">R</div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-bold text-xl leading-tight bg-gradient-to-r from-text-base to-text-muted bg-clip-text text-transparent">RSS Bridge & MCP</h1>
            <span className="w-1.5 h-1.5 rounded-full bg-accent-primary shadow-[0_0_10px_var(--color-accent-primary)]" />
          </div>
          <span className="text-[10px] text-text-muted font-mono tracking-widest uppercase">Cloudflare Worker Panel</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Light/Dark Toggle Button */}
        <motion.button 
          whileTap={{ scale: 0.95 }}
          onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          className="p-2.5 rounded-xl bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition flex items-center justify-center"
          title="Toggle theme mode"
        >
          {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
        </motion.button>

        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
          isAuthenticated === true ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
          isAuthenticated === false ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
          'bg-bg-input text-text-muted border-border-base'
        }`}>
          {isAuthenticated === true ? <ShieldCheck size={14} className="text-emerald-400" /> : <ShieldWarning size={14} className="text-rose-400" />}
          <span className="font-mono">{isAuthenticated === true ? 'Authenticated' : isAuthenticated === false ? 'No Access' : 'Connecting'}</span>
        </div>

        <motion.button 
          whileTap={{ scale: 0.98 }}
          onClick={() => { setTempToken(token); setIsTokenModalOpen(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base transition duration-200 cursor-pointer"
        >
          <Gear size={14} />
          <span>Setup Token</span>
        </motion.button>
      </div>
    </header>
  );
};
