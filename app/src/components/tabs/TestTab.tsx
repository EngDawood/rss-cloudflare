import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../../context/AppContext';

type SubTab = 'parser' | 'benchmark';

const RSSHUB_INSTANCES = [
  'https://rsshub.rssforever.com',
  'https://hub.slarker.me',
  'https://rsshub.pseudoyu.com',
  'https://rsshub.ktachibana.party',
  'https://rss.owo.nz',
  'https://rsshub.umzzz.com',
  'https://rsshub.isrss.com',
  'https://rsshub-balancer.virworks.moe',
  'https://rss.spriple.org',
  'https://rsshub.cups.moe',
  'https://rss.4040940.xyz',
];

const RSSBRIDGE_INSTANCES = [
  'https://rss-bridge.org/bridge01',
  'https://rssbridge.flossboxin.org.in',
  'https://rss-bridge.cheredeprince.net',
  'https://rss-bridge.sans-nuage.fr',
  'https://rss-bridge.lewd.tech',
  'https://wtf.roflcopter.fr/rss-bridge',
  'https://rss.nixnet.services',
  'https://rss-bridge.ggc-project.de',
  'https://rssbridge.boldair.dev',
  'https://rss-bridge.bb8.fun',
  'https://rss.bloat.cat',
  'https://rssbridge.projectsegfau.lt',
  'https://rb.vern.cc',
];

type BuilderEngine = 'rsshub' | 'rssbridge';
type BuilderPlatform = 'instagram_user' | 'instagram_story' | 'instagram_tag' | 'tiktok_user' | 'custom';

interface BenchmarkResult {
  instance: string;
  url: string;
  status: string;
  durationMs: number;
  items: number;
  cacheStatus: string;
}

interface BenchmarkRun {
  id: string;
  ts: number;
  platform: string;
  query: string;
  engine: string;
  results: BenchmarkResult[];
}

const BENCH_HISTORY_KEY = 'rss_bench_history';
const BENCH_HISTORY_MAX = 15;

export const TestTab: React.FC = () => {
  const { callApi, showToast } = useApp();
  const [subTab, setSubTab] = useState<SubTab>('parser');

  // Feed parser state
  const [testFeedUrl, setTestFeedUrl] = useState('');
  const [testFeedItems, setTestFeedItems] = useState<any[]>([]);
  const [isTestingFeed, setIsTestingFeed] = useState(false);

  // URL builder state
  const [showBuilder, setShowBuilder] = useState(true);
  const [builderEngine, setBuilderEngine] = useState<BuilderEngine>('rsshub');
  const [builderInstance, setBuilderInstance] = useState(RSSHUB_INSTANCES[0]);
  const [builderPlatform, setBuilderPlatform] = useState<BuilderPlatform>('instagram_user');
  const [builderQuery, setBuilderQuery] = useState('');

  // Benchmark state
  const [benchUsername, setBenchUsername] = useState('claudeai');
  const [benchInstancesType, setBenchInstancesType] = useState('all');
  const [benchPlatform, setBenchPlatform] = useState('instagram');
  const [benchCustomRoute, setBenchCustomRoute] = useState('');
  const [benchUseCache, setBenchUseCache] = useState(false);
  const [isBenchmarking, setIsBenchmarking] = useState(false);
  const [benchResults, setBenchResults] = useState<BenchmarkResult[]>([]);
  const [benchEngine, setBenchEngine] = useState('');
  const [benchHistory, setBenchHistory] = useState<BenchmarkRun[]>(() => {
    try { return JSON.parse(localStorage.getItem(BENCH_HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const [feedMeta, setFeedMeta] = useState<{ title: string; link: string } | null>(null);

  const buildUrl = (): string => {
    const q = encodeURIComponent(builderQuery.trim());
    if (!builderQuery.trim()) return '';
    if (builderPlatform === 'custom') {
      // Raw suffix — user types the path/query string directly
      const suffix = builderQuery.trim();
      const sep = suffix.startsWith('/') || suffix.startsWith('?') ? '' : '/';
      return `${builderInstance}${sep}${suffix}`;
    }
    if (!q) return '';
    if (builderEngine === 'rsshub') {
      switch (builderPlatform) {
        case 'instagram_user': return `${builderInstance}/picnob.info/user/${q}/posts?limit=10`;
        case 'instagram_story': return `${builderInstance}/picnob.info/user/${q}/stories?limit=10`;
        case 'instagram_tag': return `${builderInstance}/picnob.info/tag/${q}?limit=10`;
        case 'tiktok_user': return `${builderInstance}/tiktok/user/${q}?limit=10`;
      }
    } else {
      switch (builderPlatform) {
        case 'instagram_user': return `${builderInstance}/?action=display&bridge=InstagramBridge&format=Atom&direct_links=on&context=Username&u=${q}&media_type=all`;
        case 'instagram_tag': return `${builderInstance}/?action=display&bridge=InstagramBridge&format=Atom&direct_links=on&context=Hashtag&h=${q}`;
        case 'tiktok_user': return `${builderInstance}/?action=display&bridge=TikTokBridge&context=By+user&username=${q}&format=Atom`;
        default: return `${builderInstance}/?action=display&bridge=InstagramBridge&format=Atom&direct_links=on&context=Username&u=${q}&media_type=all`;
      }
    }
    return '';
  };

  const handleBuilderEngineChange = (engine: BuilderEngine) => {
    setBuilderEngine(engine);
    setBuilderInstance(engine === 'rsshub' ? RSSHUB_INSTANCES[0] : RSSBRIDGE_INSTANCES[0]);
    if (engine === 'rssbridge' && builderPlatform === 'instagram_story') {
      setBuilderPlatform('instagram_user');
    }
  };

  const handleApplyBuilder = () => {
    const url = buildUrl();
    if (url) {
      setTestFeedUrl(url);
      setShowBuilder(false);
    }
  };

  const handleTestFeed = async () => {
    if (!testFeedUrl) return;
    setIsTestingFeed(true);
    setTestFeedItems([]);
    setFeedMeta(null);
    showToast('Downloading and parsing feed XML...', 'info');
    const res = await callApi('fetch_rss_feed', { url: testFeedUrl, count: 5 });
    setIsTestingFeed(false);
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      setTestFeedItems(res.data.items || []);
      setFeedMeta({ title: res.data.feedTitle || 'Unnamed Feed', link: res.data.feedLink || '' });
      showToast(`Successfully parsed feed: "${res.data.feedTitle || 'Unnamed'}"`, 'success');
    }
  };

  const isCustomBenchPlatform = benchPlatform === 'custom_rsshub' || benchPlatform === 'custom_rssbridge';

  const handleRunBenchmark = async () => {
    if (!isCustomBenchPlatform && !benchUsername.trim()) {
      showToast('Username is required', 'error');
      return;
    }
    if (isCustomBenchPlatform && !benchCustomRoute.trim()) {
      showToast('Route / action params are required for custom mode', 'error');
      return;
    }
    setIsBenchmarking(true);
    setBenchResults([]);
    showToast('Running benchmark across instances...', 'info');
    const res = await callApi('test_bridges', {
      username: benchUsername.trim(),
      platform: benchPlatform,
      instancesType: benchInstancesType,
      useCache: benchUseCache,
      customRoute: isCustomBenchPlatform ? benchCustomRoute.trim() : undefined,
    });
    setIsBenchmarking(false);
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      const results: BenchmarkResult[] = res.data.results || [];
      const engine: string = res.data.engine || '';
      setBenchResults(results);
      setBenchEngine(engine);
      const run: BenchmarkRun = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ts: Date.now(),
        platform: benchPlatform,
        query: isCustomBenchPlatform ? benchCustomRoute.trim() : benchUsername.trim(),
        engine,
        results,
      };
      setBenchHistory(prev => {
        const next = [run, ...prev].slice(0, BENCH_HISTORY_MAX);
        try { localStorage.setItem(BENCH_HISTORY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
      showToast(`Benchmark complete — ${results.length} instances tested`, 'success');
    }
  };

  const handleInstancesChange = (val: string) => {
    setBenchInstancesType(val);
    if ((val === 'rssbridge' || val === 'all') && benchPlatform === 'instagram_story') {
      setBenchPlatform('instagram');
    }
  };

  const formatDate = (unixSecs: number | null | undefined) => {
    if (!unixSecs) return 'Never';
    const date = new Date(unixSecs * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const storiesDisabled = benchInstancesType !== 'rsshub';

  return (
    <motion.div
      key="test"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="h-full rr-scroll px-6 md:px-10 py-8 flex flex-col gap-6"
    >
      {/* Sub-nav */}
      <div className="flex gap-1 p-1 bg-bg-input border border-border-base rounded-xl w-fit">
        {(['parser', 'benchmark'] as SubTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setSubTab(tab)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 cursor-pointer ${
              subTab === tab
                ? 'bg-accent-primary text-white shadow-sm'
                : 'text-text-muted hover:text-text-base'
            }`}
          >
            {tab === 'parser' ? 'Test Feed Parser' : 'Bridge Benchmarker'}
          </button>
        ))}
      </div>

      {subTab === 'parser' && (
        <>
          <div>
            <h2 className="font-display font-semibold text-[32px] leading-none text-ink">Test Feed Parser</h2>
            <p className="font-display italic text-[15px] text-muted mt-1.5">Download and preview items from any external feed before registering it</p>
          </div>

          <div className="liquid-glass p-6 rounded-2xl flex flex-col gap-4">
            {/* URL input row */}
            <div className="flex gap-3 flex-wrap">
              <input
                type="url"
                value={testFeedUrl}
                onChange={e => setTestFeedUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTestFeed()}
                placeholder="Paste any RSS/Atom URL — or use the URL Builder below..."
                className="flex-grow bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono"
              />
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleTestFeed}
                disabled={isTestingFeed || !testFeedUrl}
                className="px-6 py-3 text-sm font-bold rounded-xl bg-accent-primary text-white hover:bg-accent-primary-hover transition duration-200 disabled:opacity-50 cursor-pointer"
              >
                {isTestingFeed ? 'Parsing...' : 'Test Fetch'}
              </motion.button>
            </div>

            {/* URL Builder toggle */}
            <button
              onClick={() => setShowBuilder(v => !v)}
              className="text-xs font-semibold text-accent-primary hover:underline text-left w-fit"
            >
              {showBuilder ? '▲ Hide URL Builder' : '▼ URL Builder — RSSHub / RSS-Bridge'}
            </button>

            {/* URL Builder panel */}
            {showBuilder && (
              <div className="p-4 rounded-xl bg-bg-input border border-border-base flex flex-col gap-4">
                <div className="flex gap-3 flex-wrap items-end">
                  {/* Engine */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Engine</label>
                    <div className="flex gap-1">
                      {(['rsshub', 'rssbridge'] as BuilderEngine[]).map(e => (
                        <button
                          key={e}
                          onClick={() => handleBuilderEngineChange(e)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                            builderEngine === e
                              ? 'bg-accent-primary text-white'
                              : 'bg-bg-base border border-border-base text-text-muted hover:text-text-base'
                          }`}
                        >
                          {e === 'rsshub' ? 'RSSHub' : 'RSS-Bridge'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Instance */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Instance</label>
                    <select
                      value={builderInstance}
                      onChange={e => setBuilderInstance(e.target.value)}
                      className="bg-bg-base border border-border-base rounded-xl px-3 py-1.5 text-xs text-text-base focus:outline-none focus:border-accent-primary font-mono"
                    >
                      {(builderEngine === 'rsshub' ? RSSHUB_INSTANCES : RSSBRIDGE_INSTANCES).map(inst => (
                        <option key={inst} value={inst}>{inst.replace(/^https?:\/\//, '')}</option>
                      ))}
                    </select>
                  </div>

                  {/* Platform */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted">Platform</label>
                    <select
                      value={builderPlatform}
                      onChange={e => setBuilderPlatform(e.target.value as BuilderPlatform)}
                      className="bg-bg-base border border-border-base rounded-xl px-3 py-1.5 text-xs text-text-base focus:outline-none focus:border-accent-primary"
                    >
                      <option value="instagram_user">Instagram User Posts</option>
                      {builderEngine === 'rsshub' && (
                        <option value="instagram_story">Instagram Stories</option>
                      )}
                      <option value="instagram_tag">Instagram Hashtag</option>
                      <option value="tiktok_user">TikTok User</option>
                      <option value="custom">{builderEngine === 'rsshub' ? 'Any RSSHub Route (e.g. /anthropic/research)' : 'Custom Bridge Action (any bridge)'}</option>
                    </select>
                  </div>

                  {/* Query */}
                  <div className="flex flex-col gap-1.5 flex-grow min-w-[180px]">
                    <label className="text-[10px] font-bold uppercase tracking-wide text-text-muted">
                      {builderPlatform === 'custom'
                        ? builderEngine === 'rsshub' ? 'RSSHub route path' : 'RSS-Bridge action params'
                        : builderPlatform === 'instagram_tag' ? 'Hashtag' : 'Username'}
                    </label>
                    <input
                      type="text"
                      value={builderQuery}
                      onChange={e => setBuilderQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleApplyBuilder()}
                      placeholder={
                        builderPlatform === 'custom'
                          ? builderEngine === 'rsshub' ? '/anthropic/research  or  /youtube/channel/UC...' : '?action=display&bridge=YouTubeBridge&...'
                          : builderPlatform === 'instagram_tag' ? 'e.g. nature' : 'e.g. claudeai'
                      }
                      className="bg-bg-base border border-border-base rounded-xl px-3 py-1.5 text-xs text-text-base focus:outline-none focus:border-accent-primary font-mono"
                    />
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleApplyBuilder}
                    disabled={!builderQuery.trim()}
                    className="px-4 py-1.5 text-xs font-bold rounded-xl bg-accent-primary text-white hover:bg-accent-primary-hover transition duration-200 disabled:opacity-50 cursor-pointer self-end"
                  >
                    Use URL →
                  </motion.button>
                </div>

                {/* Preview of generated URL */}
                {builderQuery.trim() && (
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-bg-base border border-border-base">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-text-muted shrink-0 mt-0.5">URL</span>
                    <span className="text-[11px] font-mono text-text-muted break-all">{buildUrl()}</span>
                  </div>
                )}
              </div>
            )}

            {feedMeta && testFeedItems.length > 0 && (
              <div className="mt-4 border-t border-border-base pt-4">
                {/* Feed header */}
                <div className="mb-3 flex items-center gap-3 flex-wrap">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted">Feed preview</h4>
                  <div className="flex items-center gap-2">
                    {feedMeta.link ? (
                      <a
                        href={feedMeta.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-accent-primary hover:underline"
                      >
                        {feedMeta.title}
                      </a>
                    ) : (
                      <span className="text-sm font-semibold text-text-base">{feedMeta.title}</span>
                    )}
                    <span className="text-xs text-text-muted">({testFeedItems.length} items)</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-2">
                  {testFeedItems.map((item, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-bg-input border border-border-base flex flex-col gap-1.5">
                      {/* Title row */}
                      <div className="flex items-start gap-2 flex-wrap">
                        {item.link ? (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-sm text-accent-primary hover:underline"
                          >
                            {item.title || '(no title)'}
                          </a>
                        ) : (
                          <span className="font-bold text-sm text-text-base">{item.title || '(no title)'}</span>
                        )}
                        {item.mediaType && item.mediaType !== 'all' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-accent-primary/10 text-accent-primary shrink-0">
                            {item.mediaType}
                          </span>
                        )}
                      </div>

                      {/* Meta row */}
                      <span className="text-xs text-text-muted font-mono">
                        By {item.author || 'unknown'} · {formatDate(item.timestamp)}
                      </span>

                      {/* Topics */}
                      {item.topics && item.topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {item.topics.slice(0, 6).map((t: string, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] bg-bg-base border border-border-base text-text-muted">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Text preview */}
                      {item.text && (
                        <p className="text-xs text-text-muted mt-1 line-clamp-3 max-w-[90ch]">{item.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {subTab === 'benchmark' && (
        <>
          <div>
            <h2 className="font-bold text-2xl tracking-tight text-text-base">Bridge Benchmarker</h2>
            <p className="text-xs text-text-muted mt-1">Compare RSS-Bridge & RSSHub instance latency from the Cloudflare edge</p>
          </div>

          <div className="liquid-glass p-6 rounded-2xl flex flex-col gap-4">
            {/* Form */}
            <div className="flex gap-4 flex-wrap items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wide">Platform</label>
                <select
                  value={benchPlatform}
                  onChange={e => setBenchPlatform(e.target.value)}
                  className="bg-bg-input border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-base focus:outline-none focus:border-accent-primary"
                >
                  <option value="instagram">Instagram Posts</option>
                  <option value="instagram_story" disabled={storiesDisabled}>
                    Instagram Stories{storiesDisabled ? ' (RSSHub only)' : ''}
                  </option>
                  <option value="tiktok">TikTok</option>
                  <option value="custom_rsshub">Custom RSSHub Route</option>
                  <option value="custom_rssbridge">Custom RSS-Bridge Action</option>
                </select>
              </div>

              {/* Username — hidden for custom route modes */}
              {!isCustomBenchPlatform && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wide">Username / Query</label>
                  <input
                    type="text"
                    value={benchUsername}
                    onChange={e => setBenchUsername(e.target.value)}
                    placeholder="e.g. claudeai"
                    className="bg-bg-input border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono w-48"
                  />
                </div>
              )}

              {/* Custom route input */}
              {isCustomBenchPlatform && (
                <div className="flex flex-col gap-1.5 flex-grow min-w-[260px]">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wide">
                    {benchPlatform === 'custom_rsshub' ? 'RSSHub route path' : 'RSS-Bridge action params'}
                  </label>
                  <input
                    type="text"
                    value={benchCustomRoute}
                    onChange={e => setBenchCustomRoute(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRunBenchmark()}
                    placeholder={benchPlatform === 'custom_rsshub' ? '/anthropic/research  or  /youtube/channel/UC...' : '?action=display&bridge=YouTubeBridge&...'}
                    className="bg-bg-input border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono"
                  />
                </div>
              )}

              {/* Instances selector — hidden for custom modes (they auto-select the right set) */}
              {!isCustomBenchPlatform && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wide">Instances</label>
                  <select
                    value={benchInstancesType}
                    onChange={e => handleInstancesChange(e.target.value)}
                    className="bg-bg-input border border-border-base rounded-xl px-4 py-2.5 text-sm text-text-base focus:outline-none focus:border-accent-primary"
                  >
                    <option value="all">Compare RSSHub & RSS-Bridge</option>
                    <option value="rssbridge">Only RSS-Bridge</option>
                    <option value="rsshub">Only RSSHub</option>
                  </select>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wide">Options</label>
                <label className="flex items-center gap-2 text-sm text-text-base cursor-pointer py-2.5">
                  <input
                    type="checkbox"
                    checked={benchUseCache}
                    onChange={e => setBenchUseCache(e.target.checked)}
                    className="rounded"
                  />
                  Use Edge Cache
                </label>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleRunBenchmark}
                disabled={isBenchmarking}
                className="px-6 py-2.5 text-sm font-bold rounded-xl bg-accent-primary text-white hover:bg-accent-primary-hover transition duration-200 disabled:opacity-50 cursor-pointer self-end"
              >
                {isBenchmarking ? 'Running...' : 'Run Benchmark'}
              </motion.button>
            </div>

            {/* Results */}
            {benchResults.length > 0 && (
              <div className="mt-2 border-t border-border-base pt-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">
                  Results — {benchEngine} ({benchResults.length} instances)
                </h4>
                <div className="overflow-x-auto rounded-xl border border-border-base">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-bg-input border-b border-border-base">
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-text-muted">Instance</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-text-muted">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-text-muted">Response Time</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-text-muted">Items</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-text-muted">Cache</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-text-muted">Feed URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {benchResults.map((r, idx) => (
                        <tr key={idx} className="border-b border-border-base last:border-0 hover:bg-bg-input transition-colors">
                          <td className="px-4 py-3 font-mono text-xs text-text-base">{r.instance.replace(/^https?:\/\//, '')}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                              r.status === 'Success'
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                            }`}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {r.durationMs === 0 && r.cacheStatus === 'Hit' ? (
                              <span className="text-blue-500 font-bold text-xs">cached</span>
                            ) : (
                              <span className={`font-mono text-xs font-bold ${r.durationMs < 3000 ? 'text-green-500' : 'text-orange-500'}`}>
                                {r.durationMs} ms
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-text-base">{r.items}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold ${
                              r.cacheStatus === 'Hit' ? 'text-blue-500' :
                              r.cacheStatus === 'Miss' ? 'text-text-muted' :
                              'text-text-muted'
                            }`}>
                              {r.cacheStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 max-w-[260px]">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-mono text-accent-primary hover:underline break-all line-clamp-2"
                            >
                              {r.url}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!isBenchmarking && benchResults.length === 0 && (
              <p className="text-sm text-text-muted text-center py-6">
                Click "Run Benchmark" to test latency across instances from the Cloudflare edge.
              </p>
            )}
          </div>

          {/* Run History */}
          {benchHistory.length > 0 && (
            <div className="liquid-glass rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowHistory(v => !v)}
                className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-text-base hover:bg-bg-input transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">🕐</span>
                  Run History
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-input border border-border-base text-text-muted">
                    {benchHistory.length}
                  </span>
                </span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setBenchHistory([]);
                      setExpandedRunId(null);
                      try { localStorage.removeItem(BENCH_HISTORY_KEY); } catch { /* ignore */ }
                    }}
                    className="text-xs text-text-muted hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                  <span className="text-text-muted">{showHistory ? '▲' : '▼'}</span>
                </div>
              </button>

              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden border-t border-border-base"
                  >
                    <div className="flex flex-col divide-y divide-border-base">
                      {benchHistory.map(run => {
                        const successes = run.results.filter(r => r.status === 'Success').length;
                        const best = run.results
                          .filter(r => r.status === 'Success' && r.durationMs > 0)
                          .sort((a, b) => a.durationMs - b.durationMs)[0];
                        const isExpanded = expandedRunId === run.id;
                        const ts = new Date(run.ts);
                        const timeLabel = ts.toLocaleDateString() + ' ' + ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div key={run.id}>
                            <button
                              onClick={() => setExpandedRunId(isExpanded ? null : run.id)}
                              className="w-full flex items-center gap-3 px-6 py-3 hover:bg-bg-input transition-colors text-left"
                            >
                              <span className="text-xs text-text-muted font-mono w-32 shrink-0">{timeLabel}</span>
                              <span className="flex-1 min-w-0">
                                <span className="text-xs font-semibold text-text-base">{run.query || '—'}</span>
                                <span className="text-[10px] text-text-muted ml-2">{run.platform}</span>
                              </span>
                              <span className="text-xs text-text-muted shrink-0">
                                {successes}/{run.results.length} ok
                              </span>
                              {best && (
                                <span className="text-xs font-mono text-green-500 shrink-0 w-20 text-right">
                                  best {best.durationMs} ms
                                </span>
                              )}
                              <span className="text-text-muted ml-2 shrink-0">{isExpanded ? '▲' : '▼'}</span>
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-6 pb-4 overflow-x-auto">
                                    <table className="w-full text-sm border-collapse border border-border-base rounded-xl overflow-hidden">
                                      <thead>
                                        <tr className="bg-bg-input border-b border-border-base">
                                          <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-text-muted">Instance</th>
                                          <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-text-muted">Status</th>
                                          <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-text-muted">Time</th>
                                          <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-text-muted">Items</th>
                                          <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-text-muted">Cache</th>
                                          <th className="text-left px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-text-muted">Feed URL</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {run.results.map((r, idx) => (
                                          <tr key={idx} className="border-b border-border-base last:border-0 hover:bg-bg-input/50 transition-colors">
                                            <td className="px-4 py-2 font-mono text-xs text-text-base">{r.instance.replace(/^https?:\/\//, '')}</td>
                                            <td className="px-4 py-2">
                                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                r.status === 'Success'
                                                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                                  : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                              }`}>
                                                {r.status}
                                              </span>
                                            </td>
                                            <td className="px-4 py-2">
                                              {r.durationMs === 0 && r.cacheStatus === 'Hit' ? (
                                                <span className="text-blue-500 font-bold text-xs">cached</span>
                                              ) : (
                                                <span className={`font-mono text-xs font-bold ${r.durationMs < 3000 ? 'text-green-500' : 'text-orange-500'}`}>
                                                  {r.durationMs} ms
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-4 py-2 text-xs text-text-base">{r.items}</td>
                                            <td className="px-4 py-2 text-xs text-text-muted">{r.cacheStatus}</td>
                                            <td className="px-4 py-2 max-w-[240px]">
                                              <a
                                                href={r.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs font-mono text-accent-primary hover:underline break-all line-clamp-2"
                                              >
                                                {r.url}
                                              </a>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default TestTab;
