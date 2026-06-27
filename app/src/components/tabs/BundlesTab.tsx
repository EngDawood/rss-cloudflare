import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash, PencilSimple, Rss, Link, Check, X, ArrowsClockwise } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';

const RSS_BASE = 'https://rss.feed.engdawood.com';

interface Bundle {
  id: string;
  slug: string;
  title: string;
  description: string;
  enabled: number;
  created_at: number;
  feed_ids: string[];
}

const slugify = (s: string) =>
  s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

export const BundlesTab: React.FC = () => {
  const { callApi, showToast, feeds } = useApp();

  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createSlug, setCreateSlug] = useState('');
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  // Edit modal
  const [editBundle, setEditBundle] = useState<Bundle | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  // Feed picker modal
  const [managingBundle, setManagingBundle] = useState<Bundle | null>(null);
  const [bundleFeedIds, setBundleFeedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await callApi('list_bundles');
    if (!res.error) setBundles(res.data || []);
    if (!silent) setLoading(false);
  }, [callApi]);

  useEffect(() => { load(); }, [load]);

  // Auto-derive slug from title while user hasn't manually edited it
  const handleTitleChange = (val: string) => {
    setCreateTitle(val);
    if (!slugManuallyEdited) setCreateSlug(slugify(val));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createSlug.trim() || !createTitle.trim()) return;
    const res = await callApi('create_bundle', {
      slug: createSlug.trim(),
      title: createTitle.trim(),
      description: createDesc.trim(),
    });
    if (res.error) { showToast(res.error, 'error'); return; }
    showToast(`Bundle "${createTitle}" created.`, 'success');
    setIsCreateOpen(false);
    setCreateSlug(''); setCreateTitle(''); setCreateDesc(''); setSlugManuallyEdited(false);
    load(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBundle) return;
    const res = await callApi('update_bundle', {
      id: editBundle.id,
      title: editTitle.trim(),
      description: editDesc.trim(),
    });
    if (res.error) { showToast(res.error, 'error'); return; }
    showToast('Bundle updated.', 'success');
    setEditBundle(null);
    load(true);
  };

  const handleToggleEnabled = async (b: Bundle) => {
    const res = await callApi('update_bundle', { id: b.id, enabled: b.enabled !== 1 });
    if (res.error) showToast(res.error, 'error');
    else load(true);
  };

  const handleDelete = async (b: Bundle) => {
    if (!confirm(`Delete bundle "${b.title}"? The RSS URL will stop working.`)) return;
    const res = await callApi('delete_bundle', { id: b.id });
    if (res.error) showToast(res.error, 'error');
    else { showToast('Bundle deleted.', 'success'); load(true); }
  };

  const openManage = async (b: Bundle) => {
    setManagingBundle(b);
    setBundleFeedIds(new Set(b.feed_ids));
  };

  const handleToggleFeedInBundle = async (feedId: string) => {
    if (!managingBundle) return;
    const isIn = bundleFeedIds.has(feedId);
    const action = isIn ? 'remove_feed_from_bundle' : 'add_feed_to_bundle';
    const res = await callApi(action, { bundleId: managingBundle.id, feedId });
    if (res.error) { showToast(res.error, 'error'); return; }
    setBundleFeedIds(prev => {
      const next = new Set(prev);
      isIn ? next.delete(feedId) : next.add(feedId);
      return next;
    });
    // Reflect in bundle list immediately
    setBundles(prev => prev.map(b =>
      b.id === managingBundle.id
        ? { ...b, feed_ids: isIn ? b.feed_ids.filter(id => id !== feedId) : [...b.feed_ids, feedId] }
        : b
    ));
  };

  const copyUrl = (slug: string) => {
    const url = `${RSS_BASE}/${slug}.xml`;
    navigator.clipboard.writeText(url).then(() => showToast('URL copied!', 'success'));
  };

  const inputCls = 'w-full bg-bg-base border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-muted focus:outline-none focus:border-accent';

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-muted text-sm">
        Loading bundles…
      </div>
    );
  }

  return (
    <div className="h-full rr-scroll px-6 md:px-10 py-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h2 className="font-display font-semibold text-[34px] tracking-tight text-ink leading-none mb-1.5">RSS Bundles</h2>
          <p className="font-display italic text-[15px] text-muted m-0">
            {bundles.length} {bundles.length === 1 ? 'bundle' : 'bundles'} · served at <span className="font-mono text-xs">{RSS_BASE}/&lt;slug&gt;.xml</span>
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => load()}
            className="btn-press flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line text-sm font-medium text-muted hover:text-ink bg-surface"
          >
            <ArrowsClockwise size={15} /> Refresh
          </button>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="btn-press flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-onaccent text-sm font-semibold"
          >
            <Plus size={15} weight="bold" /> New Bundle
          </button>
        </div>
      </div>

      {/* Bundle cards */}
      {bundles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Rss size={36} className="text-muted opacity-50" />
          <p className="text-muted text-sm">No bundles yet. Create one to aggregate feeds into a public RSS endpoint.</p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="mt-2 btn-press px-5 py-2.5 rounded-xl bg-accent text-onaccent text-sm font-semibold"
          >
            Create first bundle
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {bundles.map(b => (
            <div
              key={b.id}
              className={`group flex flex-col md:flex-row md:items-center gap-4 p-4 rounded-2xl border bg-surface transition-opacity ${b.enabled !== 1 ? 'opacity-50' : ''} border-line`}
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-accent-soft flex items-center justify-center flex-none">
                <Rss size={18} className="text-accent" />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-ink text-sm">{b.title}</span>
                  <span className="font-mono text-[10px] text-muted bg-bg-base border border-line px-2 py-0.5 rounded-full">
                    /{b.slug}.xml
                  </span>
                  {b.enabled !== 1 && (
                    <span className="text-[10px] font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">disabled</span>
                  )}
                </div>
                {b.description && (
                  <p className="text-xs text-muted mt-0.5 truncate">{b.description}</p>
                )}
                <p className="text-[11px] text-muted mt-1">
                  {b.feed_ids.length} {b.feed_ids.length === 1 ? 'feed' : 'feeds'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 flex-none">
                <button
                  onClick={() => copyUrl(b.slug)}
                  title="Copy RSS URL"
                  className="btn-press p-2 rounded-lg text-muted hover:text-ink border border-transparent hover:border-line"
                >
                  <Link size={15} />
                </button>
                <button
                  onClick={() => openManage(b)}
                  title="Manage feeds"
                  className="btn-press p-2 rounded-lg text-muted hover:text-ink border border-transparent hover:border-line text-xs font-medium"
                >
                  <Rss size={15} />
                </button>
                <button
                  onClick={() => { setEditBundle(b); setEditTitle(b.title); setEditDesc(b.description); }}
                  title="Edit"
                  className="btn-press p-2 rounded-lg text-muted hover:text-ink border border-transparent hover:border-line"
                >
                  <PencilSimple size={15} />
                </button>
                <button
                  onClick={() => handleToggleEnabled(b)}
                  title={b.enabled ? 'Disable' : 'Enable'}
                  className="btn-press p-2 rounded-lg text-muted hover:text-ink border border-transparent hover:border-line"
                >
                  {b.enabled ? <X size={15} /> : <Check size={15} />}
                </button>
                <button
                  onClick={() => handleDelete(b)}
                  title="Delete"
                  className="btn-press p-2 rounded-lg text-red-400 hover:text-red-500 border border-transparent hover:border-red-200"
                >
                  <Trash size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); setCreateSlug(''); setCreateTitle(''); setCreateDesc(''); setSlugManuallyEdited(false); }}
        title="New RSS Bundle"
        footer={
          <>
            <button type="button" onClick={() => setIsCreateOpen(false)} className="btn-press px-4 py-2 rounded-xl border border-line text-sm text-muted hover:text-ink">Cancel</button>
            <button type="submit" form="create-bundle-form" className="btn-press px-5 py-2 rounded-xl bg-accent text-onaccent text-sm font-semibold">Create</button>
          </>
        }
      >
        <form id="create-bundle-form" onSubmit={handleCreateSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Title</label>
            <input
              className={inputCls}
              placeholder="Tech News"
              value={createTitle}
              onChange={e => handleTitleChange(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Slug <span className="text-muted font-normal">(URL key)</span></label>
            <div className="flex items-center gap-2 bg-bg-base border border-line rounded-xl overflow-hidden focus-within:border-accent">
              <span className="pl-4 text-xs text-muted whitespace-nowrap font-mono">/</span>
              <input
                className="flex-1 bg-transparent py-2.5 pr-4 text-sm text-ink placeholder:text-muted focus:outline-none font-mono"
                placeholder="tech-news"
                value={createSlug}
                onChange={e => { setCreateSlug(e.target.value); setSlugManuallyEdited(true); }}
                pattern="[a-z0-9-]+"
                title="Lowercase letters, numbers, and hyphens only"
                required
              />
              <span className="pr-4 text-xs text-muted whitespace-nowrap font-mono">.xml</span>
            </div>
            <p className="text-[11px] text-muted mt-1">
              URL: <span className="font-mono">{RSS_BASE}/{createSlug || 'slug'}.xml</span>
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Description <span className="text-muted font-normal">(optional)</span></label>
            <input
              className={inputCls}
              placeholder="Curated tech news from multiple sources"
              value={createDesc}
              onChange={e => setCreateDesc(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal
        isOpen={!!editBundle}
        onClose={() => setEditBundle(null)}
        title="Edit Bundle"
        footer={
          <>
            <button type="button" onClick={() => setEditBundle(null)} className="btn-press px-4 py-2 rounded-xl border border-line text-sm text-muted hover:text-ink">Cancel</button>
            <button type="submit" form="edit-bundle-form" className="btn-press px-5 py-2 rounded-xl bg-accent text-onaccent text-sm font-semibold">Save</button>
          </>
        }
      >
        <form id="edit-bundle-form" onSubmit={handleEditSubmit} className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Slug</label>
            <div className="flex items-center gap-2 bg-bg-base border border-line rounded-xl overflow-hidden opacity-60">
              <span className="pl-4 text-xs text-muted font-mono">/</span>
              <span className="flex-1 py-2.5 text-sm text-muted font-mono">{editBundle?.slug}</span>
              <span className="pr-4 text-xs text-muted font-mono">.xml</span>
            </div>
            <p className="text-[11px] text-muted mt-1">Slug cannot be changed after creation.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Title</label>
            <input
              className={inputCls}
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Description</label>
            <input
              className={inputCls}
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              placeholder="Optional description"
            />
          </div>
        </form>
      </Modal>

      {/* Manage feeds modal */}
      <Modal
        isOpen={!!managingBundle}
        onClose={() => setManagingBundle(null)}
        title={`Feeds in "${managingBundle?.title}"`}
      >
        <div className="flex flex-col gap-1.5 max-h-80 overflow-y-auto -mx-2 px-2">
          {feeds.length === 0 && (
            <p className="text-sm text-muted text-center py-4">No feeds available.</p>
          )}
          {feeds.map(feed => {
            const inBundle = bundleFeedIds.has(feed.id);
            return (
              <button
                key={feed.id}
                onClick={() => handleToggleFeedInBundle(feed.id)}
                className={`btn-press flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                  inBundle ? 'border-accent bg-accent-soft' : 'border-line bg-bg-base hover:border-accent/50'
                }`}
              >
                <span className={`w-4 h-4 rounded flex items-center justify-center flex-none border text-[10px] ${inBundle ? 'bg-accent border-accent text-onaccent' : 'border-line'}`}>
                  {inBundle && <Check size={10} weight="bold" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-ink truncate">{feed.title || feed.source_value}</span>
                  <span className="block text-[11px] text-muted font-mono truncate">{feed.source_type} · {feed.source_value}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
};
