import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Note } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../common/Modal';

const MODEL_OPTIONS = [
  { label: 'NVIDIA Llama 70B (Default)', value: 'nvidia/llama-3.1-nemotron-70b-instruct' },
  { label: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash' },
  { label: 'Gemini 1.5 Flash', value: 'google/gemini-1.5-flash' },
  { label: 'Groq Llama 70B', value: 'groq/llama-3.3-70b-versatile' },
  { label: 'Groq Llama 8B', value: 'groq/llama-3.1-8b-instant' },
  { label: 'Mistral Large', value: 'mistral/mistral-large-latest' },
  { label: 'Kimi K2.6', value: 'moonshotai/kimi-k2.6' },
  { label: 'Cerebras Llama 70B', value: 'cerebras/llama3.1-70b' },
  { label: 'OpenRouter Llama 70B', value: 'openrouter/meta-llama/llama-3.3-70b-instruct' }
];

export const LogsTab: React.FC = () => {
  const {
    timeline,
    postLogs,
    config,
    loadLogsAndConfig,
    callApi,
    showToast
  } = useApp();

  // Add Note Modal State
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('');

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddNoteOpen(false);
    const tags = noteTags ? noteTags.split(',').map(t => t.trim()) : undefined;
    const res = await callApi('save_note', { content: noteContent, tags });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Note saved in memory bank!', 'success');
      loadLogsAndConfig();
    }
    setNoteContent('');
    setNoteTags('');
  };

  const handleDeleteNote = async (id: string) => {
    if (!confirm('Delete this memory note?')) return;
    const res = await callApi('delete_note', { id });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Note deleted.', 'success');
      loadLogsAndConfig();
    }
  };

  const handleToggleGlobalAi = async (current: string) => {
    const next = current === '1' ? '0' : '1';
    const res = await callApi('set_config', { key: 'ai_summary_enabled', value: next });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Global AI Summarizer setting saved.', 'success');
      loadLogsAndConfig();
    }
  };

  const handleSaveModelConfig = async (model: string) => {
    const res = await callApi('set_config', { key: 'ai_model', value: model });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('AI summarization model saved.', 'success');
      loadLogsAndConfig();
    }
  };

  const handleEditPromptConfig = async () => {
    const val = prompt('Edit system prompt override:', config.aiPrompt || '');
    if (val === null) return;
    const res = await callApi('set_config', { key: 'ai_prompt', value: val.trim() });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('System prompt override saved.', 'success');
      loadLogsAndConfig();
    }
  };

  const formatDate = (unixSecs: number | null | undefined) => {
    if (!unixSecs) return 'Never';
    const date = new Date(unixSecs * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <motion.div 
      key="logs"
      initial={{ opacity: 0, y: 8 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-6"
    >
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-bold text-2xl tracking-tight text-text-base">Recall & Logs</h2>
          <p className="text-xs text-text-muted mt-1">Inspect database activity history, configurations, and memory recall notes</p>
        </div>
        <motion.button 
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsAddNoteOpen(true)}
          className="flex items-center gap-2 px-4.5 py-2.5 text-xs font-bold text-text-base bg-bg-input border border-border-base rounded-xl hover:bg-neutral-850 transition duration-200 cursor-pointer"
        >
          <Note size={14} />
          <span>New Note</span>
        </motion.button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Configurations & Post Logs */}
        <div className="lg:col-span-5 flex flex-col gap-8">
          
          {/* System Settings Block */}
          <div className="liquid-glass p-6 rounded-2xl flex flex-col gap-5">
            <h3 className="font-bold text-sm uppercase tracking-wider text-text-muted">Worker Configurations</h3>
            
            <div className="flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <span className="text-text-muted font-semibold uppercase tracking-wide text-[10px]">Default Telegram Chat Target</span>
                <span className="font-mono text-text-base block bg-bg-input px-3.5 py-2.5 rounded-xl border border-border-base">{config.telegramChatId || 'None'}</span>
              </div>
              
              <div className="flex flex-col gap-1.5 border-t border-border-base pt-4">
                <span className="text-text-muted font-semibold uppercase tracking-wide text-[10px]">AI Summaries Global Status</span>
                <div className="flex items-center justify-between mt-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                    config.aiSummaryEnabled === '1' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                  }`}>{config.aiSummaryEnabled === '1' ? 'Enabled' : 'Disabled'}</span>
                  <motion.button 
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleToggleGlobalAi(config.aiSummaryEnabled)}
                    className="px-2.5 py-1.5 rounded-xl border border-border-base text-text-base hover:text-text-base bg-bg-input font-bold text-[10px] cursor-pointer"
                  >
                    Toggle Status
                  </motion.button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 border-t border-border-base pt-4">
                <span className="text-text-muted font-semibold uppercase tracking-wide text-[10px]">Global AI Summarizer Model</span>
                <select 
                  value={config.aiModel || 'nvidia/llama-3.1-nemotron-70b-instruct'} 
                  onChange={e => handleSaveModelConfig(e.target.value)}
                  className="bg-bg-input border border-border-base rounded-xl px-3.5 py-2.5 text-text-base text-xs focus:outline-none font-semibold cursor-pointer w-full mt-1"
                >
                  {MODEL_OPTIONS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5 border-t border-border-base pt-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-text-muted font-semibold uppercase tracking-wide text-[10px]">Global Summarizer Prompt Override</span>
                  <button onClick={handleEditPromptConfig} className="text-accent-primary hover:text-accent-primary/80 font-bold text-[10px] cursor-pointer">Edit</button>
                </div>
                <p className="text-text-base leading-relaxed p-3.5 rounded-xl border border-border-base bg-bg-input max-h-[100px] overflow-y-auto font-mono text-[11px]">
                  {config.aiPrompt || 'Using default Arabic news summarizer system instructions.'}
                </p>
              </div>
            </div>
          </div>

          {/* Post Logs Outcomes */}
          <div className="liquid-glass p-6 rounded-2xl flex flex-col gap-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-text-muted">Telegram Dispatch Logs</h3>
            
            <div className="flex flex-col gap-4 max-h-[350px] overflow-y-auto pr-1">
              {postLogs.length === 0 ? (
                <span className="text-xs text-text-muted text-center py-4">No recent post outcomes recorded.</span>
              ) : (
                postLogs.map((log, idx) => (
                  <div key={idx} className="text-xs border-b border-border-base pb-4 last:border-b-0 last:pb-0 flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
                        log.status === 'ok' ? 'text-emerald-400' : 'text-rose-400'
                      }`}>{log.status === 'ok' ? 'Success' : 'Failed'}</span>
                      <span className="text-text-muted font-mono">{formatDate(log.posted_at)}</span>
                    </div>
                    <span className="text-text-base font-semibold">Sent to <b className="font-bold">{log.chat_name || log.chat_id}</b> ({log.message_type})</span>
                    <span className="text-text-muted block truncate font-mono text-[11px]">{log.caption_preview}</span>
                    {log.error && <span className="text-rose-400 block mt-1 font-mono text-[11px] bg-rose-500/5 p-2 rounded border border-rose-500/10">{log.error}</span>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Timeline / Recall Notes */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">Unified Recall History</h3>
          
          <div className="pl-6 border-l border-border-base flex flex-col gap-8 relative mt-3 ml-2">
            {timeline.length === 0 ? (
              <span className="text-xs text-text-muted py-4 block">Timeline is empty.</span>
            ) : (
              timeline.map((entry, idx) => (
                <div key={idx} className="relative group">
                  {/* Marker dot */}
                  <span className="absolute -left-[31px] top-1 w-2.5 h-2.5 rounded-full bg-accent-primary border border-bg-base group-hover:bg-accent-primary transition duration-150" />
                  
                  <div className="text-[11px] text-text-muted font-mono">{formatDate(entry.timestamp)}</div>
                  <h4 className="font-bold text-sm text-text-base mt-1 uppercase tracking-wide">
                    {entry.type === 'note' ? 'System Memory Note' : `Dispatched Post to ${entry.chat_name || entry.chat_id}`}
                  </h4>
                  
                  <div className="text-xs mt-2.5 leading-relaxed text-text-base max-w-[65ch]">
                    {entry.type === 'note' ? (
                      <div className="p-4 rounded-xl bg-bg-input/60 border border-border-base">
                        <p className="mb-2.5">{entry.content}</p>
                        <div className="flex justify-between items-center border-t border-border-base pt-2.5">
                          <div className="flex gap-1.5 flex-wrap">
                            {(entry.tags ? JSON.parse(entry.tags) : []).map((t: string) => (
                              <span key={t} className="px-1.5 py-0.5 rounded bg-bg-input border border-border-base text-[9px] text-text-muted font-mono">#{t}</span>
                            ))}
                          </div>
                          <button 
                            onClick={() => handleDeleteNote(entry.id)} 
                            className="text-rose-400 hover:text-rose-350 font-bold text-[10px] cursor-pointer transition"
                          >
                            Delete Note
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-bg-input/20 border border-border-base flex flex-col gap-1">
                        <span>Type: <b className="font-mono">{entry.message_type}</b> | Outcome: <b className={entry.status === 'ok' ? 'text-emerald-400 font-mono' : 'text-rose-400 font-mono'}>{entry.status.toUpperCase()}</b></span>
                        <p className="truncate text-text-muted mt-0.5 font-mono">{entry.caption_preview}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
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
            <button 
              type="button" 
              onClick={() => setIsAddNoteOpen(false)} 
              className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              onClick={handleAddNote}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition"
            >
              Save Memory
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Note Content</label>
          <textarea 
            value={noteContent} 
            onChange={e => setNoteContent(e.target.value)} 
            placeholder="Type note details here..." 
            className="bg-bg-input border border-border-base rounded-xl p-4 text-sm text-text-base focus:outline-none focus:border-accent-primary min-h-[100px] mt-1"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Tags (comma-separated)</label>
          <input 
            type="text" 
            value={noteTags} 
            onChange={e => setNoteTags(e.target.value)} 
            placeholder="e.g. system, config, backup" 
            className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono mt-1"
          />
        </div>
      </Modal>
    </motion.div>
  );
};
export default LogsTab;
