import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Funnel, X, ArrowsClockwise, Sparkle, ArrowRight, MagnifyingGlass } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';

export const ReaderTab: React.FC = () => {
  const {
    unreadItems,
    setUnreadItems,
    feeds,
    channels,
    categories,
    feedViewFilter,
    setFeedViewFilter,
    selectedChannelId,
    setSelectedChannelId,
    readerCategoryId,
    setReaderCategoryId,
    categoryFeedIds,
    setCategoryFeedIds,
    loadReaderItems,
    callApi,
    showToast,
    readerFeedFilter,
    setReaderFeedFilter,
    readerStatusFilter,
    setReaderStatusFilter,
    readerSearch,
    setReaderSearch,
    isAuthenticated,
    activeTab,
    isApiLoading
  } = useApp();

  // Local States
  const [selectedReaderItem, setSelectedReaderItem] = useState<any>(null);
  const [isFeedDropdownOpen, setIsFeedDropdownOpen] = useState(false);
  const feedDropdownRef = useRef<HTMLDivElement>(null);

  // Derived: feeds filtered by MCP/Telegram/Folo/channel/category selection
  const foloCategory = categories.find((c: any) => c.name === 'Folo');
  const filteredFeeds = feeds.filter(feed => {
    const channelIds: string[] = feed.telegram_channel_ids || [];
    if (feedViewFilter === 'mcp' || feedViewFilter === 'category') {
      if (channelIds.length !== 0) return false; // must be MCP-only
      if (readerCategoryId) {
        const ids = categoryFeedIds[readerCategoryId];
        return ids ? ids.includes(feed.id) : true;
      }
      return true;
    }
    if (feedViewFilter === 'folo') {
      if (!foloCategory) return false;
      const ids = categoryFeedIds[foloCategory.id];
      return ids ? ids.includes(feed.id) : true;
    }
    if (feedViewFilter === 'telegram') {
      if (channelIds.length === 0) return false;
      if (selectedChannelId) return channelIds.includes(selectedChannelId);
      return true;
    }
    return true; // 'all'
  });

  // Debounced load items on filter change
  const readerFeedFilterStr = readerFeedFilter.join(',');
  useEffect(() => {
    if (isAuthenticated && activeTab === 'reader') {
      const delayDebounce = setTimeout(() => {
        loadReaderItems();
      }, 300);
      return () => clearTimeout(delayDebounce);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerSearch, readerFeedFilterStr, readerStatusFilter, readerCategoryId, feedViewFilter, selectedChannelId]);

  // Click-away listener for feed selection dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (feedDropdownRef.current && !feedDropdownRef.current.contains(event.target as Node)) {
        setIsFeedDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleMarkRead = async (id: string) => {
    const res = await callApi('mark_read', { ids: [id] });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      if (readerStatusFilter === 'unread') {
        setUnreadItems(prev => prev.filter(item => item.id !== id));
        if (selectedReaderItem?.id === id) {
          setSelectedReaderItem(null);
        }
      } else {
        setUnreadItems(prev => prev.map(item => item.id === id ? { ...item, read: 1 } : item));
        if (selectedReaderItem?.id === id) {
          setSelectedReaderItem((prev: any) => prev ? { ...prev, read: 1 } : null);
        }
      }
      showToast('Item marked as read.', 'success');
    }
  };

  const handleMarkUnread = async (id: string) => {
    const res = await callApi('mark_unread', { ids: [id] });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      if (readerStatusFilter === 'read') {
        setUnreadItems(prev => prev.filter(item => item.id !== id));
        if (selectedReaderItem?.id === id) {
          setSelectedReaderItem(null);
        }
      } else {
        setUnreadItems(prev => prev.map(item => item.id === id ? { ...item, read: 0 } : item));
        if (selectedReaderItem?.id === id) {
          setSelectedReaderItem((prev: any) => prev ? { ...prev, read: 0 } : null);
        }
      }
      showToast('Item marked as unread.', 'success');
    }
  };

  const handleSelectItem = async (item: any) => {
    setSelectedReaderItem(item);
    const res = await callApi('get_item', { id: item.id });
    if (!res.error && res.data) {
      setSelectedReaderItem((prev: any) => {
        if (prev?.id === item.id) {
          return {
            ...prev,
            text: res.data.text,
            summary: res.data.summary,
            media: res.data.media,
            mediaType: res.data.media_type,
            contentHtml: res.data.content_html,
          };
        }
        return prev;
      });
    }
  };

  const handleBulkMarkRead = async () => {
    const ids = unreadItems.map(i => i.id);
    if (ids.length === 0) return;
    if (!confirm(`Mark all ${ids.length} visible items as read?`)) return;

    showToast('Marking all read...', 'info');
    const res = await callApi('mark_read', { ids });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Marked ${ids.length} items as read.`, 'success');
      setSelectedReaderItem(null);
      loadReaderItems();
    }
  };

  const handleTriggerAiSummary = async (itemId: string) => {
    showToast('Requesting AI summary from Gateway...', 'info');
    const res = await callApi('summarize_item', { itemId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Arabic summary compiled and saved!', 'success');
      if (selectedReaderItem?.id === itemId) {
        setSelectedReaderItem((prev: any) => prev ? { ...prev, summary: res.data.summary } : null);
      }
      loadReaderItems();
    }
  };

  const handlePostToTelegram = async (id: string) => {
    const target = prompt('Enter a registered chat name / numeric ID (leave blank to send to Default chat):', '');
    if (target === null) return;
    showToast('Enriching item media and posting to Telegram...', 'info');
    const res = await callApi('post_to_telegram', { id, target: target || undefined });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Posted successfully to ${res.data.chatName || res.data.chatId}!`, 'success');
    }
  };

  const handleRefreshAllFeeds = async () => {
    showToast('Syncing all enabled feeds in the background...', 'info');
    const res = await callApi('refresh_all');
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Successfully synced ${res.data.refreshed || 0} feeds.`, 'success');
    }
  };

  const formatDate = (unixSecs: number | null | undefined) => {
    if (!unixSecs) return 'Never';
    const date = new Date(unixSecs * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div 
      key="reader"
      initial={{ opacity: 0, y: 8 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-6 h-[calc(100vh-190px)] min-h-[550px]"
    >
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-2xl tracking-tight text-text-base">Feed Reader</h2>
          <p className="text-xs text-text-muted mt-1">
            Review {readerStatusFilter === 'unread' ? 'unread' : readerStatusFilter === 'read' ? 'read' : 'all'} synced items and trigger dispatch actions
          </p>
        </div>
        <div className="flex gap-3 items-center flex-wrap">
          {/* View Filter */}
          <div className="flex bg-bg-input border border-border-base rounded-xl p-1 gap-0.5">
            {([
              { id: 'all', label: 'All' },
              { id: 'mcp', label: 'MCP' },
              { id: 'telegram', label: 'Telegram' },
              { id: 'folo', label: 'Folo' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => {
                  setFeedViewFilter(opt.id);
                  setReaderFeedFilter([]);
                  setReaderCategoryId('');
                }}
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
              onChange={e => { setSelectedChannelId(e.target.value || null); setReaderFeedFilter([]); }}
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
              value={readerCategoryId}
              onChange={async e => {
                const catId = e.target.value;
                setReaderCategoryId(catId);
                setReaderFeedFilter([]);
                if (catId && !categoryFeedIds[catId]) {
                  const res = await callApi('get_category_feeds', { categoryId: catId });
                  if (!res.error) {
                    const ids = (res.data || []).map((f: any) => f.id);
                    setCategoryFeedIds(prev => ({ ...prev, [catId]: ids }));
                  }
                }
              }}
              className="bg-bg-input border border-border-base rounded-xl px-3 py-2 text-xs text-text-base focus:outline-none focus:border-accent-primary cursor-pointer font-semibold"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name} ({cat.feed_count})</option>
              ))}
            </select>
          )}

          {/* Feed Dropdown Multi-Selector */}
          <div className="relative flex items-center" ref={feedDropdownRef}>
            <button
              onClick={() => setIsFeedDropdownOpen(!isFeedDropdownOpen)}
              className="flex items-center justify-between gap-2 bg-bg-input border border-border-base rounded-xl pl-3.5 pr-8 py-2.5 text-xs text-text-base focus:outline-none focus:border-accent-primary cursor-pointer min-w-[140px] max-w-[180px] text-left truncate relative transition hover:border-text-muted"
            >
              <span className="truncate">
                {readerFeedFilter.length === 0
                  ? 'All Feeds'
                  : readerFeedFilter.length === 1
                    ? filteredFeeds.find(f => f.id === readerFeedFilter[0])?.title || '1 Feed Selected'
                    : `${readerFeedFilter.length} Feeds`}
              </span>
              <Funnel size={12} className="absolute right-3 text-text-muted pointer-events-none" />
            </button>
            
            {readerFeedFilter.length > 0 && (
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setReaderFeedFilter([]);
                }} 
                className="absolute right-7 z-10 text-text-muted hover:text-text-base cursor-pointer p-1"
                title="Clear filter"
              >
                <X size={10} />
              </button>
            )}

            {/* Dropdown Checklist Popover */}
            <AnimatePresence>
              {isFeedDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-1.5 left-0 z-50 liquid-glass rounded-xl p-2 w-[240px] max-h-[280px] overflow-y-auto flex flex-col gap-1 shadow-2xl"
                >
                  <div className="flex justify-between items-center px-1.5 py-1 border-b border-border-base mb-1">
                    <span className="text-[10px] uppercase font-bold text-text-muted tracking-wider">Filter Feeds</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setReaderFeedFilter(filteredFeeds.map(f => f.id))}
                        className="text-[9px] font-bold text-accent-primary hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      <button 
                        onClick={() => setReaderFeedFilter([])}
                        className="text-[9px] font-bold text-text-muted hover:underline cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  {filteredFeeds.length === 0 ? (
                    <div className="p-4 text-center text-xs text-text-muted">No feeds in this category</div>
                  ) : (
                    filteredFeeds.map(f => {
                      const isChecked = readerFeedFilter.includes(f.id);
                      return (
                        <label 
                          key={f.id} 
                          className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer text-xs text-text-base select-none transition min-w-0"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setReaderFeedFilter(readerFeedFilter.filter(id => id !== f.id));
                              } else {
                                setReaderFeedFilter([...readerFeedFilter, f.id]);
                              }
                            }}
                            className="rounded border-border-base text-accent-primary focus:ring-accent-primary bg-bg-input cursor-pointer"
                          />
                          <span className="truncate flex-grow" title={f.title}>{f.title}</span>
                        </label>
                      );
                    })
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Status Filter Button Group */}
          <div className="flex bg-bg-input border border-border-base rounded-xl p-1 gap-0.5">
            {[
              { id: 'unread' as const, label: 'Unread' },
              { id: 'read' as const, label: 'Read' },
              { id: 'all' as const, label: 'All' }
            ].map(status => (
              <button
                key={status.id}
                onClick={() => setReaderStatusFilter(status.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition duration-200 cursor-pointer ${
                  readerStatusFilter === status.id
                    ? 'bg-accent-primary text-white shadow-sm'
                    : 'text-text-muted hover:text-text-base'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>

          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={async () => {
              await handleRefreshAllFeeds();
              loadReaderItems();
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-base hover:text-text-base transition duration-200 cursor-pointer"
          >
            <ArrowsClockwise size={14} className={isApiLoading ? "animate-spin" : ""} />
            <span>Sync Feeds</span>
          </motion.button>

          {readerStatusFilter === 'unread' && (
            <motion.button 
              whileTap={{ scale: 0.98 }}
              onClick={handleBulkMarkRead} 
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-base hover:text-text-base transition duration-200 cursor-pointer"
            >
              Mark All Read
            </motion.button>
          )}

          <div className="relative">
            <input 
              type="text" 
              value={readerSearch} 
              onChange={e => setReaderSearch(e.target.value)} 
              placeholder="Search keywords..." 
              className="bg-bg-input border border-border-base rounded-xl pl-9 pr-4 py-2 text-xs text-text-base focus:outline-none focus:border-accent-primary w-[200px]"
            />
            <MagnifyingGlass size={14} className="absolute left-3.5 top-3 text-text-muted" />
          </div>
        </div>
      </div>

      {/* 2-Pane Split Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-grow overflow-hidden">
        
        {/* Left Pane: Items List (Col span 5) */}
        <div className="lg:col-span-5 h-full flex flex-col gap-4 overflow-hidden">
          <div className="overflow-y-auto flex-grow flex flex-col gap-3 pr-2 scrollbar-thin">
            {unreadItems.length === 0 ? (
              <div className="p-12 text-center border border-dashed border-border-base rounded-2xl bg-bg-card/25 text-sm text-text-muted">
                {readerStatusFilter === 'unread' 
                  ? 'Your unread queue is empty.' 
                  : readerStatusFilter === 'read' 
                    ? 'No read items found.' 
                    : 'No items found.'}
              </div>
            ) : (
              unreadItems.map(item => {
                const isActive = selectedReaderItem?.id === item.id;
                return (
                  <motion.button 
                    key={item.id}
                    whileHover={{ x: 2 }}
                    onClick={() => handleSelectItem(item)}
                    className={`p-4 text-left rounded-xl transition duration-200 border cursor-pointer flex flex-col gap-2 ${
                      isActive 
                        ? 'bg-accent-primary/10 border-accent-primary/40 shadow-lg text-text-base' 
                        : item.read === 1
                          ? 'bg-bg-card/10 border-border-base/40 opacity-60 hover:opacity-100 hover:bg-bg-card/30 text-text-muted'
                          : 'bg-bg-card/20 border-border-base hover:bg-bg-card/50 text-text-muted'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-3 w-full">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {item.read === 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-accent-primary flex-shrink-0" title="Unread" />
                        )}
                        <span className="text-[10px] uppercase font-bold tracking-wide text-accent-primary px-2 py-0.5 rounded bg-accent-primary/5 border border-accent-primary/15 truncate">
                          {item.feed_title}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted font-mono whitespace-nowrap self-center">
                        {formatDate(item.timestamp).split(' ')[1]}
                      </span>
                    </div>
                    <span className={`font-bold text-sm leading-snug line-clamp-2 ${isActive ? 'text-text-base' : 'text-text-base/80'}`}>
                      {item.title}
                    </span>
                    <span className="text-[11px] text-text-muted font-mono block">By {item.author || 'Author'}</span>
                  </motion.button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Item Content Viewer (Col span 7) */}
        <div className="lg:col-span-7 h-full flex flex-col liquid-glass rounded-2xl overflow-hidden relative">
          <AnimatePresence mode="wait">
            {!selectedReaderItem ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center h-full p-12 text-center text-text-muted gap-3"
              >
                <BookOpen size={42} className="text-text-muted/60" />
                <span className="text-sm font-semibold">Select an article from the list to preview</span>
                <span className="text-xs text-text-muted/50">Select content to view the direct text, Arabic summaries, and Telegram dispatch operations</span>
              </motion.div>
            ) : (
              <motion.div 
                key={selectedReaderItem.id}
                initial={{ opacity: 0, x: 10 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -10 }}
                className="flex flex-col h-full overflow-hidden"
              >
                {/* Viewer Header */}
                <div className="p-6 border-b border-border-base bg-bg-card/25">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-accent-primary bg-accent-primary/5 px-2.5 py-0.5 rounded border border-accent-primary/15 mb-2 inline-block">
                    {selectedReaderItem.feed_title}
                  </span>
                  <h3 className="font-bold text-lg text-text-base leading-snug tracking-tight">
                    {selectedReaderItem.title}
                  </h3>
                  <div className="flex gap-4 text-xs text-text-muted mt-2.5 font-mono">
                    <span>By {selectedReaderItem.author || 'unknown'}</span>
                    <span>•</span>
                    <span>Synced {formatDate(selectedReaderItem.timestamp)}</span>
                  </div>
                </div>

                {/* Viewer Body (Scrollable) */}
                <div className="p-6 flex-grow overflow-y-auto flex flex-col gap-6">
                  {selectedReaderItem.text === undefined ? (
                    <div className="flex flex-col items-center justify-center py-20 text-text-muted gap-3 flex-grow">
                      <div className="w-8 h-8 border-3 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs font-medium tracking-wide">Fetching article content...</span>
                    </div>
                  ) : (
                    <>
                      {/* AI Summary Block (RTL Arabic) */}
                      {selectedReaderItem.summary ? (
                        <div className="p-5 rounded-xl bg-accent-primary/5 border border-accent-primary/20 flex flex-col gap-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-accent-primary uppercase tracking-widest">
                            <Sparkle size={12} />
                            <span>Arabic AI Summary</span>
                          </div>
                          <p className="text-sm text-text-base leading-relaxed font-sans text-right" dir="rtl">
                            {selectedReaderItem.summary}
                          </p>
                        </div>
                      ) : (
                        <div className="p-5 rounded-xl bg-bg-input border border-border-base flex justify-between items-center">
                          <span className="text-xs text-text-muted">No Arabic AI summary compiled.</span>
                          <motion.button 
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleTriggerAiSummary(selectedReaderItem.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-bg-input border border-border-base text-text-base hover:text-text-base cursor-pointer"
                          >
                            <Sparkle size={12} className="text-accent-primary animate-pulse" />
                            <span>Summarize Now</span>
                          </motion.button>
                        </div>
                      )}

                      {/* Feed Item Body Text */}
                      {selectedReaderItem.contentHtml ? (
                        <div 
                          className="text-sm text-text-base/90 leading-relaxed break-words max-w-[65ch] rss-content-html"
                          dangerouslySetInnerHTML={{ __html: selectedReaderItem.contentHtml }}
                        />
                      ) : (
                        <div className="text-sm text-text-base/90 leading-relaxed break-words max-w-[65ch] whitespace-pre-wrap">
                          {selectedReaderItem.text}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Viewer Footer actions */}
                <div className="p-4 border-t border-border-base bg-bg-card/40 flex justify-between items-center flex-wrap gap-3 mt-auto">
                  <div className="flex gap-2">
                    <motion.button 
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handlePostToTelegram(selectedReaderItem.id)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary hover:bg-accent-primary-hover text-white transition duration-200 cursor-pointer"
                    >
                      Post to Telegram
                    </motion.button>
                    {selectedReaderItem.read === 1 ? (
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleMarkUnread(selectedReaderItem.id)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer"
                      >
                        Mark Unread
                      </motion.button>
                    ) : (
                      <motion.button 
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleMarkRead(selectedReaderItem.id)}
                        className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer"
                      >
                        Mark Read
                      </motion.button>
                    )}
                  </div>
                  
                  <a 
                    href={selectedReaderItem.link} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-xs text-text-muted hover:text-accent-primary transition flex items-center gap-1.5 font-semibold"
                  >
                    <span>Original Source</span>
                    <ArrowRight size={12} />
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </motion.div>
  );
};
export default ReaderTab;
