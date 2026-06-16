import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Trash, Cpu, Play, ArrowsClockwise, PencilSimple, X, ListBullets, CheckCircle, Circle, WarningCircle,
} from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';

const TOOL_OPTIONS = [
  { key: 'telegram_send_message', label: 'Telegram — send message' },
  { key: 'emdash_mcp_call', label: 'Emdash CMS — content tools' },
  { key: 'search_items', label: 'Read — search items' },
  { key: 'get_item', label: 'Read — get item' },
];

const TRIGGER_OPTIONS = [
  { value: 'manual', label: 'Manual only' },
  { value: 'rss_batch', label: 'On new feed items (RSS batch)' },
  { value: 'cron', label: 'On schedule (cron, every 5 min)' },
];

interface WorkflowForm {
  id?: string;
  name: string;
  aiModel: string;
  systemPrompt: string;
  temperature: number;
  maxTurns: number;
  enabledTools: string[];
  triggerType: string;
  batchSize: number;
  targetChatId: string;
  targetChatName: string;
  feedIds: string[];
}

const EMPTY_FORM: WorkflowForm = {
  name: '',
  aiModel: 'google/gemini-2.0-flash',
  systemPrompt: '',
  temperature: 0.7,
  maxTurns: 5,
  enabledTools: ['telegram_send_message'],
  triggerType: 'manual',
  batchSize: 1,
  targetChatId: '',
  targetChatName: '',
  feedIds: [],
};

const STATUS_STYLES: Record<string, string> = {
  complete: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  running: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  queued: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  errored: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  terminated: 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
};

export const WorkflowsTab: React.FC = () => {
  const { feeds, callApi, showToast } = useApp();

  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [chats, setChats] = useState<any[]>([]);

  // Editor modal
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState<WorkflowForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Runs viewer
  const [runsForWorkflow, setRunsForWorkflow] = useState<string | null>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [runDetail, setRunDetail] = useState<any | null>(null);

  const springTransition = { type: 'spring', stiffness: 100, damping: 20 } as const;
  const callApiRef = useRef(callApi);
  callApiRef.current = callApi;

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    const res = await callApiRef.current('list_agent_workflows');
    if (!res.error) setWorkflows(res.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadWorkflows();
    callApiRef.current('list_models').then(r => { if (!r.error) setModels(r.data || []); });
    callApiRef.current('list_chats').then(r => { if (!r.error) setChats(r.data || []); });
  }, [loadWorkflows]);

  const openCreate = () => { setForm(EMPTY_FORM); setIsEditorOpen(true); };

  const openEdit = (wf: any) => {
    setForm({
      id: wf.id,
      name: wf.name,
      aiModel: wf.ai_model,
      systemPrompt: wf.system_prompt,
      temperature: wf.temperature ?? 0.7,
      maxTurns: wf.max_turns ?? 5,
      enabledTools: wf.enabled_tools || [],
      triggerType: wf.trigger_type || 'manual',
      batchSize: wf.batch_size ?? 1,
      targetChatId: wf.target_chat_id || '',
      targetChatName: wf.target_chat_name || '',
      feedIds: wf.feed_ids || [],
    });
    setIsEditorOpen(true);
  };

  const toggleTool = (key: string) => {
    setForm(f => ({
      ...f,
      enabledTools: f.enabledTools.includes(key)
        ? f.enabledTools.filter(t => t !== key)
        : [...f.enabledTools, key],
    }));
  };

  const toggleFeed = (id: string) => {
    setForm(f => ({
      ...f,
      feedIds: f.feedIds.includes(id) ? f.feedIds.filter(x => x !== id) : [...f.feedIds, id],
    }));
  };

  const onPickChat = (chatId: string) => {
    const chat = chats.find(c => c.chat_id === chatId);
    setForm(f => ({ ...f, targetChatId: chatId, targetChatName: chat?.name || '' }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.aiModel.trim() || !form.systemPrompt.trim()) {
      showToast('Name, model, and system prompt are required.', 'error');
      return;
    }
    setSaving(true);
    const action = form.id ? 'update_agent_workflow' : 'create_agent_workflow';
    const res = await callApi(action, {
      id: form.id,
      name: form.name.trim(),
      aiModel: form.aiModel.trim(),
      systemPrompt: form.systemPrompt,
      temperature: Number(form.temperature),
      maxTurns: Number(form.maxTurns),
      enabledTools: form.enabledTools,
      triggerType: form.triggerType,
      batchSize: Number(form.batchSize),
      targetChatId: form.targetChatId || null,
      targetChatName: form.targetChatName || null,
      feedIds: form.feedIds,
    });
    setSaving(false);
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(form.id ? 'Workflow updated.' : 'Workflow created.', 'success');
      setIsEditorOpen(false);
      loadWorkflows();
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete workflow "${name}"? Its run history is preserved but it won't trigger again.`)) return;
    const res = await callApi('delete_agent_workflow', { id });
    if (res.error) showToast(res.error, 'error');
    else { showToast('Workflow deleted.', 'success'); loadWorkflows(); }
  };

  const handleExecute = async (id: string) => {
    const res = await callApi('trigger_agent_workflow', { id });
    if (res.error) showToast(res.error, 'error');
    else {
      showToast(`Run started (${res.data?.itemsCount ?? 0} items).`, 'success');
      if (runsForWorkflow === id) loadRuns(id);
    }
  };

  const loadRuns = useCallback(async (workflowId: string) => {
    setRunsLoading(true);
    const res = await callApiRef.current('list_workflow_runs', { workflowId });
    if (!res.error) setRuns(res.data || []);
    setRunsLoading(false);
  }, []);

  const openRuns = (id: string) => {
    setRunsForWorkflow(id);
    setSelectedRun(null);
    setRunDetail(null);
    loadRuns(id);
  };

  const openRunDetail = async (run: any) => {
    setSelectedRun(run);
    setRunDetail(null);
    const res = await callApi('get_workflow_run', { runId: run.id });
    if (!res.error) setRunDetail(res.data);
  };

  return (
    <motion.div
      key="workflows"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-8"
    >
      {/* Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-bold text-2xl tracking-tight text-text-base">Agent Workflows</h2>
          <p className="text-xs text-text-muted mt-1">AI agents that watch feeds, run tools, and post results durably.</p>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={loadWorkflows}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-text-base bg-bg-input border border-border-base rounded-xl hover:bg-neutral-800 transition cursor-pointer"
          >
            <ArrowsClockwise size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={openCreate}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-white bg-accent-primary rounded-xl hover:bg-accent-primary-hover transition shadow-lg shadow-accent-primary/10 cursor-pointer"
          >
            <Plus size={13} />
            New Workflow
          </motion.button>
        </div>
      </div>

      {/* List */}
      {workflows.length === 0 ? (
        <div className="p-10 text-center border border-dashed border-border-base rounded-2xl bg-bg-card/25 text-sm text-text-muted">
          No workflows yet. Create one to start automating.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {workflows.map(wf => (
            <motion.div key={wf.id} whileHover={{ y: -2 }} transition={springTransition} className="liquid-glass p-5 rounded-2xl flex flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Cpu size={18} className="text-accent-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-text-base truncate">{wf.name}</div>
                    <div className="text-[10px] text-text-muted font-mono truncate">{wf.ai_model}</div>
                  </div>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${wf.enabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'}`}>
                  {wf.enabled ? 'On' : 'Off'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-bg-input border border-border-base text-text-muted">{wf.trigger_type}</span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-bg-input border border-border-base text-text-muted">{(wf.feed_ids || []).length} feeds</span>
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-bg-input border border-border-base text-text-muted">{(wf.enabled_tools || []).length} tools</span>
                {wf.target_chat_name && <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">→ {wf.target_chat_name}</span>}
              </div>

              <div className="flex items-center gap-2 mt-1">
                <button onClick={() => handleExecute(wf.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-accent-primary/10 text-accent-primary border border-accent-primary/20 hover:bg-accent-primary/20 transition cursor-pointer">
                  <Play size={12} /> Execute
                </button>
                <button onClick={() => openRuns(wf.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base transition cursor-pointer">
                  <ListBullets size={12} /> Runs
                </button>
                <button onClick={() => openEdit(wf)} className="ml-auto p-1.5 rounded-lg bg-bg-input border border-border-base text-text-muted hover:text-text-base transition cursor-pointer" title="Edit">
                  <PencilSimple size={13} />
                </button>
                <button onClick={() => handleDelete(wf.id, wf.name)} className="p-1.5 rounded-lg bg-rose-950/20 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 transition cursor-pointer" title="Delete">
                  <Trash size={13} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Editor modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={form.id ? 'Edit Workflow' : 'New Workflow'}
        footer={
          <>
            <button onClick={() => setIsEditorOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          <Field label="Name">
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Arabic news digest" className={inputClass} />
          </Field>

          <Field label="Model (free text + suggestions)">
            <input list="wf-models" value={form.aiModel} onChange={e => setForm(f => ({ ...f, aiModel: e.target.value }))} placeholder="provider/model" className={`${inputClass} font-mono`} />
            <datalist id="wf-models">
              {models.map(m => <option key={m} value={m} />)}
            </datalist>
          </Field>

          <Field label="System prompt / instructions">
            <textarea value={form.systemPrompt} onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))} rows={4} placeholder="Describe what the agent should do with new items…" className={`${inputClass} resize-y`} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Temperature">
              <input type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) }))} className={inputClass} />
            </Field>
            <Field label="Max turns">
              <input type="number" min="1" max="20" value={form.maxTurns} onChange={e => setForm(f => ({ ...f, maxTurns: parseInt(e.target.value, 10) }))} className={inputClass} />
            </Field>
          </div>

          <Field label="Tools">
            <div className="flex flex-col gap-1.5">
              {TOOL_OPTIONS.map(t => (
                <label key={t.key} className="flex items-center gap-2 text-xs text-text-base cursor-pointer">
                  <input type="checkbox" checked={form.enabledTools.includes(t.key)} onChange={() => toggleTool(t.key)} className="accent-accent-primary" />
                  {t.label}
                </label>
              ))}
            </div>
          </Field>

          <Field label={`Watched feeds (${form.feedIds.length})`}>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border border-border-base rounded-xl p-2 bg-bg-input">
              {feeds.length === 0 && <span className="text-[11px] text-text-muted px-1">No feeds registered.</span>}
              {feeds.map(f => (
                <label key={f.id} className="flex items-center gap-2 text-xs text-text-base cursor-pointer hover:bg-white/5 rounded px-1 py-0.5">
                  <input type="checkbox" checked={form.feedIds.includes(f.id)} onChange={() => toggleFeed(f.id)} className="accent-accent-primary" />
                  <span className="truncate">{f.title || f.url}</span>
                </label>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Trigger">
              <select value={form.triggerType} onChange={e => setForm(f => ({ ...f, triggerType: e.target.value }))} className={inputClass}>
                {TRIGGER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Batch size">
              <input type="number" min="1" max="20" value={form.batchSize} onChange={e => setForm(f => ({ ...f, batchSize: parseInt(e.target.value, 10) }))} className={inputClass} />
            </Field>
          </div>

          <Field label="Target Telegram chat">
            <select value={form.targetChatId} onChange={e => onPickChat(e.target.value)} className={inputClass}>
              <option value="">— None / use raw id below —</option>
              {chats.map(c => <option key={c.chat_id} value={c.chat_id}>{c.name} ({c.chat_id})</option>)}
            </select>
            <input value={form.targetChatId} onChange={e => setForm(f => ({ ...f, targetChatId: e.target.value }))} placeholder="Or paste a raw chat id (e.g. -1001234567890)" className={`${inputClass} font-mono mt-2`} />
          </Field>
        </div>
      </Modal>

      {/* Runs viewer modal */}
      <Modal
        isOpen={runsForWorkflow !== null}
        onClose={() => setRunsForWorkflow(null)}
        title="Workflow Runs"
        footer={<button onClick={() => setRunsForWorkflow(null)} className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition">Close</button>}
      >
        <div className="flex flex-col gap-3 max-h-[60vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{runs.length} runs</span>
            <button onClick={() => runsForWorkflow && loadRuns(runsForWorkflow)} className="flex items-center gap-1.5 text-[11px] font-bold text-text-muted hover:text-text-base cursor-pointer">
              <ArrowsClockwise size={12} className={runsLoading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>

          {!selectedRun ? (
            runs.length === 0 ? (
              <div className="p-6 text-center text-xs text-text-muted">No runs yet. Click Execute to start one.</div>
            ) : (
              <ul className="flex flex-col gap-2">
                {runs.map(run => (
                  <li key={run.id}>
                    <button onClick={() => openRunDetail(run)} className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-bg-input border border-border-base hover:bg-white/5 transition cursor-pointer text-left">
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-mono text-text-base truncate">{run.id}</span>
                        <span className="text-[10px] text-text-muted">{run.trigger} · {run.items_count} items · {new Date(run.started_at * 1000).toLocaleString()}</span>
                      </div>
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border flex-shrink-0 ${STATUS_STYLES[run.status] || STATUS_STYLES.terminated}`}>{run.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : (
            <div className="flex flex-col gap-3">
              <button onClick={() => { setSelectedRun(null); setRunDetail(null); }} className="self-start flex items-center gap-1 text-[11px] font-bold text-accent-primary cursor-pointer">
                <X size={12} /> Back to runs
              </button>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-text-muted truncate">{selectedRun.id}</span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border ${STATUS_STYLES[selectedRun.status] || STATUS_STYLES.terminated}`}>{selectedRun.status}</span>
              </div>

              {!runDetail ? (
                <div className="p-4 text-center text-xs text-text-muted">Loading timeline…</div>
              ) : (
                <ol className="flex flex-col gap-2">
                  {(runDetail.events || []).map((ev: any) => (
                    <li key={ev.id} className="flex gap-2.5 px-3 py-2 rounded-xl bg-bg-input border border-border-base">
                      <EventIcon type={ev.type} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold text-text-base">{ev.step_name || ev.type}</div>
                        <pre className="text-[10px] text-text-muted whitespace-pre-wrap break-words mt-1 max-h-40 overflow-y-auto">{JSON.stringify(ev.detail, null, 2)}</pre>
                      </div>
                    </li>
                  ))}
                  {(runDetail.events || []).length === 0 && <li className="text-xs text-text-muted px-3 py-2">No events recorded yet.</li>}
                  {runDetail.run?.error && (
                    <li className="px-3 py-2 rounded-xl bg-rose-950/20 border border-rose-900/30 text-[11px] text-rose-400">{runDetail.run.error}</li>
                  )}
                </ol>
              )}
            </div>
          )}
        </div>
      </Modal>
    </motion.div>
  );
};

const inputClass = 'bg-bg-input border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-base focus:outline-none focus:border-accent-primary w-full';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">{label}</label>
    {children}
  </div>
);

const EventIcon: React.FC<{ type: string }> = ({ type }) => {
  if (type === 'tool_call') return <Circle size={14} weight="fill" className="text-sky-400 mt-0.5 flex-shrink-0" />;
  if (type === 'output') return <CheckCircle size={14} weight="fill" className="text-emerald-400 mt-0.5 flex-shrink-0" />;
  if (type === 'error') return <WarningCircle size={14} weight="fill" className="text-rose-400 mt-0.5 flex-shrink-0" />;
  return <Cpu size={14} className="text-accent-primary mt-0.5 flex-shrink-0" />;
};

export default WorkflowsTab;
