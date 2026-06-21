import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash, Play, ArrowsClockwise, PencilSimple } from '@phosphor-icons/react';
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
  name: '', aiModel: 'google/gemini-2.0-flash', systemPrompt: '', temperature: 0.7, maxTurns: 5,
  enabledTools: ['telegram_send_message'], triggerType: 'manual', batchSize: 1, targetChatId: '', targetChatName: '', feedIds: [],
};

const RUN_COLOR: Record<string, string> = {
  complete: 'var(--rr-ok)', running: '#5F7E92', queued: 'var(--rr-warn)', errored: 'var(--rr-danger)', terminated: 'var(--rr-muted)',
};
const EVENT_COLOR: Record<string, string> = {
  tool_call: '#5F7E92', output: 'var(--rr-ok)', error: 'var(--rr-danger)', triggered: 'var(--rr-accent)',
};

const triggerLabel = (t: string) => t === 'cron' ? 'Schedule' : t === 'rss_batch' ? 'On new items' : 'Manual';
const scheduleLabel = (wf: any) => wf.trigger_type === 'cron' ? 'every 5 min' : wf.trigger_type === 'rss_batch' ? `RSS batch · size ${wf.batch_size ?? 1}` : 'on demand';

export const WorkflowsTab: React.FC = () => {
  const { feeds, callApi, showToast } = useApp();

  const [workflows, setWorkflows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedWfId, setSelectedWfId] = useState<string | null>(null);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState<WorkflowForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const [runs, setRuns] = useState<any[]>([]);
  const [selectedRun, setSelectedRun] = useState<any | null>(null);
  const [runDetail, setRunDetail] = useState<any | null>(null);

  const callApiRef = useRef(callApi);
  useEffect(() => { callApiRef.current = callApi; }, [callApi]);

  const loadWorkflows = useCallback(async () => {
    setLoading(true);
    const res = await callApiRef.current('list_agent_workflows');
    if (!res.error) {
      const list = res.data || [];
      setWorkflows(list);
      setSelectedWfId(prev => prev && list.some((w: any) => w.id === prev) ? prev : (list[0]?.id ?? null));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { loadWorkflows(); }, 0);
    callApiRef.current('list_models').then(r => { if (!r.error) setModels(r.data || []); });
    callApiRef.current('list_chats').then(r => { if (!r.error) setChats(r.data || []); });
    return () => clearTimeout(timer);
  }, [loadWorkflows]);

  const openRunDetail = useCallback(async (run: any) => {
    setSelectedRun(run);
    setRunDetail(null);
    const res = await callApiRef.current('get_workflow_run', { runId: run.id });
    if (!res.error) setRunDetail(res.data);
  }, []);

  const loadRuns = useCallback(async (workflowId: string) => {
    const res = await callApiRef.current('list_workflow_runs', { workflowId });
    const list = res.error ? [] : (res.data || []);
    setRuns(list);
    if (list.length > 0) openRunDetail(list[0]);
    else { setSelectedRun(null); setRunDetail(null); }
  }, [openRunDetail]);

  // Load runs whenever selected workflow changes (loadRuns sets state asynchronously after fetch)
  useEffect(() => {
    if (selectedWfId) loadRuns(selectedWfId);
  }, [selectedWfId, loadRuns]);

  const selectedWf = workflows.find(w => w.id === selectedWfId) || null;

  const openCreate = () => { setForm(EMPTY_FORM); setIsEditorOpen(true); };
  const openEdit = (wf: any) => {
    setForm({
      id: wf.id, name: wf.name, aiModel: wf.ai_model, systemPrompt: wf.system_prompt,
      temperature: wf.temperature ?? 0.7, maxTurns: wf.max_turns ?? 5, enabledTools: wf.enabled_tools || [],
      triggerType: wf.trigger_type || 'manual', batchSize: wf.batch_size ?? 1,
      targetChatId: wf.target_chat_id || '', targetChatName: wf.target_chat_name || '', feedIds: wf.feed_ids || [],
    });
    setIsEditorOpen(true);
  };

  const toggleTool = (key: string) => setForm(f => ({ ...f, enabledTools: f.enabledTools.includes(key) ? f.enabledTools.filter(t => t !== key) : [...f.enabledTools, key] }));
  const toggleFeed = (id: string) => setForm(f => ({ ...f, feedIds: f.feedIds.includes(id) ? f.feedIds.filter(x => x !== id) : [...f.feedIds, id] }));
  const onPickChat = (chatId: string) => { const chat = chats.find(c => c.chat_id === chatId); setForm(f => ({ ...f, targetChatId: chatId, targetChatName: chat?.name || '' })); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.aiModel.trim() || !form.systemPrompt.trim()) { showToast('Name, model, and system prompt are required.', 'error'); return; }
    setSaving(true);
    const action = form.id ? 'update_agent_workflow' : 'create_agent_workflow';
    const res = await callApi(action, {
      id: form.id, name: form.name.trim(), aiModel: form.aiModel.trim(), systemPrompt: form.systemPrompt,
      temperature: Number(form.temperature), maxTurns: Number(form.maxTurns), enabledTools: form.enabledTools,
      triggerType: form.triggerType, batchSize: Number(form.batchSize),
      targetChatId: form.targetChatId || null, targetChatName: form.targetChatName || null, feedIds: form.feedIds,
    });
    setSaving(false);
    if (res.error) showToast(res.error, 'error');
    else { showToast(form.id ? 'Workflow updated.' : 'Workflow created.', 'success'); setIsEditorOpen(false); loadWorkflows(); }
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
    else { showToast(`Run started (${res.data?.itemsCount ?? 0} items).`, 'success'); if (selectedWfId === id) loadRuns(id); }
  };

  const feedTitle = (id: string) => feeds.find(f => f.id === id)?.title || id;
  const fmt = (s?: number) => s ? new Date(s * 1000).toLocaleString() : '';
  const label = 'font-mono text-[9px] tracking-[0.12em] uppercase text-muted';

  return (
    <div className="h-full flex">
      {/* ===== LEFT: workflow list ===== */}
      <div className="w-[330px] xl:w-[380px] flex-none border-r border-line bg-surface flex flex-col min-h-0">
        <div className="px-[22px] pt-6 pb-4 flex-none border-b border-line flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display font-semibold text-[24px] text-ink m-0 leading-tight">Standing Orders</h2>
            <p className="font-display italic text-[13px] text-muted m-0">Agents that watch &amp; act</p>
          </div>
          <div className="flex items-center gap-1.5 flex-none">
            <button onClick={loadWorkflows} title="Refresh" className="btn-press w-8 h-8 rounded-full border border-line-strong bg-bg-base text-ink-soft hover:text-accent flex items-center justify-center cursor-pointer">
              <ArrowsClockwise size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={openCreate} className="btn-press flex items-center gap-1.5 px-3 py-2 rounded-full bg-accent text-onaccent text-xs font-semibold cursor-pointer">
              <Plus size={13} weight="bold" /> New
            </button>
          </div>
        </div>

        <div className="rr-scroll flex-1 min-h-0 px-3 py-3">
          {workflows.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">No workflows yet. Create one to start automating.</div>
          ) : workflows.map(wf => {
            const active = wf.id === selectedWfId;
            return (
              <button
                key={wf.id}
                onClick={() => setSelectedWfId(wf.id)}
                className="btn-press w-full text-left p-4 rounded-xl cursor-pointer mb-1.5 border-l-[3px]"
                style={{ background: active ? 'var(--rr-accent-soft)' : 'transparent', borderLeftColor: active ? 'var(--rr-accent)' : 'transparent' }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-[7px] h-[7px] rounded-full flex-none" style={{ background: wf.enabled ? 'var(--rr-ok)' : 'var(--rr-muted)' }} />
                  <span className="font-display font-semibold text-[16px] text-ink flex-1 min-w-0 leading-tight truncate">{wf.name}</span>
                </div>
                <div className="font-mono text-[10px] text-muted mt-1.5 ml-[17px] truncate">{wf.ai_model}</div>
                <div className="flex flex-wrap gap-1.5 mt-2 ml-[17px]">
                  <span className="text-[9.5px] font-semibold tracking-[0.03em] uppercase text-accent bg-accent-soft px-2 py-0.5 rounded-full">{triggerLabel(wf.trigger_type)}</span>
                  <span className="font-mono text-[9.5px] text-muted px-2 py-0.5 rounded-full border border-line">{(wf.feed_ids || []).length} feeds</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ===== RIGHT: detail ===== */}
      <div className="flex-1 min-w-0 rr-scroll">
        {!selectedWf ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted gap-3 p-12">
            <span className="font-display text-lg font-semibold text-ink">No workflow selected</span>
            <span className="text-xs text-muted">Pick a standing order, or create a new one.</span>
          </div>
        ) : (
          <div className="px-6 md:px-11 py-9 max-w-[780px]">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-2">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-accent mb-2">{triggerLabel(selectedWf.trigger_type)} · {scheduleLabel(selectedWf)}</div>
                <h1 className="font-display font-bold text-[34px] leading-[1.12] tracking-[-0.01em] text-ink m-0">{selectedWf.name}</h1>
              </div>
              <div className="flex items-center gap-2 flex-none">
                <button onClick={() => handleExecute(selectedWf.id)} className="btn-press flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-accent text-onaccent text-xs font-semibold cursor-pointer">
                  <Play size={12} weight="fill" /> Run now
                </button>
                <button onClick={() => openEdit(selectedWf)} title="Edit" className="btn-press w-[38px] h-[38px] rounded-full bg-transparent border-[1.5px] border-line-strong text-ink-soft hover:text-accent flex items-center justify-center cursor-pointer">
                  <PencilSimple size={14} />
                </button>
                <button onClick={() => handleDelete(selectedWf.id, selectedWf.name)} title="Delete" className="btn-press w-[38px] h-[38px] rounded-full bg-transparent border-[1.5px] border-line-strong text-muted hover:text-danger hover:border-danger flex items-center justify-center cursor-pointer">
                  <Trash size={14} />
                </button>
              </div>
            </div>

            {/* Config grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-line border border-line rounded-[14px] overflow-hidden my-6">
              <div className="bg-surface p-4">
                <div className={`${label} mb-2.5`}>Watched feeds</div>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedWf.feed_ids || []).length === 0 ? <span className="text-xs text-muted italic">none</span>
                    : (selectedWf.feed_ids || []).map((id: string) => (
                      <span key={id} className="font-display text-[14px] text-ink bg-bg-base border border-line px-2.5 py-0.5 rounded-full">{feedTitle(id)}</span>
                    ))}
                </div>
              </div>
              <div className="bg-surface p-4">
                <div className={`${label} mb-2.5`}>Tools allowed</div>
                <div className="flex flex-wrap gap-1.5">
                  {(selectedWf.enabled_tools || []).length === 0 ? <span className="text-xs text-muted italic">none</span>
                    : (selectedWf.enabled_tools || []).map((t: string) => (
                      <span key={t} className="font-mono text-[11px] text-accent bg-accent-soft px-2.5 py-1 rounded-full">{t}</span>
                    ))}
                </div>
              </div>
              <div className="bg-surface p-4">
                <div className={`${label} mb-1.5`}>Posts to</div>
                <div className="font-display text-[16px] text-ink">{selectedWf.target_chat_name || selectedWf.target_chat_id || '— saves output'}</div>
              </div>
              <div className="bg-surface p-4">
                <div className={`${label} mb-1.5`}>Model</div>
                <div className="font-mono text-[13px] text-ink break-all">{selectedWf.ai_model}</div>
              </div>
            </div>

            {/* Instructions */}
            <div className={`${label} mb-2.5`}>Instructions</div>
            <div className="font-display italic text-[18px] leading-[1.6] text-ink-soft border-l-[3px] border-accent pl-5 mb-8">
              {selectedWf.system_prompt || 'No instructions set.'}
            </div>

            {/* Run timeline */}
            <div className="flex items-center gap-2.5 mb-4">
              <span className={label}>Latest run</span>
              <span className="flex-1 h-px bg-line" />
              {selectedRun
                ? <span className="font-mono text-[10px]" style={{ color: RUN_COLOR[selectedRun.status] || 'var(--rr-muted)' }}>● {selectedRun.status} · {fmt(selectedRun.started_at)}</span>
                : <span className="font-mono text-[10px] text-muted">no runs yet</span>}
            </div>

            {/* Run picker */}
            {runs.length > 1 && (
              <div className="flex gap-1.5 flex-wrap mb-4">
                {runs.slice(0, 8).map(run => (
                  <button
                    key={run.id}
                    onClick={() => openRunDetail(run)}
                    className="btn-press px-2.5 py-1 rounded-full text-[10px] font-mono cursor-pointer border"
                    style={{
                      borderColor: selectedRun?.id === run.id ? 'var(--rr-accent)' : 'var(--rr-line)',
                      color: selectedRun?.id === run.id ? 'var(--rr-accent)' : 'var(--rr-muted)',
                      background: selectedRun?.id === run.id ? 'var(--rr-accent-soft)' : 'transparent',
                    }}
                  >
                    {fmt(run.started_at)}
                  </button>
                ))}
              </div>
            )}

            {selectedRun && (
              <div className="relative pl-6">
                <div className="absolute left-[5px] top-2 bottom-2 w-[1.5px] bg-line-strong" />
                {!runDetail ? (
                  <div className="text-xs text-muted py-2">Loading timeline…</div>
                ) : (runDetail.events || []).length === 0 ? (
                  <div className="text-xs text-muted py-2">No events recorded yet.</div>
                ) : (runDetail.events || []).map((ev: any) => {
                  const c = EVENT_COLOR[ev.type] || 'var(--rr-accent)';
                  const detail = typeof ev.detail === 'string' ? ev.detail : JSON.stringify(ev.detail);
                  return (
                    <div key={ev.id} className="relative mb-3.5">
                      <span className="absolute left-[-23px] top-1.5 w-2.5 h-2.5 rounded-full" style={{ background: c, boxShadow: '0 0 0 4px var(--rr-bg)' }} />
                      <div className="flex items-baseline gap-2.5 flex-wrap">
                        <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: c }}>{ev.type}</span>
                        <span className="font-display font-semibold text-[16px] text-ink">{ev.step_name || ev.type}</span>
                      </div>
                      {detail && detail !== '{}' && detail !== 'null' && (
                        <pre className="font-mono text-[11px] text-muted mt-1 leading-[1.5] whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{detail}</pre>
                      )}
                    </div>
                  );
                })}
                {runDetail?.run?.error && (
                  <div className="ml-[-24px] mt-2 px-3 py-2 rounded-xl bg-accent-soft text-danger text-[11px] font-mono">{runDetail.run.error}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Editor modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={form.id ? 'Edit Workflow' : 'New Workflow'}
        footer={
          <>
            <button onClick={() => setIsEditorOpen(false)} className="btn-press px-4 py-2 rounded-full text-xs font-semibold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="btn-press px-4 py-2 rounded-full text-xs font-semibold bg-accent text-onaccent hover:bg-accent-primary-hover cursor-pointer transition disabled:opacity-40">{saving ? 'Saving…' : 'Save'}</button>
          </>
        }
      >
        <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto pr-1">
          <Field label="Name"><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Arabic news digest" className={inputClass} /></Field>
          <Field label="Model (free text + suggestions)">
            <input list="wf-models" value={form.aiModel} onChange={e => setForm(f => ({ ...f, aiModel: e.target.value }))} placeholder="provider/model" className={`${inputClass} font-mono`} />
            <datalist id="wf-models">{models.map(m => <option key={m} value={m} />)}</datalist>
          </Field>
          <Field label="System prompt / instructions">
            <textarea value={form.systemPrompt} onChange={e => setForm(f => ({ ...f, systemPrompt: e.target.value }))} rows={4} placeholder="Describe what the agent should do with new items…" className={`${inputClass} resize-y`} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Temperature"><input type="number" step="0.1" min="0" max="2" value={form.temperature} onChange={e => setForm(f => ({ ...f, temperature: parseFloat(e.target.value) }))} className={inputClass} /></Field>
            <Field label="Max turns"><input type="number" min="1" max="20" value={form.maxTurns} onChange={e => setForm(f => ({ ...f, maxTurns: parseInt(e.target.value, 10) }))} className={inputClass} /></Field>
          </div>
          <Field label="Tools">
            <div className="flex flex-col gap-1.5">
              {TOOL_OPTIONS.map(t => (
                <label key={t.key} className="flex items-center gap-2 text-xs text-text-base cursor-pointer">
                  <input type="checkbox" checked={form.enabledTools.includes(t.key)} onChange={() => toggleTool(t.key)} className="accent-accent" /> {t.label}
                </label>
              ))}
            </div>
          </Field>
          <Field label={`Watched feeds (${form.feedIds.length})`}>
            <div className="flex flex-col gap-1 max-h-40 overflow-y-auto border border-border-base rounded-xl p-2 bg-bg-input">
              {feeds.length === 0 && <span className="text-[11px] text-text-muted px-1">No feeds registered.</span>}
              {feeds.map(f => (
                <label key={f.id} className="flex items-center gap-2 text-xs text-text-base cursor-pointer hover:bg-bg-base rounded px-1 py-0.5">
                  <input type="checkbox" checked={form.feedIds.includes(f.id)} onChange={() => toggleFeed(f.id)} className="accent-accent" />
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
            <Field label="Batch size"><input type="number" min="1" max="20" value={form.batchSize} onChange={e => setForm(f => ({ ...f, batchSize: parseInt(e.target.value, 10) }))} className={inputClass} /></Field>
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
    </div>
  );
};

const inputClass = 'bg-bg-input border border-border-base rounded-xl px-3 py-2.5 text-sm text-text-base focus:outline-none focus:border-accent-primary w-full';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="font-mono text-[10px] font-semibold text-muted uppercase tracking-[0.12em]">{label}</label>
    {children}
  </div>
);

export default WorkflowsTab;
