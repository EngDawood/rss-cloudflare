import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash, Copy, Check, Info, Broadcast, CaretDown, CaretUp } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';

interface FoloWebhookEntry {
  id: string;
  name: string;
  webhookUrl: string;
  channels: string[];
}

interface FoloConfig {
  legacy: { webhookUrl: string; channels: string[]; hasSecret: boolean };
  webhooks: FoloWebhookEntry[];
}

export const FoloTab: React.FC = () => {
  const { chats, loadChats, callApi, showToast } = useApp();

  const [config, setConfig] = useState<FoloConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [expandedLegacy, setExpandedLegacy] = useState(false);

  // Create webhook modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createId, setCreateId] = useState('');
  const [createName, setCreateName] = useState('');

  // Subscribe modal
  const [subscribeTarget, setSubscribeTarget] = useState<{ webhookId: string | null; webhookName: string } | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState('');

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await callApi('get_folo_config');
    if (res.error) showToast(res.error, 'error');
    else setConfig(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadChats();
    load();
  }, []);

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    showToast('Webhook URL copied!', 'success');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleCreateWebhook = async () => {
    if (!createId.trim() || !createName.trim()) {
      showToast('ID and name are required.', 'warning');
      return;
    }
    setIsCreateOpen(false);
    const res = await callApi('create_folo_webhook', { id: createId.trim(), name: createName.trim() });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Webhook "${createName}" created!`, 'success');
      setCreateId('');
      setCreateName('');
      load(true);
    }
  };

  const handleDeleteWebhook = async (id: string, name: string) => {
    if (!confirm(`Delete webhook "${name}" and all its channel subscriptions?`)) return;
    const res = await callApi('delete_folo_webhook', { id });
    if (res.error) showToast(res.error, 'error');
    else { showToast(`Webhook "${name}" deleted.`, 'success'); load(true); }
  };

  const handleSubscribe = async () => {
    if (!selectedChannelId || !subscribeTarget) return;
    setSubscribeTarget(null);
    const res = await callApi('add_folo_channel', {
      channelId: selectedChannelId,
      ...(subscribeTarget.webhookId ? { webhookId: subscribeTarget.webhookId } : {}),
    });
    if (res.error) showToast(res.error, 'error');
    else { showToast('Channel subscribed!', 'success'); load(true); }
    setSelectedChannelId('');
  };

  const handleUnsubscribe = async (channelId: string, channelName: string, webhookId: string | null, webhookName: string) => {
    if (!confirm(`Unsubscribe "${channelName}" from "${webhookName}"?`)) return;
    const res = await callApi('remove_folo_channel', {
      channelId,
      ...(webhookId ? { webhookId } : {}),
    });
    if (res.error) showToast(res.error, 'error');
    else { showToast('Channel unsubscribed.', 'success'); load(true); }
  };

  // Channels not yet subscribed to a given subscription list
  const availableChats = (subscribedIds: string[]) =>
    chats.filter(c => !subscribedIds.includes(c.chat_id));

  const renderChannelList = (channelIds: string[], webhookId: string | null, webhookName: string) => {
    if (channelIds.length === 0) {
      return (
        <div className="p-4 text-center border border-dashed border-border-base rounded-xl bg-bg-card/25 text-xs text-text-muted">
          No channels subscribed. Webhook payloads will be silently ignored.
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {channelIds.map(cid => {
          const chat = chats.find(c => c.chat_id === cid);
          const displayName = chat?.name || `Chat (${cid})`;
          return (
            <div key={cid} className="bg-bg-input border border-border-base rounded-xl p-3 flex justify-between items-center gap-3">
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-text-base truncate">{displayName}</span>
                <span className="text-[10px] text-text-muted font-mono truncate select-all">{cid}</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => handleUnsubscribe(cid, displayName, webhookId, webhookName)}
                className="p-2 rounded-lg bg-rose-950/20 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 cursor-pointer transition flex-shrink-0"
                title="Unsubscribe"
              >
                <Trash size={12} />
              </motion.button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderUrlRow = (url: string) => (
    <div className="bg-bg-input border border-border-base rounded-xl p-3 flex justify-between items-center gap-3">
      <span className="font-mono text-xs select-all text-text-base break-all flex-grow leading-relaxed">{url}</span>
      <motion.button
        whileTap={{ scale: 0.95 }}
        onClick={() => handleCopy(url)}
        className="p-2 rounded-lg bg-white/5 border border-border-base text-text-muted hover:text-text-base cursor-pointer transition flex-shrink-0"
        title="Copy URL"
      >
        {copiedUrl === url ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
      </motion.button>
    </div>
  );

  return (
    <motion.div
      key="folo"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-bold text-2xl tracking-tight text-text-base flex items-center gap-2.5">
            <Broadcast className="text-accent-primary" size={26} />
            <span>Folo Webhooks</span>
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Receive entry updates from Folo and deliver them to Telegram channels
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-white bg-accent-primary rounded-xl hover:bg-accent-primary-hover transition shadow-md cursor-pointer"
        >
          <Plus size={13} />
          <span>New Webhook</span>
        </motion.button>
      </div>

      {loading ? (
        <div className="flex flex-col gap-4">
          {[1, 2].map(i => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Legacy webhook (env secret) */}
          {config?.legacy && (
            <div className="liquid-glass rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedLegacy(v => !v)}
                className="w-full flex justify-between items-center p-5 cursor-pointer hover:bg-white/3 transition"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm text-text-base">Legacy Webhook</span>
                  {config.legacy.hasSecret ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      Secret Active
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      No Secret
                    </span>
                  )}
                  <span className="text-[10px] text-text-muted">{config.legacy.channels.length} channel(s)</span>
                </div>
                {expandedLegacy ? <CaretUp size={14} className="text-text-muted" /> : <CaretDown size={14} className="text-text-muted" />}
              </button>
              <AnimatePresence>
                {expandedLegacy && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 flex flex-col gap-4 border-t border-border-base pt-4">
                      <div>
                        <p className="text-xs text-text-muted mb-2">Webhook URL (uses <code>FOLO_WEBHOOK_SECRET</code> env var)</p>
                        {renderUrlRow(config.legacy.webhookUrl)}
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-text-base">Subscribed Channels</span>
                        <button
                          onClick={() => { setSubscribeTarget({ webhookId: null, webhookName: 'Legacy Webhook' }); setSelectedChannelId(''); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-accent-primary rounded-lg hover:bg-accent-primary-hover cursor-pointer transition"
                        >
                          <Plus size={11} /> Subscribe
                        </button>
                      </div>
                      {renderChannelList(config.legacy.channels, null, 'Legacy Webhook')}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Named webhooks */}
          {config?.webhooks.length === 0 && !loading && (
            <div className="p-10 text-center border border-dashed border-border-base rounded-2xl bg-bg-card/20 text-xs text-text-muted">
              No named webhooks yet. Click <b>New Webhook</b> to create one.
            </div>
          )}
          {config?.webhooks.map(wh => (
            <WebhookCard
              key={wh.id}
              webhook={wh}
              chats={chats}
              copiedUrl={copiedUrl}
              onCopy={handleCopy}
              onDelete={() => handleDeleteWebhook(wh.id, wh.name)}
              onSubscribe={() => { setSubscribeTarget({ webhookId: wh.id, webhookName: wh.name }); setSelectedChannelId(''); }}
              onUnsubscribe={(cid, name) => handleUnsubscribe(cid, name, wh.id, wh.name)}
              renderChannelList={renderChannelList}
              renderUrlRow={renderUrlRow}
            />
          ))}
        </div>
      )}

      {/* How-to */}
      <div className="bg-bg-input/20 border border-border-base rounded-xl p-5 flex gap-4">
        <Info size={18} className="text-accent-primary flex-shrink-0 mt-0.5" />
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-bold text-text-base">Setup</span>
          <ol className="list-decimal list-inside text-xs text-text-muted flex flex-col gap-1 leading-relaxed">
            <li>Click <b>New Webhook</b> to create a named webhook instance.</li>
            <li>Copy its URL and paste it into your Folo client's webhook action (POST method).</li>
            <li>Subscribe Telegram channels to receive the delivered posts.</li>
            <li>Each webhook gets its own category in the Feed Reader for easy filtering.</li>
          </ol>
        </div>
      </div>

      {/* MODAL: Create webhook */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Folo Webhook"
        footer={
          <>
            <button onClick={() => setIsCreateOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition">
              Cancel
            </button>
            <button onClick={handleCreateWebhook} disabled={!createId.trim() || !createName.trim()} className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover disabled:opacity-50 cursor-pointer transition">
              Create
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Webhook ID</label>
            <input
              type="text"
              value={createId}
              onChange={e => setCreateId(e.target.value.replace(/\s/g, '-').toLowerCase())}
              placeholder="e.g. personal"
              className="bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono"
            />
            <p className="text-[10px] text-text-muted">Appears in the URL: <code>/folo?id=<b>{createId || 'your-id'}</b></code></p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Display Name</label>
            <input
              type="text"
              value={createName}
              onChange={e => setCreateName(e.target.value)}
              placeholder="e.g. Personal Feeds"
              className="bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary"
            />
            <p className="text-[10px] text-text-muted">Items appear under category <b>Folo: {createName || 'Display Name'}</b> in the Feed Reader.</p>
          </div>
          <p className="text-[10px] text-text-muted bg-bg-input border border-border-base rounded-xl p-3">
            A secure token will be auto-generated. You'll see the full URL after creation.
          </p>
        </div>
      </Modal>

      {/* MODAL: Subscribe channel */}
      <Modal
        isOpen={!!subscribeTarget}
        onClose={() => setSubscribeTarget(null)}
        title={`Subscribe to "${subscribeTarget?.webhookName}"`}
        footer={
          <>
            <button onClick={() => setSubscribeTarget(null)} className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition">
              Cancel
            </button>
            <button onClick={handleSubscribe} disabled={!selectedChannelId} className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover disabled:opacity-50 cursor-pointer transition">
              Subscribe
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Select Telegram Chat</label>
          {availableChats(subscribeTarget ? (
            subscribeTarget.webhookId
              ? (config?.webhooks.find(w => w.id === subscribeTarget.webhookId)?.channels || [])
              : (config?.legacy.channels || [])
          ) : []).length === 0 ? (
            <div className="text-xs text-text-muted mt-2 border border-border-base bg-bg-input p-4 rounded-xl">
              All registered chat targets are already subscribed. Add more under the <b>Telegram</b> tab.
            </div>
          ) : (
            <select
              value={selectedChannelId}
              onChange={e => setSelectedChannelId(e.target.value)}
              className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold cursor-pointer mt-1"
            >
              <option value="">-- Choose target --</option>
              {availableChats(subscribeTarget ? (
                subscribeTarget.webhookId
                  ? (config?.webhooks.find(w => w.id === subscribeTarget.webhookId)?.channels || [])
                  : (config?.legacy.channels || [])
              ) : []).map(chat => (
                <option key={chat.chat_id} value={chat.chat_id}>{chat.name} ({chat.type})</option>
              ))}
            </select>
          )}
        </div>
      </Modal>
    </motion.div>
  );
};

// ── Webhook card sub-component ────────────────────────────────────────────────

interface WebhookCardProps {
  webhook: FoloWebhookEntry;
  chats: any[];
  copiedUrl: string | null;
  onCopy: (url: string) => void;
  onDelete: () => void;
  onSubscribe: () => void;
  onUnsubscribe: (channelId: string, name: string) => void;
  renderChannelList: (ids: string[], webhookId: string | null, name: string) => React.ReactNode;
  renderUrlRow: (url: string) => React.ReactNode;
}

const WebhookCard: React.FC<WebhookCardProps> = ({
  webhook, onCopy: _onCopy, onDelete, onSubscribe, onUnsubscribe, renderChannelList, renderUrlRow,
}) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="liquid-glass rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex justify-between items-center p-5 cursor-pointer hover:bg-white/3 transition"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-text-base">{webhook.name}</span>
          <span className="text-[10px] font-mono text-text-muted bg-white/5 border border-border-base px-2 py-0.5 rounded">
            {webhook.id}
          </span>
          <span className="text-[10px] text-text-muted">{webhook.channels.length} channel(s)</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg bg-rose-950/20 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 cursor-pointer transition"
            title="Delete Webhook"
          >
            <Trash size={12} />
          </motion.button>
          {expanded ? <CaretUp size={14} className="text-text-muted" /> : <CaretDown size={14} className="text-text-muted" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 flex flex-col gap-4 border-t border-border-base pt-4">
              <div>
                <p className="text-xs text-text-muted mb-2">Webhook URL</p>
                {renderUrlRow(webhook.webhookUrl)}
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-text-base">Subscribed Channels</span>
                <button
                  onClick={onSubscribe}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-white bg-accent-primary rounded-lg hover:bg-accent-primary-hover cursor-pointer transition"
                >
                  <Plus size={11} /> Subscribe
                </button>
              </div>
              {renderChannelList(webhook.channels, webhook.id, webhook.name)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FoloTab;
