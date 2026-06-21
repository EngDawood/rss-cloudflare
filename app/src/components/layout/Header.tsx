import React from 'react';
import { Sun, Moon, Gear } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';

const CRUMBS: Record<string, string> = {
  feeds: 'Your Feeds',
  reader: 'Reader',
  telegram: 'Telegram',
  folo: 'Folo Webhook',
  sandbox: 'Post Sandbox',
  logs: 'Recall & Logs',
  mcp: 'MCP Settings',
  workflows: 'Workflows',
  playground: 'Playground',
  chat: 'Agent Chat',
  instances: 'Instances',
  test: 'Test Parser',
};

export const Header: React.FC = () => {
  const {
    activeTab,
    theme,
    setTheme,
    isAuthenticated,
    token,
    setTempToken,
    setIsTokenModalOpen,
  } = useApp();

  const crumb = CRUMBS[activeTab] || activeTab;

  const seg = (on: boolean) =>
    `btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${
      on ? 'bg-accent text-onaccent' : 'bg-transparent text-muted hover:text-ink'
    }`;

  return (
    <header className="h-16 flex-none border-b border-border-base flex items-center px-7 gap-3.5 bg-surface relative z-30">
      <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-muted truncate">{crumb}</div>

      <div className="ml-auto flex items-center gap-3">
        {/* Theme segmented toggle */}
        <div className="flex bg-bg-base border border-border-base rounded-full p-[3px] gap-0.5">
          <button onClick={() => setTheme('light')} className={seg(theme === 'light')}>
            <Sun size={13} weight="bold" />
            <span className="hidden sm:inline">Light</span>
          </button>
          <button onClick={() => setTheme('dark')} className={seg(theme === 'dark')}>
            <Moon size={13} weight="bold" />
            <span className="hidden sm:inline">Dark</span>
          </button>
        </div>

        {/* Auth pill */}
        <div
          className={`hidden md:flex items-center gap-2 px-3 py-[7px] rounded-full text-xs font-semibold ${
            isAuthenticated === true
              ? 'bg-ok-soft text-ok'
              : isAuthenticated === false
              ? 'bg-accent-soft text-accent'
              : 'bg-bg-input text-muted'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isAuthenticated === true ? 'bg-ok' : isAuthenticated === false ? 'bg-accent' : 'bg-muted'
            }`}
          />
          {isAuthenticated === true ? 'Authenticated' : isAuthenticated === false ? 'No Access' : 'Connecting'}
        </div>

        {/* Settings gear */}
        <button
          onClick={() => { setTempToken(token); setIsTokenModalOpen(true); }}
          title="Setup access token"
          className="btn-press w-[38px] h-[38px] rounded-full border border-line-strong bg-bg-base text-ink-soft hover:text-accent flex items-center justify-center cursor-pointer"
        >
          <Gear size={15} />
        </button>
      </div>
    </header>
  );
};
