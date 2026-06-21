import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';

const MODEL_OPTIONS = [
  { label: 'NVIDIA Llama 70B (Default)', value: 'custom-nvidia-nim/llama-3.1-nemotron-70b-instruct' },
  { label: 'Gemini 2.0 Flash', value: 'google-ai-studio/gemini-2.0-flash' },
  { label: 'Gemini 1.5 Flash', value: 'google-ai-studio/gemini-1.5-flash' },
  { label: 'Groq Llama 70B', value: 'groq/llama-3.3-70b-versatile' },
  { label: 'Groq Llama 8B', value: 'groq/llama-3.1-8b-instant' },
  { label: 'Mistral Large', value: 'mistral/mistral-large-latest' },
  { label: 'Kimi K2.6', value: 'moonshotai/kimi-k2.6' },
  { label: 'Cerebras Llama 70B', value: 'cerebras/llama3.1-70b' },
  { label: 'OpenRouter Llama 70B', value: 'openrouter/meta-llama/llama-3.3-70b-instruct' },
];

export const LogsTab: React.FC = () => {
  const { timeline, postLogs, config, loadLogsAndConfig, callApi, showToast } = useApp();

  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('');

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddNoteOpen(false);
    const tags = noteTags ? noteTags.split(',').map(t => t.trim()) : undefined;
    const res = await callApi('save_note', { content: noteContent, tags });
    if (res.error) showToast(res.error, 'error');
    else { showToast('Note saved in memory bank!', 'success'); loadLogsAndConfig(); }
    setNoteContent('');
    setNoteTags('');
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Delete this memory note?')) return;
    const res = await callApi('delete_note', { id });
    if (res.error) showToast(res.error, 'error');
    else { showToast('Note deleted.', 'success'); loadLogsAndConfig(); }
  };

  const handleToggleGlobalAi = async (current: string) => {
    const next = current === '1' ? '0' : '1';
    const res = await callApi('set_config', { key: 'ai_summary_enabled', value: next });
    if (res.error) showToast(res.error, 'error');
    else { showToast('Global AI Summarizer setting saved.', 'success'); loadLogsAndConfig(); }
  };

  const handleSaveModelConfig = async (model: string) => {
    const res = await callApi('set_config', { key: 'ai_model', value: model });
    if (res.error) showToast(res.error, 'error');
    else { showToast('AI summarization model saved.', 'success'); loadLogsAndConfig(); }
  };

  const handleEditPromptConfig = async () => {
    const val = prompt('Edit system prompt override:', config.aiPrompt || '');
    if (val === null) return;
    const res = await callApi('set_config', { key: 'ai_prompt', value: val.trim() });
    if (res.error) showToast(res.error, 'error');
    else { showToast('System prompt override saved.', 'success'); loadLogsAndConfig(); }
  };

  const formatDate = (unixSecs: number | null | undefined) => {
    if (!unixSecs) return 'Never';
    const date = new Date(unixSecs * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const label = 'font-mono text-[10px] tracking-[0.12em] uppercase text-muted';

  return (
    <div className="h-full rr-scroll px-6 md:px-10 py-8">
      {/* Heading */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-7">
        <div>
          <h2 className="font-display font-semibold text-[32px] text-ink m-0 leading-none">Recall &amp; Logs</h2>
          <p className="font-display italic text-[15px] text-muted mt-1.5">A ledger of what the agent remembered and posted</p>
        </div>
        <button
          onClick={() => setIsAddNoteOpen(true)}
          className="btn-press flex items-center gap-2 px-[18px] py-2.5 rounded-full bg-accent text-onaccent text-[13px] font-semibold cursor-pointer"
        >
          <Plus size={14} weight="bold" /> New note
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-7 items-start pb-4">
        {/* ===== Memory Timeline ===== */}
        <div>
          <div className={`${label} mb-4`}>Memory Timeline</div>
          {timeline.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-line rounded-2xl bg-surface/40 text-sm text-muted">Timeline is empty.</div>
          ) : (
            <div className="relative pl-6">
              <div className="absolute left-[5px] top-1.5 bottom-1.5 w-[1.5px] bg-line-strong" />
              {timeline.map((entry, idx) => {
                const isNote = entry.type === 'note';
                const ok = entry.status === 'ok';
                const dot = isNote ? 'var(--rr-accent)' : ok ? 'var(--rr-ok)' : 'var(--rr-danger)';
                const kind = isNote ? 'Note saved' : ok ? 'Posted' : 'Post failed';
                const tags = isNote && entry.tags ? (() => { try { return JSON.parse(entry.tags); } catch { return []; } })() : [];
                return (
                  <div key={idx} className="relative mb-4">
                    <span className="absolute left-[-23px] top-1.5 w-2.5 h-2.5 rounded-full" style={{ background: dot, boxShadow: '0 0 0 4px var(--rr-bg)' }} />
                    <div className="rr-row p-[15px_17px] rounded-[13px] bg-surface border border-line">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-[9px] uppercase tracking-[0.08em]" style={{ color: dot }}>{kind}</span>
                        <span className="ml-auto font-mono text-[9.5px] text-muted">{formatDate(entry.timestamp)}</span>
                      </div>
                      <div className="font-display text-[15px] text-ink leading-[1.5]">
                        {isNote ? entry.content : `Sent "${entry.caption_preview || entry.message_type}" to ${entry.chat_name || entry.chat_id}`}
                      </div>
                      {(tags.length > 0 || isNote) && (
                        <div className="flex justify-between items-center mt-2.5">
                          <div className="flex gap-1.5 flex-wrap">
                            {tags.map((t: string) => (
                              <span key={t} className="font-mono text-[9px] text-muted bg-bg-base border border-line px-1.5 py-0.5 rounded">#{t}</span>
                            ))}
                          </div>
                          {isNote && (
                            <button onClick={() => handleDeleteNote(entry.id)} className="text-danger hover:opacity-80 font-semibold text-[10px] cursor-pointer">Delete</button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== Right column: dispatch log + config ===== */}
        <div className="flex flex-col gap-7">
          {/* Post Dispatch Log */}
          <div>
            <div className={`${label} mb-4`}>Post Dispatch Log</div>
            <div className="rounded-[14px] border border-line overflow-hidden bg-surface">
              <div className="grid gap-3 px-[17px] py-3 border-b border-line font-mono text-[9px] tracking-[0.1em] uppercase text-muted" style={{ gridTemplateColumns: '16px 1fr 84px 60px' }}>
                <span /><span>Item</span><span>Target</span><span className="text-right">Status</span>
              </div>
              {postLogs.length === 0 ? (
                <div className="px-[17px] py-6 text-center text-xs text-muted">No recent post outcomes recorded.</div>
              ) : postLogs.map((log, idx) => {
                const ok = log.status === 'ok';
                const dot = ok ? 'var(--rr-ok)' : 'var(--rr-danger)';
                return (
                  <div key={idx} className="grid gap-3 px-[17px] py-3.5 items-center border-b border-line last:border-b-0" style={{ gridTemplateColumns: '16px 1fr 84px 60px' }}>
                    <span className="w-[7px] h-[7px] rounded-full" style={{ background: dot }} />
                    <span className="font-display text-[14px] text-ink whitespace-nowrap overflow-hidden text-ellipsis" title={log.caption_preview}>{log.caption_preview || `(${log.message_type})`}</span>
                    <span className="font-mono text-[11px] text-muted truncate">{log.chat_name || log.chat_id}</span>
                    <span className="text-right font-mono text-[10px] font-medium" style={{ color: dot }}>{ok ? 'SENT' : 'FAILED'}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Worker Configurations */}
          <div>
            <div className={`${label} mb-4`}>Worker Configurations</div>
            <div className="rounded-[14px] border border-line bg-surface p-5 flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <span className={label}>Default Telegram Chat Target</span>
                <span className="font-mono text-ink bg-bg-base px-3.5 py-2.5 rounded-xl border border-line">{config.telegramChatId || 'None'}</span>
              </div>

              <div className="flex flex-col gap-2 border-t border-line pt-4">
                <span className={label}>AI Summaries Global Status</span>
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${config.aiSummaryEnabled === '1' ? 'bg-ok-soft text-ok' : 'bg-accent-soft text-accent'}`}>
                    {config.aiSummaryEnabled === '1' ? 'Enabled' : 'Disabled'}
                  </span>
                  <button onClick={() => handleToggleGlobalAi(config.aiSummaryEnabled)} className="btn-press px-3 py-1.5 rounded-full border border-line-strong text-ink bg-bg-base font-semibold text-[10px] cursor-pointer">Toggle</button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 border-t border-line pt-4">
                <span className={label}>Global AI Summarizer Model</span>
                <select
                  value={config.aiModel || 'nvidia/llama-3.1-nemotron-70b-instruct'}
                  onChange={e => handleSaveModelConfig(e.target.value)}
                  className="bg-bg-base border border-line rounded-xl px-3.5 py-2.5 text-ink text-xs focus:outline-none focus:border-accent font-semibold cursor-pointer w-full"
                >
                  {MODEL_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 border-t border-line pt-4">
                <div className="flex justify-between items-center">
                  <span className={label}>Summarizer Prompt Override</span>
                  <button onClick={handleEditPromptConfig} className="text-accent hover:opacity-80 font-semibold text-[10px] cursor-pointer">Edit</button>
                </div>
                <p className="text-ink-soft leading-relaxed p-3.5 rounded-xl border border-line bg-bg-base max-h-[100px] overflow-y-auto font-mono text-[11px]">
                  {config.aiPrompt || 'Using default Arabic news summarizer system instructions.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: Add Memory Note */}
      <Modal
        isOpen={isAddNoteOpen}
        onClose={() => setIsAddNoteOpen(false)}
        title="Add Recall Memory Note"
        footer={
          <>
            <button type="button" onClick={() => setIsAddNoteOpen(false)} className="btn-press px-4 py-2 rounded-full text-xs font-semibold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition">Cancel</button>
            <button type="submit" onClick={handleAddNote} className="btn-press px-4 py-2 rounded-full text-xs font-semibold bg-accent text-onaccent hover:bg-accent-primary-hover cursor-pointer transition">Save Memory</button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className={label}>Note Content</label>
          <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)} placeholder="Type note details here..." className="bg-bg-input border border-border-base rounded-xl p-4 text-sm text-text-base focus:outline-none focus:border-accent-primary min-h-[100px] mt-1" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className={label}>Tags (comma-separated)</label>
          <input type="text" value={noteTags} onChange={e => setNoteTags(e.target.value)} placeholder="e.g. system, config, backup" className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono mt-1" />
        </div>
      </Modal>
    </div>
  );
};
export default LogsTab;
