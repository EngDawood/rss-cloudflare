import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../../context/AppContext';

const MCP_TOOLS = [
  { name: 'list_feeds', desc: 'List all saved feeds with their unread item counts.', template: {} },
  { name: 'add_feed', desc: 'Add an RSS/Atom feed URL to the saved list.', template: { url: 'https://', title: '' } },
  { name: 'remove_feed', desc: 'Remove a saved feed and all its stored items.', template: { feedId: '' } },
  { name: 'set_feed_enabled', desc: 'Enable or disable a saved feed from auto-refreshing.', template: { feedId: '', enabled: true } },
  { name: 'refresh_feed', desc: 'Fetch latest items for a saved feed.', template: { feedId: '' } },
  { name: 'refresh_all', desc: 'Refresh all enabled saved feeds.', template: {} },
  { name: 'fetch_rss_feed', desc: 'Ad-hoc: fetch any RSS/Atom URL and return items without storing.', template: { url: 'https://', count: 5 } },
  { name: 'list_new_items', desc: 'List unread items. Can filter by feedId, keyword, or timestamp.', template: { limit: 10 } },
  { name: 'search_items', desc: 'Search all stored items (read + unread) by keyword.', template: { query: '', limit: 10 } },
  { name: 'get_item', desc: 'Get full item by id. Set markRead=true to mark read.', template: { id: '', markRead: false } },
  { name: 'mark_read', desc: 'Mark one or more items as read.', template: { ids: [] } },
  { name: 'mark_unread', desc: 'Mark one or more items as unread.', template: { ids: [] } },
  { name: 'list_chats', desc: 'List all registered Telegram target chats.', template: {} },
  { name: 'add_chat', desc: 'Register a named Telegram chat target.', template: { name: '', chatId: '', type: 'channel', makeDefault: false } },
  { name: 'remove_chat', desc: 'Remove a registered Telegram chat by name.', template: { name: '' } },
  { name: 'set_default_chat', desc: 'Set a registered chat as default target.', template: { name: '' } },
  { name: 'post_to_telegram', desc: 'Send a stored item to a Telegram channel.', template: { id: '', target: '' } },
  { name: 'post_message', desc: 'Send a custom message or post a stored item with overrides.', template: { type: 'text', caption: '', target: '' } },
  { name: 'save_note', desc: 'Save a freeform note or recap in memory.', template: { content: '', tags: [] } },
  { name: 'list_notes', desc: 'List saved memory notes.', template: { limit: 10 } },
  { name: 'search_notes', desc: 'Full-text search over note content.', template: { query: '' } },
  { name: 'delete_note', desc: 'Delete a saved note by id.', template: { id: '' } },
  { name: 'recall', desc: 'Unified chronological timeline of notes and post activity.', template: { limit: 10 } },
  { name: 'list_post_log', desc: 'List post dispatch logs history.', template: { limit: 10 } },
  { name: 'get_config', desc: 'Get global configurations.', template: {} }
];

export const PlaygroundTab: React.FC = () => {
  const { callApi, showToast } = useApp();
  const [selectedTool, setSelectedTool] = useState(MCP_TOOLS[0]);
  const [toolArgs, setToolArgs] = useState(JSON.stringify(MCP_TOOLS[0].template, null, 2));
  const [toolResult, setToolResult] = useState('');
  const [isExecutingTool, setIsExecutingTool] = useState(false);

  const handleSelectTool = (tool: typeof MCP_TOOLS[0]) => {
    setSelectedTool(tool);
    setToolArgs(JSON.stringify(tool.template, null, 2));
    setToolResult('');
  };

  const formatToolJson = () => {
    try {
      const parsed = JSON.parse(toolArgs);
      setToolArgs(JSON.stringify(parsed, null, 2));
      showToast('JSON Formatted!', 'success');
    } catch (e: any) {
      showToast('Invalid JSON structure: ' + e.message, 'error');
    }
  };

  const handleExecuteTool = async () => {
    let argsObj;
    try {
      argsObj = JSON.parse(toolArgs);
    } catch (e: any) {
      setToolResult(`Error parsing arguments JSON: ${e.message}`);
      return;
    }

    setIsExecutingTool(true);
    setToolResult(`Executing tool "${selectedTool.name}"...`);
    const res = await callApi(selectedTool.name, argsObj);
    setIsExecutingTool(false);

    if (res.error) {
      setToolResult(`Execution Failed:\n\n${JSON.stringify(res, null, 2)}`);
    } else {
      setToolResult(JSON.stringify(res.data, null, 2));
    }
  };

  return (
    <motion.div 
      key="playground"
      initial={{ opacity: 0, y: 8 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -8 }}
      className="flex flex-col gap-6"
    >
      <div>
        <h2 className="font-bold text-2xl tracking-tight text-text-base">MCP Playground</h2>
        <p className="text-xs text-text-muted mt-1">Interactively query and inspect the Model Context Protocol tools schema</p>
      </div>

      <div className="liquid-glass p-6 rounded-2xl">
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-8">
          {/* Tools List */}
          <div className="border-r border-border-base pr-6 flex flex-col gap-1 max-h-[600px] overflow-y-auto scrollbar-thin">
            {MCP_TOOLS.map(tool => (
              <motion.button
                key={tool.name}
                whileHover={{ x: 2 }}
                onClick={() => handleSelectTool(tool)}
                className={`w-full text-left font-mono text-xs px-3.5 py-3 rounded-lg transition duration-200 cursor-pointer ${
                  selectedTool.name === tool.name ? 'bg-accent-primary/10 text-accent-primary font-bold border-l-2 border-accent-primary' : 'text-text-muted hover:text-text-base hover:bg-white/5'
                }`}
              >
                {tool.name}
              </motion.button>
            ))}
          </div>

          {/* Schema Exec Panel */}
          <div className="flex flex-col gap-5">
            <div>
              <h3 className="font-mono font-bold text-base text-accent-primary">{selectedTool.name}</h3>
              <p className="text-xs text-text-muted mt-1 max-w-[65ch]">{selectedTool.desc}</p>
            </div>

            <div className="flex flex-col gap-1.5 relative">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Arguments (JSON Object)</label>
              <textarea
                value={toolArgs}
                onChange={e => setToolArgs(e.target.value)}
                className="bg-bg-input border border-border-base rounded-xl p-4 text-xs text-text-base focus:outline-none focus:border-accent-primary font-mono min-h-[140px] mt-1.5"
              />
              <button 
                onClick={formatToolJson}
                className="absolute right-3.5 top-8.5 px-2.5 py-1 text-[10px] font-bold uppercase rounded bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer"
              >
                Format
              </button>
            </div>

            <div>
              <motion.button 
                whileTap={{ scale: 0.98 }}
                onClick={handleExecuteTool}
                disabled={isExecutingTool}
                className="px-6 py-3 text-xs font-bold text-white bg-accent-primary hover:bg-accent-primary-hover transition duration-200 rounded-xl cursor-pointer disabled:opacity-50"
              >
                {isExecutingTool ? 'Calling...' : 'Call Tool'}
              </motion.button>
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Output Result JSON</label>
              <pre className="p-4 rounded-xl border border-border-base bg-bg-input font-mono text-xs text-cyan-500 dark:text-cyan-400 max-h-[350px] overflow-auto whitespace-pre-wrap scrollbar-thin">
                {toolResult || '// Result payload will print here'}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
export default PlaygroundTab;
