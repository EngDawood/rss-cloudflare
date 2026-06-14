import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowsClockwise, ArrowUp, ArrowDown, Plus, Trash } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';

interface TestResult {
  success: boolean;
  itemCount: number;
  durationMs: number;
  url: string;
}

export const InstancesTab: React.FC = () => {
  const { callApi, showToast } = useApp();
  const [instances, setInstances] = useState<{ rssbridge: string[]; tiktok: string[]; rsshub: string[] }>({ rssbridge: [], tiktok: [], rsshub: [] });
  const [isBenchmarking, setIsBenchmarking] = useState<Record<string, boolean>>({ rssbridge: false, tiktok: false, rsshub: false });
  const [isTesting, setIsTesting] = useState<Record<string, boolean>>({ rssbridge: false, tiktok: false, rsshub: false });
  const [testResults, setTestResults] = useState<Record<string, TestResult | null>>({ rssbridge: null, tiktok: null, rsshub: null });
  const [newInstanceInputs, setNewInstanceInputs] = useState<Record<string, string>>({ rssbridge: '', tiktok: '', rsshub: '' });

  const callApiRef = useRef(callApi);
  callApiRef.current = callApi;

  const loadInstances = useCallback(async () => {
    const res = await callApiRef.current('get_instances');
    if (!res.error && res.data) setInstances(res.data);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  const handleSaveInstances = async (type: 'rssbridge' | 'tiktok' | 'rsshub') => {
    const res = await callApi('set_instances', { type, instances: instances[type] });
    if (res.error) showToast(`Failed to save: ${res.error}`, 'error');
    else showToast(`${type} instances saved (${instances[type].length} entries)`, 'success');
  };

  const handleRunBenchmark = async (type: 'rssbridge' | 'tiktok' | 'rsshub') => {
    setIsBenchmarking(prev => ({ ...prev, [type]: true }));
    showToast(`Benchmarking ${type} instances…`, 'info');
    const res = await callApi('run_benchmark', { type });
    if (res.error) showToast(`Benchmark failed: ${res.error}`, 'error');
    else { showToast(`${type} instances re-ranked by items found + speed`, 'success'); await loadInstances(); }
    setIsBenchmarking(prev => ({ ...prev, [type]: false }));
  };

  const handleTestInstance = async (type: 'rssbridge' | 'tiktok' | 'rsshub') => {
    const url = newInstanceInputs[type].trim();
    if (!url) return;
    setIsTesting(prev => ({ ...prev, [type]: true }));
    setTestResults(prev => ({ ...prev, [type]: null }));
    const res = await callApi('test_instance', { url, type });
    if (!res.error && res.data) setTestResults(prev => ({ ...prev, [type]: { ...res.data, url } }));
    else showToast(`Test failed: ${res.error}`, 'error');
    setIsTesting(prev => ({ ...prev, [type]: false }));
  };

  const moveInstance = (type: 'rssbridge' | 'tiktok' | 'rsshub', index: number, dir: -1 | 1) => {
    const list = [...instances[type]];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    setInstances(prev => ({ ...prev, [type]: list }));
  };

  const removeInstance = (type: 'rssbridge' | 'tiktok' | 'rsshub', index: number) => {
    setInstances(prev => ({ ...prev, [type]: prev[type].filter((_, i) => i !== index) }));
  };

  const addInstance = (type: 'rssbridge' | 'tiktok' | 'rsshub') => {
    const url = newInstanceInputs[type].trim().replace(/\/$/, '');
    if (!url || instances[type].includes(url)) return;
    setInstances(prev => ({ ...prev, [type]: [...prev[type], url] }));
    setNewInstanceInputs(prev => ({ ...prev, [type]: '' }));
  };


  const instanceTypes = [
    { key: 'rssbridge' as const, label: 'RSS-Bridge', color: 'blue' },
    { key: 'tiktok' as const, label: 'TikTok-Specific', color: 'rose' },
    { key: 'rsshub' as const, label: 'RSSHub', color: 'emerald' },
  ];

  return (
    <motion.div
      key="instances"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="font-bold text-2xl tracking-tight text-text-base">Instance Management</h2>
        <p className="text-xs text-text-muted mt-1">Reorder, add, or remove instances. Top 3 are tried on each fetch — benchmark ranks by items returned, then speed.</p>
      </div>

      <div className="flex flex-col gap-4">
        {instanceTypes.map(({ key, label, color }) => (
          <div key={key} className="liquid-glass p-5 rounded-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm uppercase tracking-wider text-text-muted">{label}</h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  color === 'blue' ? 'bg-blue-500/10 text-blue-400' :
                  color === 'rose' ? 'bg-rose-500/10 text-rose-400' :
                  'bg-emerald-500/10 text-emerald-400'
                }`}>{instances[key]?.length || 0}</span>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => handleRunBenchmark(key)}
                disabled={isBenchmarking[key]}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-text-muted bg-bg-input border border-border-base rounded-lg hover:text-text-base transition duration-200 cursor-pointer disabled:opacity-50 flex-shrink-0"
              >
                <ArrowsClockwise size={11} className={isBenchmarking[key] ? 'animate-spin' : ''} />
                <span>{isBenchmarking[key] ? 'Testing…' : 'Benchmark'}</span>
              </motion.button>
            </div>

            <div className="flex flex-col gap-1.5">
              {(instances[key] || []).map((url, idx) => (
                <div key={url} className="flex items-center gap-2 bg-bg-input border border-border-base rounded-xl px-3 py-2">
                  <span className="text-[10px] font-mono text-text-muted w-4 text-right flex-shrink-0">{idx + 1}</span>
                  <span className="text-xs font-mono text-text-base truncate flex-1 min-w-0">{url}</span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => moveInstance(key, idx, -1)}
                      disabled={idx === 0}
                      className="p-1 rounded-lg text-text-muted hover:text-text-base hover:bg-white/5 disabled:opacity-20 cursor-pointer transition"
                    ><ArrowUp size={11} /></button>
                    <button
                      onClick={() => moveInstance(key, idx, 1)}
                      disabled={idx === (instances[key]?.length || 0) - 1}
                      className="p-1 rounded-lg text-text-muted hover:text-text-base hover:bg-white/5 disabled:opacity-20 cursor-pointer transition"
                    ><ArrowDown size={11} /></button>
                    <button
                      onClick={() => removeInstance(key, idx)}
                      className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/10 cursor-pointer transition"
                    ><Trash size={11} /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 border-t border-border-base pt-3">
              <input
                type="url"
                placeholder="https://new-instance.example.com"
                value={newInstanceInputs[key] || ''}
                onChange={e => setNewInstanceInputs(prev => ({ ...prev, [key]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addInstance(key); } }}
                className="flex-1 bg-bg-input border border-border-base rounded-xl px-3 py-2 text-xs text-text-base focus:outline-none focus:border-accent-primary font-mono min-w-0"
              />
              <button
                onClick={() => addInstance(key)}
                className="px-3 py-2 rounded-xl bg-bg-input border border-border-base text-text-muted hover:text-text-base transition cursor-pointer flex-shrink-0"
              ><Plus size={13} /></button>
            </div>

            <div className="flex flex-col gap-2 border-t border-border-base pt-3">
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSaveInstances(key)}
                className="w-full py-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary-hover text-white font-bold text-xs transition duration-200 cursor-pointer"
              >
                Save Order
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => handleTestInstance(key)}
                disabled={isTesting[key] || !(newInstanceInputs[key] || '').trim()}
                className="w-full py-2 rounded-xl bg-bg-input border border-border-base text-text-muted hover:text-text-base font-bold text-xs transition duration-200 cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
              >
                <ArrowsClockwise size={12} className={isTesting[key] ? 'animate-spin' : ''} />
                <span>{isTesting[key] ? 'Testing…' : 'Test URL above'}</span>
              </motion.button>
              {testResults[key] && (
                <div className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs border ${testResults[key]!.itemCount > 0 ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400' : testResults[key]!.success ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-400' : 'bg-rose-500/5 border-rose-500/20 text-rose-400'}`}>
                  <span className="font-bold">{testResults[key]!.itemCount > 0 ? '✓' : testResults[key]!.success ? '!' : '✗'}</span>
                  <span className="font-mono truncate flex-1 min-w-0 text-[10px]">{testResults[key]!.url}</span>
                  <span className="flex-shrink-0 font-mono">{testResults[key]!.itemCount} items · {testResults[key]!.durationMs}ms</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
export default InstancesTab;
