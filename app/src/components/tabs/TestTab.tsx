import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';

export const TestTab: React.FC = () => {
  const { callApi, showToast } = useApp();
  const [testFeedUrl, setTestFeedUrl] = useState('');
  const [testFeedItems, setTestFeedItems] = useState<any[]>([]);
  const [isTestingFeed, setIsTestingFeed] = useState(false);

  const handleTestFeed = async () => {
    if (!testFeedUrl) return;
    setIsTestingFeed(true);
    setTestFeedItems([]);
    showToast('Downloading and parsing feed XML...', 'info');
    const res = await callApi('fetch_rss_feed', { url: testFeedUrl, count: 5 });
    setIsTestingFeed(false);
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      setTestFeedItems(res.data.items || []);
      showToast(`Successfully parsed feed: "${res.data.feedTitle || 'Unnamed'}"`, 'success');
    }
  };

  const formatDate = (unixSecs: number | null | undefined) => {
    if (!unixSecs) return 'Never';
    const date = new Date(unixSecs * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div
      key="test"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="font-bold text-2xl tracking-tight text-text-base">Test Feed Parser</h2>
        <p className="text-xs text-text-muted mt-1">Download and preview items from any external feed before registering it</p>
      </div>

      <div className="liquid-glass p-6 rounded-2xl flex flex-col gap-4">
        <div className="flex gap-3 flex-wrap">
          <input
            type="url"
            value={testFeedUrl}
            onChange={e => setTestFeedUrl(e.target.value)}
            placeholder="Enter external RSS/Atom URL..."
            className="flex-grow bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono"
          />
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={handleTestFeed}
            disabled={isTestingFeed}
            className="px-6 py-3 text-sm font-bold rounded-xl bg-accent-primary text-white hover:bg-accent-primary-hover transition duration-200 disabled:opacity-50 cursor-pointer"
          >
            {isTestingFeed ? 'Parsing...' : 'Test Fetch'}
          </motion.button>
        </div>

        {testFeedItems.length > 0 && (
          <div className="mt-4 border-t border-border-base pt-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">Feed preview outcomes</h4>
            <div className="flex flex-col gap-3 max-h-[500px] overflow-y-auto pr-2">
              {testFeedItems.map((item, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-bg-input border border-border-base">
                  <span className="font-bold text-sm text-text-base block">{item.title}</span>
                  <span className="text-xs text-text-muted block mt-1 font-mono">By {item.author || 'unknown'} | {formatDate(item.timestamp)}</span>
                  <p className="text-xs text-text-muted mt-2 line-clamp-2 max-w-[80ch]">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
export default TestTab;
