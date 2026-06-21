import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash, Copy, Check, Info, Broadcast, CaretDown, CaretUp, ArrowsClockwise } from '@phosphor-icons/react';
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

  // Folo feeds state
  const [foloFeeds, setFoloFeeds] = useState<any[]>([]);
  const [foloFeedsLoading, setFoloFeedsLoading] = useState(true);

  // Create webhook modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createId, setCreateId] = useState('');
  const [createName, setCreateName] = useState('');

  // Webhook subscribe modal
  const [subscribeTarget, setSubscribeTarget] = useState<{ webhookId: string | null; webhookName: string } | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState('');

  // Feed subscribe modal
  const [feedSubscribeTarget, setFeedSubscribeTarget] = useState<{ feedId: string; feedTitle: string } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await callApi('get_folo_config');
    if (res.error) showToast(res.error, 'error');
    else setConfig(res.data);
    setLoading(false);
  }, [callApi, showToast]);

  const loadFoloFeeds = useCallback(async (silent = false) => {
    if (!silent) setFoloFeedsLoading(true);
    const res = await callApi('get_folo_feeds');
    if (res.error) showToast(res.error, 'error');
    else setFoloFeeds(res.data || []);
    setFoloFeedsLoading(false);
  }, [callApi, showToast]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadChats();
      load();
      loadFoloFeeds();
    }, 0);
    return () => clearTimeout(timer);
  }, [load, loadChats, loadFoloFeeds]);

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
    else { showToast('Channel subscribed to webhook!', 'success'); load(true); }
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

  // Feed subscription controls
  const handleSubscribeFeed = async () => {
    if (!selectedChannelId || !feedSubscribeTarget) return;
    const { feedId, feedTitle } = feedSubscribeTarget;
    setFeedSubscribeTarget(null);
    const res = await callApi('add_telegram_subscription', {
      channelId: selectedChannelId,
      feedId,
    });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Subscribed channel to "${feedTitle}"!`, 'success');
      loadFoloFeeds(true);
    }
    setSelectedChannelId('');
  };

  const handleUnsubscribeFeed = async (channelId: string, channelName: string, feedId: string, feedTitle: string) => {
    if (!confirm(`Unsubscribe "${channelName}" from feed "${feedTitle}"?`)) return;
    const res = await callApi('remove_telegram_subscription', {
      channelId,
      feedId,
    });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Unsubscribed channel from "${feedTitle}".`, 'success');
      loadFoloFeeds(true);
    }
  };

  const handleToggleFeed = async (feedId: string, currentStatus: number) => {
    const res = await callApi('set_feed_enabled', { feedId, enabled: currentStatus !== 1 });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Feed status updated.', 'success');
      loadFoloFeeds(true);
    }
  };

  const handleRefreshFeed = async (feedId: string) => {
    showToast('Refreshing feed items...', 'info');
    const res = await callApi('refresh_feed', { feedId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Refreshed! Found ${res.data.itemsFetched || 0} items (${res.data.itemsInserted || 0} new).`, 'success');
      loadFoloFeeds(true);
    }
  };

  const handleRemoveFeed = async (feedId: string, title: string) => {
    if (!confirm(`Are you sure you want to delete feed "${title}" and all its unread items?`)) return;
    const res = await callApi('remove_feed', { feedId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Feed "${title}" deleted successfully.`, 'success');
      loadFoloFeeds(true);
    }
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
      className="h-full rr-scroll px-6 md:px-10 py-8 flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="font-display font-semibold text-[32px] leading-none text-ink flex items-center gap-2.5">
            <Broadcast className="text-accent" size={28} />
            <span>Folo Webhooks</span>
          </h2>
          <p className="font-display italic text-[15px] text-muted mt-1.5">
            Manage Folo-derived feeds, channel subscriptions, and webhook configurations
          </p>
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setIsCreateOpen(true)}
          className="btn-press flex items-center gap-1.5 px-[18px] py-2.5 text-[13px] font-semibold text-onaccent bg-accent rounded-full hover:bg-accent-primary-hover transition cursor-pointer"
        >
          <Plus size={13} weight="bold" />
          <span>New webhook</span>
        </motion.button>
      </div>

      {/* ── SECTION 1: FOLO FEEDS ── */}
      <div className="flex flex-col gap-4">
        <h3 className="font-bold text-lg text-text-base flex items-center gap-2">
          <span>Folo Feeds</span>
          {foloFeeds.length > 0 && (
            <span className="text-xs bg-accent-primary/10 text-accent-primary px-2.5 py-0.5 rounded-full font-bold">
              {foloFeeds.length}
            </span>
          )}
        </h3>

        {foloFeedsLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : foloFeeds.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-border-base rounded-2xl bg-bg-card/20 text-xs text-text-muted">
            No Folo feeds registered yet. Pushing entries to a Folo webhook will automatically register them here.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {foloFeeds.map(feed => {
              const channelIds: string[] = feed.telegram_channel_ids || [];
              return (
                <div key={feed.id} className="liquid-glass p-5 rounded-2xl flex flex-col justify-between relative overflow-hidden group min-h-[160px]">
                  <div className="flex flex-col gap-2.5">
                    <div className="flex justify-between items-start gap-4">
                      <span className="font-bold text-sm text-text-base truncate max-w-[70%]" title={feed.title}>{feed.title}</span>
                      <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                        feed.enabled === 1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${feed.enabled === 1 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                        {feed.enabled === 1 ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <span className="text-[11px] text-text-muted font-mono block truncate cursor-pointer hover:text-text-base" onClick={() => handleCopy(feed.url)}>
                      {feed.url}
                    </span>

                    {/* Subscriptions */}
                    <div className="mt-3 flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Subscribed Channels</span>
                        <button
                          onClick={() => { setFeedSubscribeTarget({ feedId: feed.id, feedTitle: feed.title }); setSelectedChannelId(''); }}
                          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-white bg-accent-primary rounded-lg hover:bg-accent-primary-hover cursor-pointer transition"
                        >
                          <Plus size={10} /> Subscribe
                        </button>
                      </div>

                      {channelIds.length === 0 ? (
                        <div className="p-3 text-center border border-dashed border-border-base rounded-xl bg-bg-card/10 text-[10px] text-text-muted">
                          No channels subscribed specifically.
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {channelIds.map(cid => {
                            const chat = chats.find(c => c.chat_id === cid);
                            const displayName = chat?.name || `Chat (${cid})`;
                            return (
                              <div key={cid} className="bg-bg-input border border-border-base rounded-xl p-2.5 flex justify-between items-center gap-3">
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-bold text-text-base truncate">{displayName}</span>
                                  <span className="text-[9px] text-text-muted font-mono truncate select-all">{cid}</span>
                                </div>
                                <button
                                  onClick={() => handleUnsubscribeFeed(cid, displayName, feed.id, feed.title)}
                                  className="p-1.5 rounded-lg bg-rose-950/20 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 cursor-pointer transition flex-shrink-0"
                                  title="Unsubscribe"
                                >
                                  <Trash size={11} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-border-base pt-3 mt-4">
                    <span className="text-[10px] text-text-muted font-mono">
                      Last Synced: {feed.last_fetched_at ? new Date(feed.last_fetched_at * 1000).toLocaleDateString() : 'Never'}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleRefreshFeed(feed.id)}
                        className="p-2 rounded-xl bg-bg-input border border-border-base text-text-muted hover:text-text-base transition cursor-pointer"
                        title="Sync Feed"
                      >
                        <ArrowsClockwise size={12} />
                      </button>
                      <button
                        onClick={() => handleToggleFeed(feed.id, feed.enabled)}
                        className="px-2.5 py-1 text-[11px] font-bold rounded-xl bg-bg-input border border-border-base text-text-base hover:text-text-base cursor-pointer transition"
                      >
                        {feed.enabled === 1 ? 'Pause' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleRemoveFeed(feed.id, feed.title)}
                        className="p-2 rounded-xl bg-rose-950/20 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 transition cursor-pointer"
                        title="Delete Feed"
                      >
                        <Trash size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 2: WEBHOOK CONFIGURATIONS ── */}
      <div className="flex flex-col gap-4 border-t border-border-base pt-6">
        <h3 className="font-bold text-lg text-text-base">Webhook Gateways</h3>

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
      </div>

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

      {/* MODAL: Subscribe channel to webhook */}
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

      {/* MODAL: Subscribe Chat to specific Feed */}
      <Modal
        isOpen={!!feedSubscribeTarget}
        onClose={() => setFeedSubscribeTarget(null)}
        title={`Subscribe to Feed: "${feedSubscribeTarget?.feedTitle}"`}
        footer={
          <>
            <button onClick={() => setFeedSubscribeTarget(null)} className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition">
              Cancel
            </button>
            <button onClick={handleSubscribeFeed} disabled={!selectedChannelId} className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover disabled:opacity-50 cursor-pointer transition">
              Subscribe
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Select Telegram Chat</label>
          {chats.filter(c => !(foloFeeds.find(f => f.id === feedSubscribeTarget?.feedId)?.telegram_channel_ids || []).includes(c.chat_id)).length === 0 ? (
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
              {chats.filter(c => !(foloFeeds.find(f => f.id === feedSubscribeTarget?.feedId)?.telegram_channel_ids || []).includes(c.chat_id)).map(chat => (
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
  webhook, onDelete, onSubscribe, renderChannelList, renderUrlRow,
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
