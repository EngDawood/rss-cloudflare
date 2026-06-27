import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash, Robot } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';

type MergedTarget = {
  chatId: string;
  displayName: string;
  chatName?: string;   // name in chats table — needed for remove/default actions
  botName?: string;    // name in channels table
  type: string;
  isDefault: boolean;
  source: 'chat' | 'channel' | 'both';
  enabled?: boolean;
};

export const TelegramTab: React.FC = () => {
  const {
    chats,
    channels,
    loadChats,
    callApi,
    showToast,
  } = useApp();

  // Load chats on mount (channels are loaded by AppContext on init)
  useEffect(() => { loadChats(); }, []);

  // Modal State
  const [isAddChatOpen, setIsAddChatOpen] = useState(false);
  const [chatName, setChatName] = useState('');
  const [chatIdVal, setChatIdVal] = useState('');
  const [chatType, setChatType] = useState('channel');
  const [chatDefault, setChatDefault] = useState(false);

  const springTransition = { type: 'spring', stiffness: 100, damping: 20 } as const;

  // Merge channels (bot) + chats (UI), deduplicated by numeric chat ID
  const merged = useMemo<MergedTarget[]>(() => {
    const map = new Map<string, MergedTarget>();

    for (const ch of channels) {
      map.set(ch.id, {
        chatId: ch.id,
        displayName: ch.name,
        botName: ch.name,
        type: 'channel',
        isDefault: false,
        source: 'channel',
        enabled: ch.enabled === 1,
      });
    }

    for (const chat of chats) {
      const existing = map.get(chat.chat_id);
      if (existing) {
        map.set(chat.chat_id, {
          ...existing,
          displayName: chat.name,
          chatName: chat.name,
          type: chat.type,
          isDefault: chat.is_default === 1,
          source: 'both',
        });
      } else {
        map.set(chat.chat_id, {
          chatId: chat.chat_id,
          displayName: chat.name,
          chatName: chat.name,
          type: chat.type,
          isDefault: chat.is_default === 1,
          source: 'chat',
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (a.isDefault) return -1;
      if (b.isDefault) return 1;
      return 0;
    });
  }, [channels, chats]);

  const handleAddChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddChatOpen(false);
    const res = await callApi('add_chat', { name: chatName, chatId: chatIdVal, type: chatType, makeDefault: chatDefault });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Chat target registered!', 'success');
      loadChats();
    }
    setChatName('');
    setChatIdVal('');
    setChatType('channel');
    setChatDefault(false);
  };

  const handleSetDefaultChat = async (name: string) => {
    const res = await callApi('set_default_chat', { name });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Default target updated.', 'success');
      loadChats();
    }
  };

  const handleRemoveChat = async (name: string) => {
    if (!confirm(`Remove chat target "${name}"?`)) return;
    const res = await callApi('remove_chat', { name });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Chat target removed.', 'success');
      loadChats();
    }
  };

  return (
    <motion.div
      key="telegram"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="h-full rr-scroll px-6 md:px-10 py-8 flex flex-col gap-6"
    >
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="font-display font-semibold text-[32px] leading-none text-ink">Telegram Targets</h2>
          <p className="font-display italic text-[15px] text-muted mt-1.5">Channels and groups that receive dispatches</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsAddChatOpen(true)}
          className="btn-press flex items-center gap-2 px-[18px] py-2.5 text-[13px] font-semibold text-onaccent bg-accent rounded-full hover:bg-accent-primary-hover transition cursor-pointer"
        >
          <Plus size={14} weight="bold" />
          <span>Register chat</span>
        </motion.button>
      </div>

      {/* Unified grid — channels + chats merged */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {merged.length === 0 ? (
          <div className="md:col-span-2 p-12 text-center border border-dashed border-border-base rounded-2xl bg-bg-card/25 text-sm text-text-muted">
            No targets yet. Add a channel via the bot (<code>/add @channel</code>) or click "Register chat".
          </div>
        ) : (
          merged.map(target => (
            <motion.div
              key={target.chatId}
              whileHover={{ y: -2 }}
              transition={springTransition}
              className={`liquid-glass p-6 rounded-2xl flex flex-col justify-between relative ${
                target.isDefault ? 'border-accent-primary/20 bg-accent-primary/5' : ''
              }`}
            >
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-bold text-base text-text-base">{target.displayName}</span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {/* Source badges */}
                    {(target.source === 'channel' || target.source === 'both') && (
                      <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase bg-emerald-950/30 text-emerald-400 border border-emerald-900/20">
                        <Robot size={9} weight="bold" />
                        Bot
                      </span>
                    )}
                    {(target.source === 'chat' || target.source === 'both') && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase bg-accent-primary/10 text-accent-primary">
                        {target.type}
                      </span>
                    )}
                  </div>
                </div>

                <span className="text-xs text-text-muted font-mono block select-all">{target.chatId}</span>

                {/* Show both names when they differ */}
                {target.source === 'both' && target.botName && target.botName !== target.displayName && (
                  <span className="text-[11px] text-text-muted/60">Bot name: {target.botName}</span>
                )}
              </div>

              <div className="flex justify-between items-center mt-6 pt-4 border-t border-border-base">
                {target.chatName ? (
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    target.isDefault
                      ? 'bg-accent-primary/20 text-accent-primary'
                      : 'bg-bg-input text-text-muted/60'
                  }`}>
                    {target.isDefault ? 'Default Destination' : 'Secondary Destination'}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-bg-input text-text-muted/60">
                    Bot Managed
                  </span>
                )}

                <div className="flex gap-2">
                  {target.chatName && !target.isDefault && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleSetDefaultChat(target.chatName!)}
                      className="px-3 py-1.5 text-xs font-bold rounded-xl bg-bg-input border border-border-base text-text-base hover:text-text-base cursor-pointer transition"
                    >
                      Make Default
                    </motion.button>
                  )}
                  {target.chatName && (
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleRemoveChat(target.chatName!)}
                      className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 cursor-pointer transition duration-200"
                    >
                      <Trash size={14} />
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* MODAL: Register Chat */}
      <Modal
        isOpen={isAddChatOpen}
        onClose={() => setIsAddChatOpen(false)}
        title="Register Telegram Target"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddChatOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleAddChat}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition"
            >
              Register
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Friendly Name (Internal identifier)</label>
          <input
            type="text"
            value={chatName}
            onChange={e => setChatName(e.target.value)}
            placeholder="e.g. main_channel"
            className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold mt-1"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Chat ID or Username</label>
          <input
            type="text"
            value={chatIdVal}
            onChange={e => setChatIdVal(e.target.value)}
            placeholder="e.g. @mychannel or -100123456789"
            className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono mt-1"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Chat Type</label>
          <select
            value={chatType}
            onChange={e => setChatType(e.target.value)}
            className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold cursor-pointer mt-1"
            required
          >
            <option value="channel">Channel</option>
            <option value="group">Group</option>
            <option value="private">Private Chat</option>
            <option value="bot">Bot Direct Conversation</option>
          </select>
        </div>
        <div className="flex items-center gap-3.5 mt-3 select-none cursor-pointer">
          <input
            type="checkbox"
            id="modalChatDefault"
            checked={chatDefault}
            onChange={e => setChatDefault(e.target.checked)}
            className="w-4 h-4 rounded border-border-base bg-bg-input text-accent-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
          />
          <label htmlFor="modalChatDefault" className="text-xs text-text-base font-semibold cursor-pointer">Make this the default send target</label>
        </div>
      </Modal>
    </motion.div>
  );
};
export default TelegramTab;
