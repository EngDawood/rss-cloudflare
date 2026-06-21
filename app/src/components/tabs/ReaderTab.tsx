import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Funnel, X, ArrowsClockwise, Sparkle, ArrowRight, MagnifyingGlass, Check, PaperPlaneTilt, BookmarkSimple } from '@phosphor-icons/react';
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
    isApiLoading,
    readerSortOrder,
    setReaderSortOrder,
  } = useApp();

  const [selectedReaderItem, setSelectedReaderItem] = useState<any>(null);
  const [isFeedDropdownOpen, setIsFeedDropdownOpen] = useState(false);
  const feedDropdownRef = useRef<HTMLDivElement>(null);

  const foloCategory = categories.find((c: any) => c.name === 'Folo');
  const filteredFeeds = feeds.filter(feed => {
    const channelIds: string[] = feed.telegram_channel_ids || [];
    if (feedViewFilter === 'mcp' || feedViewFilter === 'category') {
      if (channelIds.length !== 0) return false;
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
    return true;
  });

  const readerFeedFilterStr = readerFeedFilter.join(',');
  useEffect(() => {
    if (isAuthenticated && activeTab === 'reader') {
      const delayDebounce = setTimeout(() => { loadReaderItems(); }, 300);
      return () => clearTimeout(delayDebounce);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerSearch, readerFeedFilterStr, readerStatusFilter, readerCategoryId, feedViewFilter, selectedChannelId, readerSortOrder]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (feedDropdownRef.current && !feedDropdownRef.current.contains(event.target as Node)) {
        setIsFeedDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    const res = await callApi('mark_read', { ids: [id] });
    if (res.error) { showToast(res.error, 'error'); return; }
    if (readerStatusFilter === 'unread') {
      setUnreadItems(prev => prev.filter(item => item.id !== id));
      if (selectedReaderItem?.id === id) setSelectedReaderItem(null);
    } else {
      setUnreadItems(prev => prev.map(item => item.id === id ? { ...item, read: 1 } : item));
      if (selectedReaderItem?.id === id) setSelectedReaderItem((prev: any) => prev ? { ...prev, read: 1 } : null);
    }
    showToast('Item marked as read.', 'success');
  };

  const handleMarkUnread = async (id: string) => {
    const res = await callApi('mark_unread', { ids: [id] });
    if (res.error) { showToast(res.error, 'error'); return; }
    if (readerStatusFilter === 'read') {
      setUnreadItems(prev => prev.filter(item => item.id !== id));
      if (selectedReaderItem?.id === id) setSelectedReaderItem(null);
    } else {
      setUnreadItems(prev => prev.map(item => item.id === id ? { ...item, read: 0 } : item));
      if (selectedReaderItem?.id === id) setSelectedReaderItem((prev: any) => prev ? { ...prev, read: 0 } : null);
    }
    showToast('Item marked as unread.', 'success');
  };

  const handleSelectItem = async (item: any) => {
    setSelectedReaderItem(item);
    const res = await callApi('get_item', { id: item.id });
    if (!res.error && res.data) {
      setSelectedReaderItem((prev: any) => {
        if (prev?.id === item.id) {
          return { ...prev, text: res.data.text, summary: res.data.summary, media: res.data.media, mediaType: res.data.media_type, contentHtml: res.data.content_html };
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
    if (res.error) { showToast(res.error, 'error'); return; }
    showToast(`Marked ${ids.length} items as read.`, 'success');
    setSelectedReaderItem(null);
    loadReaderItems();
  };

  const handleTriggerAiSummary = async (itemId: string) => {
    showToast('Requesting AI summary from Gateway...', 'info');
    const res = await callApi('summarize_item', { itemId });
    if (res.error) { showToast(res.error, 'error'); return; }
    showToast('Arabic summary compiled and saved!', 'success');
    if (selectedReaderItem?.id === itemId) setSelectedReaderItem((prev: any) => prev ? { ...prev, summary: res.data.summary } : null);
    loadReaderItems();
  };

  const handlePostToTelegram = async (id: string) => {
    const target = prompt('Enter a registered chat name / numeric ID (leave blank to send to Default chat):', '');
    if (target === null) return;
    showToast('Enriching item media and posting to Telegram...', 'info');
    const res = await callApi('post_to_telegram', { id, target: target || undefined });
    if (res.error) showToast(res.error, 'error');
    else showToast(`Posted successfully to ${res.data.chatName || res.data.chatId}!`, 'success');
  };

  const handleRefreshAllFeeds = async () => {
    showToast('Syncing all enabled feeds in the background...', 'info');
    const res = await callApi('refresh_all');
    if (res.error) showToast(res.error, 'error');
    else showToast(`Successfully synced ${res.data.refreshed || 0} feeds.`, 'success');
  };

  const formatDate = (unixSecs: number | null | undefined) => {
    if (!unixSecs) return 'Never';
    const date = new Date(unixSecs * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  const formatTime = (unixSecs: number | null | undefined) => {
    if (!unixSecs) return '';
    return new Date(unixSecs * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const totalUnread = feeds.reduce((n, f) => n + (Number(f.unread_count) || 0), 0);

  const statusPill = (on: boolean) =>
    `btn-press px-3 py-1.5 rounded-full text-[11px] font-semibold cursor-pointer ${
      on ? 'bg-accent text-onaccent' : 'bg-bg-base border border-line text-muted hover:text-ink'
    }`;
  const selectClass =
    'bg-bg-base border border-line rounded-full px-3 py-1.5 text-[11px] text-ink focus:outline-none focus:border-accent cursor-pointer font-semibold';

  return (
    <div className="h-full flex">
      {/* ===== LEFT: list pane ===== */}
      <div className="w-[320px] xl:w-[380px] flex-none border-r border-line bg-surface flex flex-col min-h-0">
        <div className="px-5 pt-6 pb-3.5 flex-none border-b border-line flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display font-semibold text-[24px] text-ink m-0">The Reader</h2>
            <div className="flex items-center gap-1.5">
              <button
                onClick={async () => { await handleRefreshAllFeeds(); loadReaderItems(); }}
                title="Sync feeds"
                className="btn-press w-8 h-8 rounded-full border border-line-strong bg-bg-base text-ink-soft hover:text-accent flex items-center justify-center cursor-pointer"
              >
                <ArrowsClockwise size={14} className={isApiLoading ? 'animate-spin' : ''} />
              </button>
              {readerStatusFilter === 'unread' && (
                <button onClick={handleBulkMarkRead} title="Mark all read" className="btn-press w-8 h-8 rounded-full border border-line-strong bg-bg-base text-ink-soft hover:text-accent flex items-center justify-center cursor-pointer">
                  <Check size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Status + sort */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button onClick={() => setReaderStatusFilter('unread')} className={statusPill(readerStatusFilter === 'unread')}>
              Unread{totalUnread ? ` ${totalUnread}` : ''}
            </button>
            <button onClick={() => setReaderStatusFilter('read')} className={statusPill(readerStatusFilter === 'read')}>Read</button>
            <button onClick={() => setReaderStatusFilter('all')} className={statusPill(readerStatusFilter === 'all')}>All</button>
            <select value={readerSortOrder} onChange={e => setReaderSortOrder(e.target.value as any)} className={`${selectClass} ml-auto`}>
              <option value="newest_published">Newest</option>
              <option value="oldest_published">Oldest</option>
              <option value="newly_added">Newly added</option>
              <option value="oldest_added">Oldest added</option>
            </select>
          </div>

          {/* Source view filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { id: 'all', label: 'All' },
              { id: 'mcp', label: 'MCP' },
              { id: 'telegram', label: 'Telegram' },
              { id: 'folo', label: 'Folo' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => { setFeedViewFilter(opt.id); setReaderFeedFilter([]); setReaderCategoryId(''); }}
                className={statusPill(feedViewFilter === opt.id || (opt.id === 'mcp' && feedViewFilter === 'category'))}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Conditional channel / category + feed multiselect */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {feedViewFilter === 'telegram' && channels.length > 0 && (
              <select value={selectedChannelId || ''} onChange={e => { setSelectedChannelId(e.target.value || null); setReaderFeedFilter([]); }} className={selectClass}>
                <option value="">All channels</option>
                {channels.map(ch => <option key={ch.id} value={ch.id}>{ch.name || ch.id}</option>)}
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
                    if (!res.error) setCategoryFeedIds(prev => ({ ...prev, [catId]: (res.data || []).map((f: any) => f.id) }));
                  }
                }}
                className={selectClass}
              >
                <option value="">All categories</option>
                {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name} ({cat.feed_count})</option>)}
              </select>
            )}

            {/* Feed multiselect */}
            <div className="relative flex items-center" ref={feedDropdownRef}>
              <button
                onClick={() => setIsFeedDropdownOpen(!isFeedDropdownOpen)}
                className="flex items-center gap-1.5 bg-bg-base border border-line rounded-full pl-3 pr-3 py-1.5 text-[11px] font-semibold text-ink hover:border-accent cursor-pointer max-w-[160px]"
              >
                <Funnel size={12} className="text-muted flex-none" />
                <span className="truncate">
                  {readerFeedFilter.length === 0 ? 'All feeds' : readerFeedFilter.length === 1
                    ? (filteredFeeds.find(f => f.id === readerFeedFilter[0])?.title || '1 feed')
                    : `${readerFeedFilter.length} feeds`}
                </span>
                {readerFeedFilter.length > 0 && (
                  <X size={11} className="text-muted hover:text-ink flex-none" onClick={(e) => { e.stopPropagation(); setReaderFeedFilter([]); }} />
                )}
              </button>
              <AnimatePresence>
                {isFeedDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} transition={{ duration: 0.15 }}
                    className="absolute top-full mt-1.5 left-0 z-50 bg-surface border border-line-strong rounded-xl p-2 w-[240px] max-h-[280px] overflow-y-auto flex flex-col gap-1 shadow-xl"
                  >
                    <div className="flex justify-between items-center px-1.5 py-1 border-b border-line mb-1">
                      <span className="text-[9px] uppercase font-semibold text-muted tracking-[0.12em] font-mono">Filter feeds</span>
                      <div className="flex gap-2">
                        <button onClick={() => setReaderFeedFilter(filteredFeeds.map(f => f.id))} className="text-[9px] font-semibold text-accent hover:underline cursor-pointer">All</button>
                        <button onClick={() => setReaderFeedFilter([])} className="text-[9px] font-semibold text-muted hover:underline cursor-pointer">Clear</button>
                      </div>
                    </div>
                    {filteredFeeds.length === 0 ? (
                      <div className="p-4 text-center text-xs text-muted">No feeds in this category</div>
                    ) : filteredFeeds.map(f => {
                      const isChecked = readerFeedFilter.includes(f.id);
                      return (
                        <label key={f.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-bg-base cursor-pointer text-xs text-ink select-none min-w-0">
                          <input
                            type="checkbox" checked={isChecked}
                            onChange={() => setReaderFeedFilter(isChecked ? readerFeedFilter.filter(id => id !== f.id) : [...readerFeedFilter, f.id])}
                            className="accent-accent cursor-pointer"
                          />
                          <span className="truncate flex-grow" title={f.title}>{f.title}</span>
                        </label>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <input
              type="text" value={readerSearch} onChange={e => setReaderSearch(e.target.value)} placeholder="Search keywords…"
              className="w-full bg-bg-base border border-line rounded-full pl-9 pr-4 py-2 text-xs text-ink focus:outline-none focus:border-accent"
            />
            <MagnifyingGlass size={14} className="absolute left-3.5 top-2.5 text-muted" />
          </div>
        </div>

        {/* List */}
        <div className="rr-scroll flex-1 min-h-0 px-3 py-3 flex flex-col gap-1">
          {unreadItems.length === 0 ? (
            <div className="p-10 text-center border border-dashed border-line rounded-2xl bg-bg-base/40 text-sm text-muted mt-2">
              {readerStatusFilter === 'unread' ? 'Your unread queue is empty.' : readerStatusFilter === 'read' ? 'No read items found.' : 'No items found.'}
            </div>
          ) : unreadItems.map(item => {
            const isActive = selectedReaderItem?.id === item.id;
            const excerpt = item.summary || item.excerpt || item.text || '';
            return (
              <button
                key={item.id}
                onClick={() => handleSelectItem(item)}
                className="btn-press text-left p-[15px] rounded-xl cursor-pointer mb-1 border-l-[3px]"
                style={{
                  background: isActive ? 'var(--rr-accent-soft)' : 'transparent',
                  borderLeftColor: isActive ? 'var(--rr-accent)' : 'transparent',
                  opacity: item.read === 1 && !isActive ? 0.6 : 1,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {item.read === 0 && <span className="w-1.5 h-1.5 rounded-full bg-accent flex-none" title="Unread" />}
                  <span className="font-mono text-[9px] text-accent uppercase tracking-[0.06em] truncate">{item.feed_title}</span>
                  <span className="ml-auto font-mono text-[9.5px] text-muted whitespace-nowrap">{formatTime(item.timestamp)}</span>
                </div>
                <div className="font-display font-semibold text-[16px] text-ink leading-[1.3] mb-1 line-clamp-2">{item.title}</div>
                {excerpt
                  ? <div className="text-[12px] text-ink-soft leading-[1.5] line-clamp-2">{excerpt}</div>
                  : <div className="font-mono text-[11px] text-muted">By {item.author || 'unknown'}</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== RIGHT: article pane ===== */}
      <div className="flex-1 min-w-0 rr-scroll">
        {!selectedReaderItem ? (
          <div className="flex flex-col items-center justify-center h-full p-12 text-center text-muted gap-3">
            <BookOpen size={42} className="text-muted/60" />
            <span className="font-display text-lg font-semibold text-ink">Select an article to read</span>
            <span className="text-xs text-muted max-w-sm leading-relaxed">View the full text, Arabic AI summaries, and Telegram dispatch operations.</span>
          </div>
        ) : (
          <div className="px-6 md:px-14 py-10 max-w-[760px]">
            {/* Kicker */}
            <div className="flex items-center gap-2.5 mb-4 flex-wrap">
              <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-accent">{selectedReaderItem.feed_title}</span>
              <span className="text-muted">•</span>
              <span className="font-mono text-[10px] text-muted">By {selectedReaderItem.author || 'unknown'} · synced {formatDate(selectedReaderItem.timestamp)}</span>
            </div>

            {/* Headline */}
            <h1 className="font-display font-bold text-[38px] leading-[1.12] tracking-[-0.015em] text-ink mb-5">{selectedReaderItem.title}</h1>

            {/* Actions */}
            <div className="flex items-center gap-2 mb-7 pb-7 border-b border-line flex-wrap">
              {selectedReaderItem.read === 1 ? (
                <button onClick={() => handleMarkUnread(selectedReaderItem.id)} className="btn-press flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-transparent border-[1.5px] border-line-strong text-ink text-xs font-semibold cursor-pointer">
                  <Check size={13} weight="bold" /> Mark unread
                </button>
              ) : (
                <button onClick={() => handleMarkRead(selectedReaderItem.id)} className="btn-press flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-accent border-none text-onaccent text-xs font-semibold cursor-pointer">
                  <Check size={13} weight="bold" /> Mark read
                </button>
              )}
              <button onClick={() => handlePostToTelegram(selectedReaderItem.id)} className="btn-press flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-transparent border-[1.5px] border-line-strong text-ink text-xs font-semibold cursor-pointer">
                <PaperPlaneTilt size={13} /> Post to Telegram
              </button>
              <button onClick={() => handleTriggerAiSummary(selectedReaderItem.id)} title="Summarize (Arabic)" className="btn-press w-[38px] h-[38px] rounded-full bg-transparent border-[1.5px] border-line-strong text-ink-soft hover:text-accent flex items-center justify-center cursor-pointer">
                <Sparkle size={14} />
              </button>
              <a href={selectedReaderItem.link} target="_blank" rel="noreferrer" title="Original source" className="btn-press w-[38px] h-[38px] rounded-full bg-transparent border-[1.5px] border-line-strong text-ink-soft hover:text-accent flex items-center justify-center cursor-pointer">
                <BookmarkSimple size={14} />
              </a>
            </div>

            {/* Body */}
            {selectedReaderItem.text === undefined ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted gap-3">
                <div className="w-8 h-8 border-[3px] border-accent border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium tracking-wide">Fetching article content…</span>
              </div>
            ) : (
              <>
                {/* Arabic AI summary */}
                {selectedReaderItem.summary && (
                  <div className="font-display italic text-[20px] leading-[1.5] text-ink border-l-[3px] border-accent pl-[22px] my-7 text-right" dir="rtl">
                    {selectedReaderItem.summary}
                  </div>
                )}
                {selectedReaderItem.contentHtml ? (
                  <div className="rss-content-html rr-dropcap" dangerouslySetInnerHTML={{ __html: selectedReaderItem.contentHtml }} />
                ) : (
                  <div className="font-display text-[19px] leading-[1.78] text-ink-soft rr-dropcap whitespace-pre-wrap">
                    <p style={{ margin: 0 }}>{selectedReaderItem.text}</p>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-10 pt-6 border-t border-line">
                  <a href={selectedReaderItem.link} target="_blank" rel="noreferrer" className="text-xs text-muted hover:text-accent transition flex items-center gap-1.5 font-semibold">
                    <span>Original source</span><ArrowRight size={12} />
                  </a>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
export default ReaderTab;
