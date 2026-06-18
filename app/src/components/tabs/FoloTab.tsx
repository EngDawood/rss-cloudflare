import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash, Copy, Check, Info, Broadcast } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';

export const FoloTab: React.FC = () => {
  const {
    chats,
    loadChats,
    callApi,
    showToast
  } = useApp();

  const [foloConfig, setFoloConfig] = useState<{ webhookUrl: string; channels: string[]; hasSecret: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isSubscribeOpen, setIsSubscribeOpen] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState('');

  const springTransition = { type: 'spring', stiffness: 100, damping: 20 } as const;

  const loadFoloConfig = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await callApi('get_folo_config');
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      setFoloConfig(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadChats();
    loadFoloConfig();
  }, []);

  const handleCopy = () => {
    if (!foloConfig) return;
    navigator.clipboard.writeText(foloConfig.webhookUrl);
    setCopied(true);
    showToast('Webhook URL copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubscribe = async () => {
    if (!selectedChannelId) {
      showToast('Please select a channel to subscribe.', 'warning');
      return;
    }
    setIsSubscribeOpen(false);
    const res = await callApi('add_folo_channel', { channelId: selectedChannelId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Channel subscribed to Folo updates!', 'success');
      loadFoloConfig(true);
    }
    setSelectedChannelId('');
  };

  const handleUnsubscribe = async (channelId: string, name: string) => {
    if (!confirm(`Unsubscribe "${name}" from Folo webhooks?`)) return;
    const res = await callApi('remove_folo_channel', { channelId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Channel unsubscribed.', 'success');
      loadFoloConfig(true);
    }
  };

  // Find chats that are not yet subscribed to Folo
  const unsubscribedChats = chats.filter(
    (chat) => !foloConfig?.channels.includes(chat.chat_id)
  );

  return (
    <motion.div
      key="folo"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-6"
    >
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-bold text-2xl tracking-tight text-text-base flex items-center gap-2.5">
            <Broadcast className="text-accent-primary" size={26} />
            <span>Folo Webhook Integration</span>
          </h2>
          <p className="text-xs text-text-muted mt-1">Receive entry updates from your Folo client and deliver them directly to Telegram channels</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Top: Webhook Config Info */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="liquid-glass p-6 rounded-2xl flex flex-col gap-5 relative">
            <div className="flex justify-between items-center">
              <span className="font-bold text-base text-text-base">Webhook Endpoint</span>
              {loading ? (
                <div className="h-5 w-24 bg-white/5 rounded animate-pulse" />
              ) : foloConfig?.hasSecret ? (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Secret Active
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  No Secret
                </span>
              )}
            </div>

            <div className="flex flex-col gap-2.5">
              <p className="text-xs text-text-muted">
                Configure this webhook URL inside your Folo RSS client. Webhook payloads will be processed, optionally enriched with Telegraph and media direct links, and routed to subscribed channels.
              </p>
              
              <div className="bg-bg-input border border-border-base rounded-xl p-4 flex justify-between items-center gap-4 mt-2">
                <span className="font-mono text-xs select-all text-text-base break-all flex-grow leading-relaxed">
                  {loading ? 'Fetching URL...' : foloConfig?.webhookUrl || 'Webhook endpoint not found'}
                </span>
                {!loading && foloConfig?.webhookUrl && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopy}
                    className="p-2.5 rounded-lg bg-white/5 border border-border-base text-text-muted hover:text-text-base cursor-pointer transition flex-shrink-0"
                    title="Copy to Clipboard"
                  >
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </motion.button>
                )}
              </div>
            </div>

            {/* Quick Setup Instructions */}
            <div className="bg-bg-input/20 border border-border-base rounded-xl p-5 flex gap-4 mt-1">
              <Info size={20} className="text-accent-primary flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-text-base">How to set up Folo Webhooks:</span>
                <ol className="list-decimal list-inside text-xs text-text-muted flex flex-col gap-1 leading-relaxed">
                  <li>Copy the Webhook URL above.</li>
                  <li>In your Folo client, go to <b>Actions</b> or <b>Webhooks</b>.</li>
                  <li>Create a webhook action, paste the URL, and select <b>POST</b> method.</li>
                  <li>Subscribe Telegram channels in the panel on the right to receive posts.</li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        {/* Right/Bottom: Subscribed Channels list */}
        <div className="flex flex-col gap-6">
          <div className="liquid-glass p-6 rounded-2xl flex flex-col gap-5 relative h-full justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="font-bold text-base text-text-base">Subscribed Targets</span>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setIsSubscribeOpen(true)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-accent-primary rounded-lg hover:bg-accent-primary-hover disabled:opacity-50 transition shadow-md cursor-pointer"
                >
                  <Plus size={12} />
                  <span>Subscribe</span>
                </motion.button>
              </div>

              {loading ? (
                <div className="flex flex-col gap-2">
                  <div className="h-12 w-full bg-white/5 rounded-xl animate-pulse" />
                  <div className="h-12 w-full bg-white/5 rounded-xl animate-pulse" />
                </div>
              ) : !foloConfig?.channels || foloConfig.channels.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-border-base rounded-xl bg-bg-card/25 text-xs text-text-muted">
                  No channels subscribed. Webhook payloads will be silently ignored.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
                  {foloConfig.channels.map((channelId) => {
                    const matchedChat = chats.find((c) => c.chat_id === channelId);
                    const displayName = matchedChat?.name || `Chat (${channelId})`;
                    return (
                      <motion.div
                        key={channelId}
                        whileHover={{ y: -1 }}
                        transition={springTransition}
                        className="bg-bg-input border border-border-base rounded-xl p-3 flex justify-between items-center gap-3"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-text-base truncate">
                            {displayName}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono truncate select-all">
                            {channelId}
                          </span>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleUnsubscribe(channelId, displayName)}
                          className="p-2 rounded-lg bg-rose-950/20 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 cursor-pointer transition flex-shrink-0"
                          title="Unsubscribe Channel"
                        >
                          <Trash size={12} />
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Subscribe Channel */}
      <Modal
        isOpen={isSubscribeOpen}
        onClose={() => setIsSubscribeOpen(false)}
        title="Subscribe Channel to Folo Webhook"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsSubscribeOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { void handleSubscribe(); }}
              disabled={!selectedChannelId}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover disabled:opacity-50 cursor-pointer transition"
            >
              Subscribe
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Select Telegram Chat Target</label>
          {unsubscribedChats.length === 0 ? (
            <div className="text-xs text-text-muted mt-2 border border-border-base bg-bg-input p-4 rounded-xl">
              All registered Telegram chat targets are already subscribed to Folo. Add more targets under the <b>Telegram Targets</b> tab first.
            </div>
          ) : (
            <select
              value={selectedChannelId}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold cursor-pointer mt-1"
              required
            >
              <option value="">-- Choose target --</option>
              {unsubscribedChats.map((chat) => (
                <option key={chat.chat_id} value={chat.chat_id}>
                  {chat.name} ({chat.type})
                </option>
              ))}
            </select>
          )}
        </div>
      </Modal>
    </motion.div>
  );
};
export default FoloTab;
