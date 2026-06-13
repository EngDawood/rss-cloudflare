import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { PaperPlaneTilt } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';

export const SandboxTab: React.FC = () => {
  const { chats, callApi, showToast } = useApp();

  const [sandboxTarget, setSandboxTarget] = useState('');
  const [sandboxType, setSandboxType] = useState('text');
  const [sandboxCaption, setSandboxCaption] = useState('');
  const [sandboxMediaUrl, setSandboxMediaUrl] = useState('');
  const [sandboxAlbumJson, setSandboxAlbumJson] = useState('');

  const handlePostSandbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxTarget) {
      showToast('Please select a Telegram target.', 'warning');
      return;
    }

    const params: any = { target: sandboxTarget, type: sandboxType, caption: sandboxCaption };
    if (sandboxType !== 'text' && sandboxType !== 'album') {
      params.mediaUrl = sandboxMediaUrl;
    } else if (sandboxType === 'album') {
      try {
        params.media = JSON.parse(sandboxAlbumJson);
      } catch {
        showToast('Invalid album media JSON structure.', 'error');
        return;
      }
    }

    showToast('Sending sandbox message payload...', 'info');
    const res = await callApi('post_message', params);
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Sandbox post dispatched successfully!', 'success');
      setSandboxCaption('');
      setSandboxMediaUrl('');
      setSandboxAlbumJson('');
    }
  };

  return (
    <motion.div 
      key="sandbox"
      initial={{ opacity: 0, y: 8 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="font-bold text-2xl tracking-tight text-text-base">Post Sandbox</h2>
        <p className="text-xs text-text-muted mt-1">Manually dispatch customized media payloads to Telegram targets</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form */}
        <div className="lg:col-span-7 liquid-glass p-8 rounded-2xl">
          <form onSubmit={handlePostSandbox} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Telegram Destination</label>
              <select 
                value={sandboxTarget} 
                onChange={e => setSandboxTarget(e.target.value)}
                className="bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold cursor-pointer w-full mt-1.5"
                required
              >
                <option value="">-- Choose Target --</option>
                {chats.map(c => (
                  <option key={c.name} value={c.name}>{c.name} ({c.chat_id}){c.is_default === 1 ? ' [DEFAULT]' : ''}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Content Type</label>
              <select 
                value={sandboxType} 
                onChange={e => setSandboxType(e.target.value)}
                className="bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold cursor-pointer w-full mt-1.5"
                required
              >
                <option value="text">Plain Text Message</option>
                <option value="photo">Photo Post</option>
                <option value="video">Video Post</option>
                <option value="audio">Audio Track</option>
                <option value="album">Media Album (Multiple Items)</option>
              </select>
            </div>

            {(sandboxType === 'photo' || sandboxType === 'video' || sandboxType === 'audio') && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Media Direct URL</label>
                <input 
                  type="url" 
                  value={sandboxMediaUrl} 
                  onChange={e => setSandboxMediaUrl(e.target.value)}
                  placeholder="https://example.com/asset.mp4"
                  className="bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono mt-1.5"
                  required
                />
              </div>
            )}

            {sandboxType === 'album' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Album configuration JSON (Array of objects)</label>
                <textarea 
                  value={sandboxAlbumJson} 
                  onChange={e => setSandboxAlbumJson(e.target.value)}
                  placeholder='[&#10;  {"type": "photo", "url": "https://example.com/pic1.jpg"},&#10;  {"type": "video", "url": "https://example.com/vid1.mp4"}&#10;]'
                  className="bg-bg-input border border-border-base rounded-xl p-4 text-xs text-text-base focus:outline-none focus:border-accent-primary font-mono min-h-[120px] mt-1.5"
                  required
                />
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Message Content / Caption (Supports HTML markup)</label>
              <textarea 
                value={sandboxCaption} 
                onChange={e => setSandboxCaption(e.target.value)}
                placeholder="Write message copy here..."
                className="bg-bg-input border border-border-base rounded-xl p-4 text-sm text-text-base focus:outline-none focus:border-accent-primary min-h-[140px] mt-1.5"
                required
              />
            </div>

            <motion.button 
              whileTap={{ scale: 0.98 }}
              type="submit"
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold bg-accent-primary hover:bg-accent-primary-hover text-white transition duration-200 mt-2 cursor-pointer w-full"
            >
              <PaperPlaneTilt size={16} />
              <span>Dispatch Payload</span>
            </motion.button>
          </form>
        </div>

        {/* Right Column: Visual Preview */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted">Live Send Preview</h3>
          
          <div className="liquid-glass rounded-2xl overflow-hidden shadow-2xl flex flex-col min-h-[300px]">
            {/* Telegram UI Mock Header */}
            <div className="bg-bg-card/40 p-4 border-b border-border-base flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center text-xs font-bold text-white uppercase">
                {sandboxTarget ? sandboxTarget.slice(0, 2) : 'T'}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-text-base">{sandboxTarget || 'Target Chat'}</span>
                <span className="text-[9px] text-text-muted font-mono">Channel Feed</span>
              </div>
            </div>

            {/* Mock Media Preview Area */}
            {sandboxType !== 'text' && (
              <div className="bg-bg-input h-44 flex items-center justify-center border-b border-border-base relative overflow-hidden">
                {sandboxMediaUrl ? (
                  <img src={sandboxMediaUrl} alt="Preview payload" className="w-full h-full object-cover opacity-60" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <span className="text-xs text-text-muted/40 font-mono">[ Media Preview Placeholder ]</span>
                )}
                <span className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 bg-bg-input border border-border-base rounded uppercase tracking-wide text-accent-primary">
                  {sandboxType}
                </span>
              </div>
            )}

            {/* Caption Preview Area */}
            <div className="p-5 flex-grow flex flex-col justify-between">
              <div className="text-xs text-text-base whitespace-pre-wrap font-sans max-w-[65ch]">
                {sandboxCaption ? (
                  <div dangerouslySetInnerHTML={{ __html: sandboxCaption }} />
                ) : (
                  <span className="text-text-muted italic">Configure input values to view dynamic live preview outcomes...</span>
                )}
              </div>
              <div className="text-[10px] text-text-muted text-right mt-6 font-mono">
                12:00 PM
              </div>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
};
export default SandboxTab;
