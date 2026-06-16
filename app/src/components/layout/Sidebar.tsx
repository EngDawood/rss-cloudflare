import React from 'react';
import { motion } from 'framer-motion';
import {
  Rss, BookOpen, TelegramLogo, PaperPlaneTilt,
  Clock, Terminal, ChatCircleText, CaretLeft, CaretRight,
  GlobeSimple, MagnifyingGlass, Robot, Cpu
} from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';

export const Sidebar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    setSidebarCollapsed
  } = useApp();

  const springTransition = { type: 'spring', stiffness: 100, damping: 20 } as const;

  const menuItems = [
    { id: 'feeds', label: 'RSS Feeds', icon: Rss },
    { id: 'reader', label: 'Feed Reader', icon: BookOpen },
    { id: 'telegram', label: 'Telegram Targets', icon: TelegramLogo },
    { id: 'sandbox', label: 'Post Sandbox', icon: PaperPlaneTilt },
    { id: 'logs', label: 'Recall & Logs', icon: Clock },
    { id: 'mcp', label: 'MCP Settings', icon: Robot },
    { id: 'workflows', label: 'Workflows', icon: Cpu },
    { id: 'playground', label: 'MCP Playground', icon: Terminal },
    { id: 'chat', label: 'Agent Chat', icon: ChatCircleText },
    { id: 'instances', label: 'Instances', icon: GlobeSimple },
    { id: 'test', label: 'Test Parser', icon: MagnifyingGlass }
  ];

  return (
    <aside className="relative">
      <motion.div 
        animate={{ width: sidebarCollapsed ? 72 : 240 }}
        transition={springTransition}
        className="liquid-glass rounded-2xl p-4 flex flex-col justify-between h-[calc(100vh-200px)] sticky top-28 overflow-hidden"
      >
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col gap-1.5">
            {menuItems.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-semibold transition duration-200 relative cursor-pointer ${
                      active ? 'bg-accent-primary/10 text-accent-primary font-bold border-l-2 border-accent-primary' : 'text-text-muted hover:text-text-base hover:bg-white/5'
                    }`}
                  >
                    <Icon size={18} className="flex-shrink-0" />
                    {!sidebarCollapsed && (
                      <motion.span 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="truncate"
                      >
                        {tab.label}
                      </motion.span>
                    )}
                  </motion.button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Sidebar toggle */}
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="mt-auto flex items-center justify-center p-3 rounded-xl border border-border-base bg-bg-input text-text-muted hover:text-text-base cursor-pointer transition w-full"
        >
          {sidebarCollapsed ? <CaretRight size={16} /> : <CaretLeft size={16} />}
        </motion.button>
      </motion.div>
    </aside>
  );
};
