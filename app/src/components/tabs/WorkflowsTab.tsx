import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Trash, Play, Sparkle, ArrowClockwise, PencilSimple, 
  Cpu, TelegramLogo, GlobeSimple, FileText, Check, ListChecks 
} from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';

interface Workflow {
  id: string;
  name: string;
  feed_id: string | null;
  ai_model: string;
  system_prompt: string;
  enabled_tools: string[];
  trigger_type: string;
  batch_size: number;
  created_at: string;
}

export const WorkflowsTab: React.FC = () => {
  const { feeds, callApi, showToast } = useApp();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal / Form State
  const [isOpen, setIsOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [wfId, setWfId] = useState('');
  const [wfName, setWfName] = useState('');
  const [wfFeedId, setWfFeedId] = useState('');
  const [wfAiModel, setWfAiModel] = useState('google/gemini-2.0-flash');
  const [wfSystemPrompt, setWfSystemPrompt] = useState('أنت مساعد ذكي تلخص محتوى التغذية الإخبارية وترسل الملخصات.');
  const [wfTools, setWfTools] = useState({ telegram: true, emdash: false });
  const [wfTriggerType, setWfTriggerType] = useState('rss_batch');
  const [wfBatchSize, setWfBatchSize] = useState(1);

  const springTransition = { type: 'spring', stiffness: 100, damping: 20 } as const;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { 
      opacity: 1, 
      y: 0, 
      transition: springTransition
    }
  };

  const loadWorkflows = async () => {
    setLoading(true);
    const res = await callApi<Workflow[]>('list_agent_workflows');
    if (!res.error) {
      setWorkflows(res.data || []);
    } else {
      showToast(res.error, 'error');
    }
    setLoading(false);
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const openCreateModal = () => {
    setIsEditMode(false);
    setWfId('');
    setWfName('');
    setWfFeedId('');
    setWfAiModel('google/gemini-2.0-flash');
    setWfSystemPrompt('أنت مساعد ذكي تلخص محتوى التغذية الإخبارية وترسل الملخصات.');
    setWfTools({ telegram: true, emdash: false });
    setWfTriggerType('rss_batch');
    setWfBatchSize(1);
    setIsOpen(true);
  };

  const openEditModal = (wf: Workflow) => {
    setIsEditMode(true);
    setWfId(wf.id);
    setWfName(wf.name);
    setWfFeedId(wf.feed_id || '');
    setWfAiModel(wf.ai_model);
    setWfSystemPrompt(wf.system_prompt);
    setWfTools({
      telegram: wf.enabled_tools.includes('telegram'),
      emdash: wf.enabled_tools.includes('emdash')
    });
    setWfTriggerType(wf.trigger_type);
    setWfBatchSize(wf.batch_size);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wfId.trim() || !wfName.trim()) {
      showToast('ID and Name are required.', 'warning');
      return;
    }

    setIsOpen(false);

    const enabledToolsList = [];
    if (wfTools.telegram) enabledToolsList.push('telegram');
    if (wfTools.emdash) enabledToolsList.push('emdash');

    const payload = {
      id: wfId.trim(),
      name: wfName.trim(),
      feedId: wfFeedId || null,
      aiModel: wfAiModel,
      systemPrompt: wfSystemPrompt,
      enabledTools: enabledToolsList,
      triggerType: wfTriggerType,
      batchSize: wfTriggerType === 'rss_batch' ? Number(wfBatchSize) : 1
    };

    const action = isEditMode ? 'update_agent_workflow' : 'create_agent_workflow';
    const res = await callApi(action, payload);

    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(isEditMode ? 'Workflow updated!' : 'Agent workflow created!', 'success');
      loadWorkflows();
    }
  };

  const handleTriggerWorkflow = async (workflowId: string) => {
    showToast('Executing workflow run...', 'info');
    const res = await callApi('trigger_agent_workflow', { workflowId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Workflow execution triggered! Processed ${res.data?.itemsCount || 0} items.`, 'success');
    }
  };

  const handleDeleteWorkflow = async (workflowId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete workflow "${name}"?`)) return;
    const res = await callApi('delete_agent_workflow', { workflowId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Workflow configuration removed.', 'success');
      loadWorkflows();
    }
  };

  const getFeedTitle = (feedId: string | null) => {
    if (!feedId) return 'Any Feed';
    const feed = feeds.find(f => f.id === feedId);
    return feed ? feed.title : feedId;
  };

  // Metrics calculation
  const totalWorkflows = workflows.length;
  const rssWorkflows = workflows.filter(w => w.trigger_type === 'rss_batch').length;
  const telegramToolsCount = workflows.filter(w => w.enabled_tools.includes('telegram')).length;
  const emdashToolsCount = workflows.filter(w => w.enabled_tools.includes('emdash')).length;

  return (
    <motion.div
      key="workflows"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-8"
    >
      {/* Header Block */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-bold text-3xl tracking-tight text-text-base">Agent Workflows</h2>
          <p className="text-sm text-text-muted mt-1 max-w-[65ch]">
            Configure and orchestrate durable execution loops using dynamic AI models, system prompts, and custom tools.
          </p>
        </div>
        <div className="flex gap-2.5">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={loadWorkflows}
            className="flex items-center justify-center p-3 rounded-xl border border-border-base bg-bg-card hover:bg-white/5 text-text-muted hover:text-text-base cursor-pointer transition active:scale-95"
          >
            <ArrowClockwise size={16} className={loading ? 'animate-spin' : ''} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={openCreateModal}
            className="flex items-center gap-2 px-5 py-3 text-xs font-bold text-white bg-accent-primary rounded-xl hover:bg-accent-primary-hover transition duration-200 shadow-lg cursor-pointer hover:-translate-y-[1px] active:translate-y-[1px]"
          >
            <Plus size={14} weight="bold" />
            <span>Create Workflow</span>
          </motion.button>
        </div>
      </div>

      {/* Bento Grid Layout */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Bento Card 1: System Health & Statistics Summary */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-1 p-8 rounded-3xl border border-border-base bg-bg-card/20 backdrop-blur-md flex flex-col justify-between shadow-2xl relative overflow-hidden"
        >
          {/* Edge Refraction Border */}
          <div className="absolute inset-px rounded-[22px] border border-white/5 pointer-events-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />
          
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center text-accent-primary">
                <Cpu size={20} />
              </div>
              <div>
                <h3 className="font-bold text-base text-text-base">Workflow Engine</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Active</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-text-muted mt-6 leading-relaxed font-semibold">
              Workflows run on top of durable execution stubs. Failed steps are automatically retried, maintaining persistent state in-between runs.
            </p>

            {/* Grid of stats */}
            <div className="grid grid-cols-2 gap-4 mt-8">
              <div className="p-4.5 rounded-2xl border border-border-base bg-bg-input/30">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Total Agents</span>
                <span className="text-2xl font-bold font-mono mt-1 text-text-base block">{totalWorkflows}</span>
              </div>
              <div className="p-4.5 rounded-2xl border border-border-base bg-bg-input/30">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">RSS Triggers</span>
                <span className="text-2xl font-bold font-mono mt-1 text-text-base block">{rssWorkflows}</span>
              </div>
              <div className="p-4.5 rounded-2xl border border-border-base bg-bg-input/30">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Telegram Tools</span>
                <span className="text-2xl font-bold font-mono mt-1 text-text-base block">{telegramToolsCount}</span>
              </div>
              <div className="p-4.5 rounded-2xl border border-border-base bg-bg-input/30">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block">Emdash Tools</span>
                <span className="text-2xl font-bold font-mono mt-1 text-text-base block">{emdashToolsCount}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t border-border-base text-[10px] text-text-muted font-bold uppercase tracking-wider">
            Connected Domain: <span className="text-text-base font-mono font-semibold">rss.feed.engdawood.com</span>
          </div>
        </motion.div>

        {/* Bento Cards 2+: Workflow Items */}
        <AnimatePresence>
          {loading && workflows.length === 0 ? (
            <motion.div
              variants={itemVariants}
              className="lg:col-span-2 p-12 text-center border border-dashed border-border-base rounded-3xl bg-bg-card/15 text-sm text-text-muted animate-pulse"
            >
              Loading agent workflows configuration...
            </motion.div>
          ) : workflows.length === 0 ? (
            <motion.div
              variants={itemVariants}
              className="lg:col-span-2 p-12 flex flex-col items-center justify-center border border-dashed border-border-base rounded-3xl bg-bg-card/15 text-sm text-text-muted"
            >
              <ListChecks size={36} className="text-text-muted opacity-40 mb-3" />
              <span>No workflows configured. Click "Create Workflow" to get started.</span>
            </motion.div>
          ) : (
            workflows.map(wf => (
              <motion.div
                key={wf.id}
                variants={itemVariants}
                layoutId={`wf-card-${wf.id}`}
                whileHover={{ y: -3 }}
                transition={springTransition}
                className="p-8 rounded-3xl border border-border-base bg-bg-card/25 backdrop-blur-md flex flex-col justify-between shadow-xl relative overflow-hidden group"
              >
                {/* Edge Refraction Border */}
                <div className="absolute inset-px rounded-[22px] border border-white/5 pointer-events-none shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]" />
                
                <div>
                  <div className="flex justify-between items-start gap-4 flex-wrap">
                    <div>
                      <h4 className="font-bold text-lg text-text-base leading-tight">{wf.name}</h4>
                      <span className="text-[10px] font-mono font-bold bg-white/5 border border-border-base text-text-muted px-2 py-0.5 rounded tracking-wide mt-1.5 inline-block uppercase select-all">
                        {wf.id}
                      </span>
                    </div>

                    <div className="flex gap-1">
                      {wf.enabled_tools.map(tool => (
                        <span 
                          key={tool} 
                          className="flex items-center gap-1 text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded bg-accent-primary/10 text-accent-primary border border-accent-primary/20"
                        >
                          {tool === 'telegram' ? <TelegramLogo size={10} /> : <GlobeSimple size={10} />}
                          <span>{tool}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Config settings grid */}
                  <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-border-base/40">
                    <div>
                      <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">AI Inference Model</span>
                      <span className="text-xs text-text-base font-semibold truncate block mt-0.5 font-mono">{wf.ai_model.split('/').pop()}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Trigger Type</span>
                      <span className="text-xs text-text-base font-bold capitalize block mt-0.5">{wf.trigger_type.replace('_', ' ')}</span>
                    </div>
                    {wf.feed_id && (
                      <div className="col-span-2">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">Trigger Source Feed</span>
                        <span className="text-xs text-text-base font-semibold truncate block mt-0.5">{getFeedTitle(wf.feed_id)}</span>
                      </div>
                    )}
                  </div>

                  {/* System Prompt / Skills display */}
                  <div className="mt-5 p-4 rounded-xl border border-border-base bg-bg-input/20">
                    <span className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                      <FileText size={12} />
                      Instructions
                    </span>
                    <p className="text-xs text-text-base leading-relaxed mt-2 line-clamp-3 font-semibold">
                      {wf.system_prompt}
                    </p>
                  </div>
                </div>

                {/* Footer Controls */}
                <div className="flex justify-between items-center mt-6 pt-4 border-t border-border-base flex-wrap gap-4">
                  {wf.trigger_type === 'rss_batch' ? (
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Batch Size: <span className="font-mono text-text-base text-xs">{wf.batch_size}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      Cron Loop
                    </span>
                  )}

                  <div className="flex gap-2">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTriggerWorkflow(wf.id)}
                      className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-xl bg-accent-primary text-white hover:bg-accent-primary-hover shadow-md cursor-pointer transition active:scale-[0.98]"
                    >
                      <Play size={10} weight="fill" />
                      <span>Execute</span>
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => openEditModal(wf)}
                      className="p-2 rounded-xl bg-bg-input border border-border-base text-text-muted hover:text-text-base hover:bg-white/5 cursor-pointer transition"
                    >
                      <PencilSimple size={14} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleDeleteWorkflow(wf.id, wf.name)}
                      className="p-2 rounded-xl bg-rose-950/10 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 cursor-pointer transition duration-200"
                    >
                      <Trash size={14} />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </motion.div>

      {/* MODAL: Create / Edit Workflow */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={isEditMode ? 'Edit Agent Workflow' : 'Create Agent Workflow'}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition hover:-translate-y-[1px] active:translate-y-[1px]"
            >
              {isEditMode ? 'Save Changes' : 'Create Agent'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Workflow ID</label>
            <input
              type="text"
              value={wfId}
              onChange={e => setWfId(e.target.value)}
              placeholder="e.g. ig-summary-bot"
              className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono mt-1 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
              disabled={isEditMode}
              required
            />
            {!isEditMode && <span className="text-[10px] text-text-muted font-medium">Unique lowercase alphanumeric identifier (no spaces)</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Workflow Name</label>
            <input
              type="text"
              value={wfName}
              onChange={e => setWfName(e.target.value)}
              placeholder="e.g. Instagram Summary Dispatcher"
              className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold mt-1"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Inference Model</label>
            <select
              value={wfAiModel}
              onChange={e => setWfAiModel(e.target.value)}
              className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold cursor-pointer mt-1"
              required
            >
              <option value="google/gemini-2.0-flash">Gemini 2.0 Flash</option>
              <option value="google/gemini-1.5-flash">Gemini 1.5 Flash</option>
              <option value="nvidia/llama-3.1-nemotron-70b-instruct">Llama 3.1 Nemotron 70B</option>
              <option value="@cf/meta/llama-3-8b-instruct">Llama 3 8B (Workers AI)</option>
              <option value="openai/gpt-4o-mini">GPT-4o Mini</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Trigger Trigger</label>
            <select
              value={wfTriggerType}
              onChange={e => setWfTriggerType(e.target.value)}
              className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold cursor-pointer mt-1"
              required
            >
              <option value="rss_batch">RSS Batch (On new items)</option>
              <option value="cron">Cron (Every schedule tick)</option>
              <option value="manual">Manual Only</option>
            </select>
          </div>
        </div>

        {wfTriggerType === 'rss_batch' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Trigger Source Feed</label>
              <select
                value={wfFeedId}
                onChange={e => setWfFeedId(e.target.value)}
                className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold cursor-pointer mt-1"
              >
                <option value="">Any feed</option>
                {feeds.map(f => (
                  <option key={f.id} value={f.id}>{f.title || f.url}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Batch Trigger Size (New Items)</label>
              <input
                type="number"
                min="1"
                max="50"
                value={wfBatchSize}
                onChange={e => setWfBatchSize(Number(e.target.value))}
                className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold mt-1"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1.5 mt-3.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Enabled Agent Capabilities (Tools)</label>
          <div className="flex gap-6 mt-1.5">
            <div className="flex items-center gap-2.5 select-none cursor-pointer">
              <input
                type="checkbox"
                id="toolTelegramForm"
                checked={wfTools.telegram}
                onChange={e => setWfTools(prev => ({ ...prev, telegram: e.target.checked }))}
                className="w-4 h-4 rounded border-border-base bg-bg-input text-accent-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="toolTelegramForm" className="text-xs text-text-base font-semibold cursor-pointer flex items-center gap-1.5">
                <TelegramLogo size={14} />
                Telegram Dispatcher
              </label>
            </div>
            <div className="flex items-center gap-2.5 select-none cursor-pointer">
              <input
                type="checkbox"
                id="toolEmdashForm"
                checked={wfTools.emdash}
                onChange={e => setWfTools(prev => ({ ...prev, emdash: e.target.checked }))}
                className="w-4 h-4 rounded border-border-base bg-bg-input text-accent-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <label htmlFor="toolEmdashForm" className="text-xs text-text-base font-semibold cursor-pointer flex items-center gap-1.5">
                <GlobeSimple size={14} />
                Emdash Blog CMS
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 mt-3.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Agent Instructions (System Prompt)</label>
          <textarea
            value={wfSystemPrompt}
            onChange={e => setWfSystemPrompt(e.target.value)}
            placeholder="Translate new feed items into Arabic, format them, and dispatch them to Telegram."
            className="bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold mt-1 h-32 resize-none leading-relaxed"
            required
          />
        </div>
      </Modal>
    </Modal>
  );
};

export default WorkflowsTab;
