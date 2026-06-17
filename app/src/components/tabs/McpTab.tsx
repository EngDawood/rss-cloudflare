import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash, FolderSimple, Robot, ArrowsClockwise, Check, X } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';

export const McpTab: React.FC = () => {
  const { feeds, categories, callApi, showToast, loadFeeds } = useApp();

  // MCP subscriptions
  const [mcpSubs, setMcpSubs] = useState<any[]>([]);
  const [subsLoading, setSubsLoading] = useState(false);

  // Categories
  const [categoryFeeds, setCategoryFeeds] = useState<Record<string, any[]>>({});
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [catFeedsLoading, setCatFeedsLoading] = useState<string | null>(null);

  // Modals
  const [isNewCatOpen, setIsNewCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [isAddFeedToCatOpen, setIsAddFeedToCatOpen] = useState(false);
  const [addFeedToCatId, setAddFeedToCatId] = useState<string | null>(null);
  const [addFeedToCatFeedId, setAddFeedToCatFeedId] = useState('');

  // Subscribe modal (subscribe + optional category in one step)
  const [subscribeTargetFeed, setSubscribeTargetFeed] = useState<any | null>(null);
  const [subscribeCatId, setSubscribeCatId] = useState('');
  const [isCreatingSubCat, setIsCreatingSubCat] = useState(false);
  const [newSubCatName, setNewSubCatName] = useState('');

  const springTransition = { type: 'spring', stiffness: 100, damping: 20 } as const;

  const callApiRef = useRef(callApi);
  callApiRef.current = callApi;

  const loadMcpSubs = useCallback(async () => {
    setSubsLoading(true);
    const res = await callApiRef.current('list_mcp_subscriptions');
    if (!res.error) setMcpSubs(res.data || []);
    setSubsLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMcpSubs();
  }, [loadMcpSubs]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    const res = await callApi('create_category', { name: newCatName.trim() });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Category "${newCatName.trim()}" created.`, 'success');
      setNewCatName('');
      setIsNewCatOpen(false);
      loadFeeds(true);
    }
  };

  const handleDeleteCategory = async (categoryId: string, name: string) => {
    if (!confirm(`Delete category "${name}"? Feeds in it won't be deleted.`)) return;
    const res = await callApi('delete_category', { categoryId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Category deleted.`, 'success');
      setCategoryFeeds(prev => { const next = { ...prev }; delete next[categoryId]; return next; });
      if (expandedCat === categoryId) setExpandedCat(null);
      loadFeeds(true);
    }
  };

  const handleToggleCategory = async (catId: string) => {
    if (expandedCat === catId) { setExpandedCat(null); return; }
    setExpandedCat(catId);
    if (!categoryFeeds[catId]) {
      setCatFeedsLoading(catId);
      const res = await callApi('get_category_feeds', { categoryId: catId });
      if (!res.error) setCategoryFeeds(prev => ({ ...prev, [catId]: res.data || [] }));
      setCatFeedsLoading(null);
    }
  };

  const handleAddFeedToCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFeedToCatId || !addFeedToCatFeedId) return;
    const res = await callApi('add_feed_to_category', { categoryId: addFeedToCatId, feedId: addFeedToCatFeedId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Feed added to category.', 'success');
      setIsAddFeedToCatOpen(false);
      setAddFeedToCatFeedId('');
      // refresh category feeds
      const catRes = await callApi('get_category_feeds', { categoryId: addFeedToCatId });
      if (!catRes.error) setCategoryFeeds(prev => ({ ...prev, [addFeedToCatId]: catRes.data || [] }));
      loadFeeds(true);
    }
  };

  const handleRemoveFeedFromCategory = async (categoryId: string, feedId: string) => {
    const res = await callApi('remove_feed_from_category', { categoryId, feedId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Feed removed from category.', 'success');
      setCategoryFeeds(prev => ({ ...prev, [categoryId]: (prev[categoryId] || []).filter((f: any) => f.id !== feedId) }));
      loadFeeds(true);
    }
  };

  const handleToggleMcpSub = async (feedId: string, isSubscribed: boolean) => {
    const action = isSubscribed ? 'remove_mcp_subscription' : 'add_mcp_subscription';
    const res = await callApi(action, { feedId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(isSubscribed ? 'Removed from MCP workspace.' : 'Added to MCP workspace.', 'success');
      loadMcpSubs();
    }
  };

  const resetSubscribeModal = () => {
    setSubscribeTargetFeed(null);
    setSubscribeCatId('');
    setIsCreatingSubCat(false);
    setNewSubCatName('');
  };

  const handleSubscribeWithCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscribeTargetFeed) return;
    const feedId = subscribeTargetFeed.id;

    const res = await callApi('add_mcp_subscription', { feedId });
    if (res.error) { showToast(res.error, 'error'); return; }

    let finalCatId = subscribeCatId;
    if (isCreatingSubCat && newSubCatName.trim()) {
      const catRes = await callApi('create_category', { name: newSubCatName.trim() });
      if (catRes.error) {
        showToast(catRes.error, 'error');
      } else {
        finalCatId = catRes.data.id;
        showToast(`Category "${newSubCatName.trim()}" created.`, 'success');
        loadFeeds(true);
      }
    }

    if (finalCatId) {
      await callApi('add_feed_to_category', { categoryId: finalCatId, feedId });
    }

    showToast('Added to MCP workspace.', 'success');
    resetSubscribeModal();
    loadMcpSubs();
    if (finalCatId) loadFeeds(true);
  };

  const subscribedFeedIds = new Set(mcpSubs.map((s: any) => s.feed_id));

  const availableForCat = addFeedToCatId
    ? (categoryFeeds[addFeedToCatId]
      ? feeds.filter(f => !categoryFeeds[addFeedToCatId].some((cf: any) => cf.id === f.id))
      : feeds)
    : feeds;

  return (
    <motion.div
      key="mcp"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-bold text-2xl tracking-tight text-text-base">MCP Configuration</h2>
          <p className="text-xs text-text-muted mt-1">Manage MCP workspace subscriptions and feed categories</p>
        </div>
      </div>

      {/* ── Categories ──────────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderSimple size={18} className="text-accent-primary" />
            <h3 className="font-bold text-base text-text-base">Feed Categories</h3>
            <span className="text-[11px] font-mono text-text-muted bg-bg-input border border-border-base rounded-full px-2 py-0.5">{categories.length}</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setIsNewCatOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-accent-primary rounded-xl hover:bg-accent-primary-hover transition duration-200 shadow-lg shadow-accent-primary/10 cursor-pointer"
          >
            <Plus size={13} />
            New Category
          </motion.button>
        </div>

        {categories.length === 0 ? (
          <div className="p-10 text-center border border-dashed border-border-base rounded-2xl bg-bg-card/25 text-sm text-text-muted">
            No categories yet. Create one to group your MCP feeds.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {categories.map(cat => (
              <div key={cat.id} className="liquid-glass rounded-2xl overflow-hidden">
                {/* Category Row */}
                <div
                  className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-white/3 transition"
                  onClick={() => handleToggleCategory(cat.id)}
                >
                  <div className="flex items-center gap-3">
                    <FolderSimple size={16} className="text-accent-primary flex-shrink-0" />
                    <span className="font-bold text-sm text-text-base">{cat.name}</span>
                    <span className="text-[10px] font-mono text-text-muted bg-bg-input border border-border-base rounded-full px-1.5 py-0.5">
                      {cat.feed_count ?? 0} feeds
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={e => { e.stopPropagation(); setAddFeedToCatId(cat.id); setIsAddFeedToCatOpen(true); }}
                      className="p-1.5 rounded-lg bg-bg-input border border-border-base text-text-muted hover:text-text-base transition cursor-pointer"
                      title="Add feed to category"
                    >
                      <Plus size={12} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={e => { e.stopPropagation(); handleDeleteCategory(cat.id, cat.name); }}
                      className="p-1.5 rounded-lg bg-rose-950/20 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 transition cursor-pointer"
                      title="Delete category"
                    >
                      <Trash size={12} />
                    </motion.button>
                  </div>
                </div>

                {/* Expanded feeds */}
                <AnimatePresence>
                  {expandedCat === cat.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-border-base overflow-hidden"
                    >
                      {catFeedsLoading === cat.id ? (
                        <div className="px-5 py-3 text-xs text-text-muted">Loading...</div>
                      ) : (categoryFeeds[cat.id] || []).length === 0 ? (
                        <div className="px-5 py-3 text-xs text-text-muted">No feeds in this category.</div>
                      ) : (
                        <ul className="divide-y divide-border-base/50">
                          {(categoryFeeds[cat.id] || []).map((feed: any) => (
                            <li key={feed.id} className="flex items-center justify-between px-5 py-2.5 hover:bg-white/2 transition">
                              <div className="flex flex-col min-w-0">
                                <span className="text-xs font-semibold text-text-base truncate">{feed.title}</span>
                                <span className="text-[10px] text-text-muted font-mono truncate">{feed.url}</span>
                              </div>
                              <motion.button
                                whileTap={{ scale: 0.9 }}
                                onClick={() => handleRemoveFeedFromCategory(cat.id, feed.id)}
                                className="ml-3 flex-shrink-0 p-1.5 rounded-lg bg-rose-950/20 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 transition cursor-pointer"
                                title="Remove from category"
                              >
                                <X size={11} />
                              </motion.button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── MCP Feed Subscriptions ─────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Robot size={18} className="text-accent-primary" />
            <h3 className="font-bold text-base text-text-base">MCP Workspace Feeds</h3>
            <span className="text-[11px] font-mono text-text-muted bg-bg-input border border-border-base rounded-full px-2 py-0.5">{mcpSubs.length}</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={loadMcpSubs}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-text-base bg-bg-input border border-border-base rounded-xl hover:bg-neutral-800 transition cursor-pointer"
          >
            <ArrowsClockwise size={13} className={subsLoading ? 'animate-spin' : ''} />
            Refresh
          </motion.button>
        </div>

        <p className="text-xs text-text-muted -mt-2">
          Feeds the MCP agent reads when you use <code className="bg-bg-input px-1 py-0.5 rounded text-[10px]">list_new_items</code> or browse tools.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {feeds.map(feed => {
            const subscribed = subscribedFeedIds.has(feed.id);
            return (
              <motion.div
                key={feed.id}
                whileHover={{ y: -2 }}
                transition={springTransition}
                className={`liquid-glass p-4 rounded-2xl flex items-center justify-between gap-3 ${
                  subscribed ? 'border-accent-primary/20 ring-1 ring-accent-primary/10' : ''
                }`}
              >
                <div className="flex flex-col min-w-0 gap-0.5">
                  <span className="font-bold text-sm text-text-base truncate">{feed.title}</span>
                  <span className="text-[10px] text-text-muted font-mono truncate">{feed.url}</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    {(feed.telegram_channel_ids || []).length > 0 && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        Telegram
                      </span>
                    )}
                    {subscribed && (
                      <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-accent-primary/10 text-accent-primary border border-accent-primary/20">
                        MCP
                      </span>
                    )}
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onClick={() => subscribed
                    ? handleToggleMcpSub(feed.id, true)
                    : setSubscribeTargetFeed(feed)
                  }
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition duration-200 cursor-pointer ${
                    subscribed
                      ? 'bg-accent-primary/10 text-accent-primary border border-accent-primary/20 hover:bg-rose-950/20 hover:text-rose-400 hover:border-rose-900/20'
                      : 'bg-bg-input border border-border-base text-text-muted hover:text-text-base'
                  }`}
                >
                  {subscribed ? <><Check size={11} /> Subscribed</> : <><Plus size={11} /> Subscribe</>}
                </motion.button>
              </motion.div>
            );
          })}

          {feeds.length === 0 && (
            <div className="lg:col-span-2 p-10 text-center border border-dashed border-border-base rounded-2xl bg-bg-card/25 text-sm text-text-muted">
              No feeds registered yet. Add feeds first.
            </div>
          )}
        </div>
      </section>

      {/* MODAL: New Category */}
      <Modal
        isOpen={isNewCatOpen}
        onClose={() => { setIsNewCatOpen(false); setNewCatName(''); }}
        title="New Category"
        footer={
          <>
            <button
              type="button"
              onClick={() => { setIsNewCatOpen(false); setNewCatName(''); }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleCreateCategory}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition"
            >
              Create
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Category Name</label>
          <input
            type="text"
            value={newCatName}
            onChange={e => setNewCatName(e.target.value)}
            placeholder="e.g. Technology, Arabic News..."
            className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold mt-1"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreateCategory(e as any)}
          />
        </div>
      </Modal>

      {/* MODAL: Subscribe to MCP + assign category */}
      <Modal
        isOpen={!!subscribeTargetFeed}
        onClose={resetSubscribeModal}
        title="Subscribe to MCP Workspace"
        footer={
          <>
            <button
              type="button"
              onClick={resetSubscribeModal}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubscribeWithCategory}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition"
            >
              Subscribe
            </button>
          </>
        }
      >
        {subscribeTargetFeed && (
          <div className="flex flex-col gap-4">
            <div className="p-3 rounded-xl bg-bg-input border border-border-base">
              <p className="font-bold text-sm text-text-base truncate">{subscribeTargetFeed.title}</p>
              <p className="text-[10px] text-text-muted font-mono truncate mt-0.5">{subscribeTargetFeed.url}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Category (Optional)</label>
              {!isCreatingSubCat ? (
                <div className="flex items-center gap-2 mt-1">
                  {categories.length > 0 ? (
                    <select
                      value={subscribeCatId}
                      onChange={e => setSubscribeCatId(e.target.value)}
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
                    onClick={() => setIsCreatingSubCat(true)}
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
                    value={newSubCatName}
                    onChange={e => setNewSubCatName(e.target.value)}
                    placeholder="Category name..."
                    className="flex-1 bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); } }}
                  />
                  <button
                    type="button"
                    onClick={() => { setIsCreatingSubCat(false); setNewSubCatName(''); }}
                    className="p-2.5 rounded-xl bg-bg-input border border-border-base text-text-muted hover:text-text-base transition cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
              <p className="text-[10px] text-text-muted">Assign to a category to organize your MCP workspace.</p>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL: Add Feed to Category */}
      <Modal
        isOpen={isAddFeedToCatOpen}
        onClose={() => { setIsAddFeedToCatOpen(false); setAddFeedToCatFeedId(''); setAddFeedToCatId(null); }}
        title="Add Feed to Category"
        footer={
          <>
            <button
              type="button"
              onClick={() => { setIsAddFeedToCatOpen(false); setAddFeedToCatFeedId(''); setAddFeedToCatId(null); }}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleAddFeedToCategory}
              disabled={!addFeedToCatFeedId}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition disabled:opacity-40"
            >
              Add
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Select Feed</label>
          <select
            value={addFeedToCatFeedId}
            onChange={e => setAddFeedToCatFeedId(e.target.value)}
            className="bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary mt-1"
          >
            <option value="">Choose a feed...</option>
            {availableForCat.map(f => (
              <option key={f.id} value={f.id}>{f.title || f.url}</option>
            ))}
          </select>
        </div>
      </Modal>
    </motion.div>
  );
};

export default McpTab;
