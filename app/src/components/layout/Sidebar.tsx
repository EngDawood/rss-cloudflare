import React from 'react';
import {
  Rss, BookOpen, TelegramLogo, ShareNetwork,
  ChatCircleText, Terminal, FlowArrow, PaperPlaneTilt,
  Clock, Robot, GlobeSimple, MagnifyingGlass,
} from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';

interface NavItem {
  id: string;
  label: string;
  icon: Icon;
  badge?: number;
}

export const Sidebar: React.FC = () => {
  const { activeTab, setActiveTab, feeds } = useApp();

  const unreadTotal = (feeds || []).reduce(
    (n: number, f: any) => n + (Number(f.unread_count ?? f.unread ?? f.unreadCount ?? 0) || 0),
    0
  );

  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: 'Library',
      items: [
        { id: 'feeds', label: 'Your Feeds', icon: Rss },
        { id: 'reader', label: 'Reader', icon: BookOpen, badge: unreadTotal },
        { id: 'telegram', label: 'Telegram', icon: TelegramLogo },
        { id: 'folo', label: 'Folo Webhook', icon: ShareNetwork },
      ],
    },
    {
      title: 'Agent',
      items: [
        { id: 'chat', label: 'Agent Chat', icon: ChatCircleText },
        { id: 'playground', label: 'Playground', icon: Terminal },
        { id: 'workflows', label: 'Workflows', icon: FlowArrow },
        { id: 'sandbox', label: 'Post Sandbox', icon: PaperPlaneTilt },
      ],
    },
    {
      title: 'System',
      items: [
        { id: 'logs', label: 'Recall & Logs', icon: Clock },
        { id: 'mcp', label: 'MCP Settings', icon: Robot },
        { id: 'instances', label: 'Instances', icon: GlobeSimple },
        { id: 'test', label: 'Test Parser', icon: MagnifyingGlass },
      ],
    },
  ];

  return (
    <aside className="w-[250px] flex-none border-r border-border-base bg-surface flex-col px-4 py-[22px] relative z-20 hidden md:flex">
      {/* Brand */}
      <div className="flex items-center gap-3 px-2 pb-[22px] mb-[18px] border-b border-border-base">
        <div className="w-10 h-10 rounded-full bg-accent text-onaccent flex items-center justify-center font-display font-semibold text-[22px] flex-none">
          R
        </div>
        <div className="min-w-0">
          <div className="font-display font-semibold text-[18px] text-ink leading-none">The Reading Room</div>
          <div className="font-mono text-[8px] tracking-[0.18em] uppercase text-muted mt-1">RSS Bridge · MCP</div>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 min-h-0 rr-scroll -mx-1 px-1">
        {groups.map(group => (
          <div key={group.title} className="mb-1.5">
            <div className="font-mono text-[9px] tracking-[0.14em] uppercase text-muted px-2.5 pt-3.5 pb-2">
              {group.title}
            </div>
            <ul className="flex flex-col gap-0.5">
              {group.items.map(item => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveTab(item.id)}
                      className={`btn-press w-full flex items-center gap-3 px-3 py-[11px] rounded-[10px] text-[13.5px] text-left cursor-pointer ${
                        active
                          ? 'bg-accent-soft text-accent font-semibold'
                          : 'bg-transparent text-muted hover:text-ink font-medium'
                      }`}
                    >
                      <Icon size={17} className="flex-none" />
                      <span className="truncate">{item.label}</span>
                      {item.badge !== undefined && item.badge > 0 && (
                        <span className="ml-auto font-mono text-[9px] bg-accent text-onaccent px-[7px] py-px rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer card */}
      <div className="mt-auto flex items-center gap-2.5 p-[11px] rounded-xl bg-bg-base border border-border-base">
        <div className="w-[30px] h-[30px] rounded-full bg-accent flex-none" />
        <div className="min-w-0">
          <div className="text-xs font-semibold text-ink">worker.dev</div>
          <div className="font-mono text-[9px] text-muted">eu-west · v2.4.1</div>
        </div>
      </div>
    </aside>
  );
};
