import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowsClockwise, Plus, Eye, Trash, X } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';

export const FeedsTab: React.FC = () => {
  const {
    feeds,
    channels,
    categories,
    feedViewFilter,
    setFeedViewFilterState,
    selectedChannelId,
    selectedFeedCategoryId,
    categoryFeedIds,
    setFeedViewFilter,
    setSelectedFeedCategoryId,
    setSelectedChannelId,
    loadFeeds,
    callApi,
    showToast,
    setReaderFeedFilter,
    setActiveTab
  } = useApp();

  // Modal State
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [addFeedType, setAddFeedType] = useState<'rss' | 'rsshub' | 'rss-bridge' | 'instagram' | 'tiktok'>('rss');
  const [addFeedUrl, setAddFeedUrl] = useState('');
  const [addFeedTitle, setAddFeedTitle] = useState('');
  const [addFeedDestination, setAddFeedDestination] = useState<'mcp' | 'telegram' | 'both'>('mcp');
  const [addFeedCategoryId, setAddFeedCategoryId] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const springTransition = { type: 'spring', stiffness: 100, damping: 20 } as const;

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!', 'success');
    });
  };

  const handleCreateCategoryInline = async () => {
    if (!newCategoryName.trim()) return;
    const res = await callApi('create_category', { name: newCategoryName.trim() });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Category "${newCategoryName.trim()}" created.`, 'success');
      await loadFeeds(true);
      setAddFeedCategoryId(res.data.id);
      setIsCreatingCategory(false);
      setNewCategoryName('');
    }
  };

  const resetAddFeedModal = () => {
    setAddFeedUrl('');
    setAddFeedTitle('');
    setAddFeedType('rss');
    setAddFeedDestination('mcp');
    setAddFeedCategoryId('');
    setIsCreatingCategory(false);
    setNewCategoryName('');
  };

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddFeedOpen(false);
    showToast('Registering feed and importing articles...', 'info');
    const subscribeToMcp = addFeedDestination === 'mcp' || addFeedDestination === 'both';
    const res = await callApi('add_feed', {
      url: addFeedUrl,
      sourceType: addFeedType,
      title: addFeedTitle,
      subscribeToMcp,
      categoryId: addFeedCategoryId || undefined,
    });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Feed successfully added! Imported ${res.data.itemsInserted || 0} items.`, 'success');
      loadFeeds();
    }
    resetAddFeedModal();
  };

  const handleToggleFeed = async (feedId: string, currentStatus: number) => {
    const res = await callApi('set_feed_enabled', { feedId, enabled: currentStatus !== 1 });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Feed status updated.', 'success');
      loadFeeds();
    }
  };

  const handleRefreshFeed = async (feedId: string) => {
    showToast('Refreshing feed items...', 'info');
    const res = await callApi('refresh_feed', { feedId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Refreshed! Found ${res.data.itemsFetched || 0} items (${res.data.itemsInserted || 0} new).`, 'success');
      loadFeeds();
    }
  };

  const handleRefreshAllFeeds = async () => {
    showToast('Syncing all enabled feeds in the background...', 'info');
    const res = await callApi('refresh_all');
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Successfully synced ${res.data.refreshed || 0} feeds.`, 'success');
      loadFeeds();
    }
  };

  const handleRemoveFeed = async (feedId: string) => {
    if (!confirm('Are you sure you want to delete this feed and purge all stored unread items?')) return;
    const res = await callApi('remove_feed', { feedId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Feed deleted successfully.', 'success');
      loadFeeds();
    }
  };

  // Derived: feeds filtered by MCP/Telegram/channel/category selection
  const filteredFeeds = feeds.filter(feed => {
    const channelIds: string[] = feed.telegram_channel_ids || [];
    if (feedViewFilter === 'mcp' || feedViewFilter === 'category') {
      if (channelIds.length !== 0) return false; // must be MCP-only
      if (selectedFeedCategoryId) {
        const ids = categoryFeedIds[selectedFeedCategoryId];
        return ids ? ids.includes(feed.id) : true;
      }
      return true;
    }
    if (feedViewFilter === 'telegram') {
      if (channelIds.length === 0) return false;
      if (selectedChannelId) return channelIds.includes(selectedChannelId);
      return true;
    }
    return true; // 'all'
  });

  const formatDate = (unixSecs: number | null | undefined) => {
    if (!unixSecs) return 'Never';
    const date = new Date(unixSecs * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div 
      key="feeds"
      initial={{ opacity: 0, y: 8 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-8"
    >
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-bold text-2xl tracking-tight text-text-base">RSS Feeds</h2>
          <p className="text-xs text-text-muted mt-1">Manage synchronized content feeds and scheduled refreshes</p>
        </div>
        <div className="flex gap-3">
          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={handleRefreshAllFeeds}
            className="flex items-center gap-2 px-4.5 py-2.5 text-xs font-bold text-text-base bg-bg-input border border-border-base rounded-xl hover:bg-neutral-800 transition duration-200 cursor-pointer"
          >
            <ArrowsClockwise size={14} />
            <span>Sync All</span>
          </motion.button>
          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsAddFeedOpen(true)}
            className="flex items-center gap-2 px-4.5 py-2.5 text-xs font-bold text-white bg-accent-primary rounded-xl hover:bg-accent-primary-hover transition duration-200 shadow-lg shadow-accent-primary/10 cursor-pointer"
          >
            <Plus size={14} />
            <span>Add Feed</span>
          </motion.button>
        </div>
      </div>

      {/* Feed Filter Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-bg-input border border-border-base rounded-xl p-1 gap-0.5">
          {([
            { id: 'all', label: 'All Feeds' },
            { id: 'mcp', label: 'MCP Only' },
            { id: 'telegram', label: 'Telegram' },
          ] as const).map(opt => (
            <button
              key={opt.id}
              onClick={() => setFeedViewFilter(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                (feedViewFilter === opt.id || (opt.id === 'mcp' && feedViewFilter === 'category'))
                  ? 'bg-accent-primary text-white shadow-sm'
                  : 'text-text-muted hover:text-text-base'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {feedViewFilter === 'telegram' && channels.length > 0 && (
          <select
            value={selectedChannelId || ''}
            onChange={e => setSelectedChannelId(e.target.value || null)}
            className="bg-bg-input border border-border-base rounded-xl px-3 py-2 text-xs text-text-base focus:outline-none focus:border-accent-primary cursor-pointer font-semibold"
          >
            <option value="">All Channels</option>
            {channels.map(ch => (
              <option key={ch.id} value={ch.id}>{ch.name || ch.id}</option>
            ))}
          </select>
        )}

        {(feedViewFilter === 'mcp' || feedViewFilter === 'category') && categories.length > 0 && (
          <select
            value={selectedFeedCategoryId || ''}
            onChange={e => {
              const id = e.target.value || null;
              setFeedViewFilterState(id ? 'category' : 'mcp');
              if (id) localStorage.setItem('rss_feed_filter', 'category');
              else localStorage.setItem('rss_feed_filter', 'mcp');
              setSelectedFeedCategoryId(id);
            }}
            className="bg-bg-input border border-border-base rounded-xl px-3 py-2 text-xs text-text-base focus:outline-none focus:border-accent-primary cursor-pointer font-semibold"
          >
            <option value="">All Categories</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name} ({cat.feed_count})</option>
            ))}
          </select>
        )}

        <span className="text-[11px] text-text-muted font-mono">
          {filteredFeeds.length} / {feeds.length} feeds
        </span>
      </div>

      {/* Feeds Card Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredFeeds.length === 0 ? (
          <div className="lg:col-span-2 p-12 text-center border border-dashed border-border-base rounded-2xl bg-bg-card/25 text-sm text-text-muted">
            {feeds.length === 0
              ? 'No feeds registered. Click "Add Feed" to start importing content.'
              : `No ${feedViewFilter === 'mcp' ? 'MCP-only' : feedViewFilter === 'telegram' ? 'Telegram' : ''} feeds found.`}
          </div>
        ) : (
          filteredFeeds.map(feed => (
            <motion.div 
              key={feed.id}
              whileHover={{ y: -4 }}
              transition={springTransition}
              className="liquid-glass p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group min-h-[160px]"
            >
              <div className="flex flex-col gap-2.5">
                <div className="flex justify-between items-start gap-4">
                  <span className="font-bold text-base text-text-base truncate max-w-[70%]">{feed.title}</span>
                  <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                    feed.enabled === 1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${feed.enabled === 1 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                    {feed.enabled === 1 ? 'Active' : 'Paused'}
                  </span>
                </div>
                <span className="text-xs text-text-muted font-mono block truncate cursor-pointer hover:text-text-base" onClick={() => handleCopyText(feed.url)}>
                  {feed.url}
                </span>
              </div>

              <div className="flex justify-between items-center border-t border-border-base pt-4 mt-6">
                <div className="flex flex-col text-[11px] text-text-muted font-mono">
                  <span className="uppercase tracking-wider text-[9px] text-text-muted font-bold opacity-60">Last Synchronized</span>
                  <span className="mt-0.5 text-text-base font-bold">{formatDate(feed.last_fetched_at)}</span>
                </div>
                
                <div className="flex gap-2 opacity-80 group-hover:opacity-100 transition duration-200">
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRefreshFeed(feed.id)}
                    className="p-2.5 rounded-xl bg-bg-input border border-border-base text-text-muted hover:text-text-base transition duration-200 cursor-pointer"
                    title="Sync Feed"
                  >
                    <ArrowsClockwise size={14} />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setReaderFeedFilter([feed.id]);
                      setActiveTab('reader');
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-bg-input border border-border-base text-text-base hover:text-text-base transition duration-200 cursor-pointer flex items-center gap-1.5"
                    title="View Items"
                  >
                    <Eye size={13} />
                    <span>View</span>
                    {feed.unread_count > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent-primary text-white text-[9px] font-bold leading-none">
                        {feed.unread_count > 99 ? '99+' : feed.unread_count}
                      </span>
                    )}
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleToggleFeed(feed.id, feed.enabled)}
                    className="px-3 py-1.5 text-xs font-bold rounded-xl bg-bg-input border border-border-base text-text-base hover:text-text-base transition duration-200 cursor-pointer"
                  >
                    {feed.enabled === 1 ? 'Pause' : 'Activate'}
                  </motion.button>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleRemoveFeed(feed.id)}
                    className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 transition duration-200 cursor-pointer"
                    title="Remove"
                  >
                    <Trash size={14} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* MODAL: Add Feed */}
      <Modal
        isOpen={isAddFeedOpen}
        onClose={() => { setIsAddFeedOpen(false); resetAddFeedModal(); }}
        title="Register Feed"
        footer={
          <>
            <button
              type="button"
              onClick={() => { setIsAddFeedOpen(false); resetAddFeedModal(); }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleAddFeed}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition"
            >
              Register
            </button>
          </>
        }
      >
        {/* Source Type */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Source Type</label>
          <div className="flex bg-bg-input border border-border-base rounded-xl p-1 gap-0.5 flex-wrap">
            {([
              { id: 'rss', label: 'RSS' },
              { id: 'rsshub', label: 'RSSHub' },
              { id: 'rss-bridge', label: 'RSS-Bridge' },
              { id: 'instagram', label: 'Instagram' },
              { id: 'tiktok', label: 'TikTok' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { setAddFeedType(opt.id); setAddFeedUrl(''); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer min-w-[60px] ${
                  addFeedType === opt.id
                    ? 'bg-accent-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-base'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* URL or Username */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
            {addFeedType === 'instagram' || addFeedType === 'tiktok' ? 'Username' : 'Feed Source URL'}
          </label>
          <input
            type={addFeedType === 'instagram' || addFeedType === 'tiktok' ? 'text' : 'url'}
            value={addFeedUrl}
            onChange={e => setAddFeedUrl(e.target.value)}
            placeholder={
              addFeedType === 'rsshub' ? 'https://rsshub.app/twitter/user/username' :
              addFeedType === 'rss-bridge' ? 'https://rss-bridge.instance.com/?action=display&bridge=...' :
              addFeedType === 'instagram' ? 'username (without @)' :
              addFeedType === 'tiktok' ? 'username (without @)' :
              'https://example.com/feed.xml'
            }
            className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono mt-1"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Friendly Title (Optional)</label>
          <input
            type="text"
            value={addFeedTitle}
            onChange={e => setAddFeedTitle(e.target.value)}
            placeholder="e.g. Technology News"
            className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold mt-1"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Destination</label>
          <div className="flex bg-bg-input border border-border-base rounded-xl p-1 gap-0.5">
            {([
              { id: 'mcp', label: 'MCP Agent' },
              { id: 'telegram', label: 'Telegram' },
              { id: 'both', label: 'Both' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAddFeedDestination(opt.id)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                  addFeedDestination === opt.id
                    ? 'bg-accent-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-base'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-text-muted leading-relaxed">
            {addFeedDestination === 'mcp' && 'Feed will be added to the MCP workspace for agent browsing.'}
            {addFeedDestination === 'telegram' && 'Feed will be registered for Telegram auto-posting (configure channel subscriptions in Telegram tab).'}
            {addFeedDestination === 'both' && 'Feed will be available for both MCP agent browsing and Telegram posting.'}
          </p>
        </div>

        {/* Category — shown for MCP destinations, always available (even if empty) */}
        {(addFeedDestination === 'mcp' || addFeedDestination === 'both') && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Category (Optional)</label>
            {!isCreatingCategory ? (
              <div className="flex items-center gap-2 mt-1">
                {categories.length > 0 ? (
                  <select
                    value={addFeedCategoryId}
                    onChange={e => setAddFeedCategoryId(e.target.value)}
                    className="flex-1 bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary"
                  >
                    <option value="">No category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="flex-1 text-xs text-text-muted italic py-3">No categories yet</span>
                )}
                <button
                  type="button"
                  onClick={() => setIsCreatingCategory(true)}
                  className="flex items-center gap-1 px-3 py-2.5 text-xs font-bold rounded-xl bg-bg-input border border-border-base text-text-muted hover:text-text-base transition cursor-pointer flex-shrink-0"
                  title="Create new category"
                >
                  <Plus size={12} /> New
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="Category name..."
                  className="flex-1 bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreateCategoryInline()}
                />
                <button
                  type="button"
                  onClick={handleCreateCategoryInline}
                  className="px-3 py-2.5 text-xs font-bold rounded-xl bg-accent-primary text-white hover:bg-accent-primary-hover transition cursor-pointer flex-shrink-0"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => { setIsCreatingCategory(false); setNewCategoryName(''); }}
                  className="p-2.5 rounded-xl bg-bg-input border border-border-base text-text-muted hover:text-text-base transition cursor-pointer flex-shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </motion.div>
  );
};
export default FeedsTab;
