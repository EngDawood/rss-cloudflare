1 to 400
# Block 2: 401 to 800
# Block 3: 801 to 1200
# Block 4: 1201 to 1561
# Let's read the full transcript_full.jsonl as text and extract all lines matching `<number>: <content>` 
# inside the view_file output.

with open(log_path, 'r', encoding='utf-8') as f:
    log_content = f.read()

# We look for all occurrences of lines inside the formatted outputs
# In the format: `
<line_number>: <original_line>
`
# We will collect all line numbers and their corresponding content.
matches = re.findall(r'(\d+): (.*?)(?=\
\d+:|\\
Color Calibration**\r
* **Constraint:** Max 1 Accent Color. Saturation < 80%.\r
* **THE LILA BAN:** The \
Layout Diversification**\r
* **ANTI-CENTER BIAS:** Centered Hero/H1 sections are strictly BANNED when `LAYOUT_VARIANCE > 4`. Force \
  Clock, Terminal, ChatCircleText, Copy, Plus, 
Interactive UI States**\r
* **Mandatory Generation:** LLMs naturally generate \
Data & Form Patterns**\r
* **Forms:** Label MUST sit above input. Helper text is optional but should exist in markup. Error text below input. Use a standard `gap-2` for input blocks.\r
\r
## 4. CREATIVE PROACTIVITY (Anti-Slop Implementation)\r
To actively combat generic AI designs, systematically implement these high-end coding concepts as your baseline:\r
* **\
import { checkAllFeeds } from './cron/check-feeds';
import { refreshSavedFeeds } from './cron/refresh-feeds';
import { motion, AnimatePresence } from 'framer-motion';
import { RSSReaderMCP } from './mcp/index';
// Predefined model options matching the bot commands
import { MessageBatch } from '@cloudflare/workers-types';
  { label: 'NVIDIA Llama 70B (Default)', value: 'nvidia/llama-3.1-nemotron-70b-instruct' },
  { label: 'Gemini 2.0 Flash', value: 'google/gemini-2.0-flash' },
  { label: 'Gemini 1.5 Flash', value: 'google/gemini-1.5-flash' },
  { label: 'Groq Llama 70B', value: 'groq/llama-3.3-70b-versatile' },
  { label: 'Groq Llama 8B', value: 'groq/llama-3.1-8b-instant' },
  { label: 'Mistral Large', value: 'mistral/mistral-large-latest' },
app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));
    \
app.get('/instagram', handleInstagramFeed);
app.get('/test-bridges', handleTestBridges);
  { name: 'list_feeds', desc: 'List all saved feeds with their unread item counts.', template: {} },
  { name: 'add_feed', desc: 'Add an RSS/Atom feed URL to the saved list.', template: { url: 'https://', title: '' } },
  { name: 'remove_feed', desc: 'Remove a saved feed and all its stored items.', template: { feedId: '' } },
  { name: 'set_feed_enabled', desc: 'Enable or disable a saved feed from auto-refreshing.', template: { feedId: '', enabled: true } },
  { name: 'refresh_feed', desc: 'Fetch latest items for a saved feed.', template: { feedId: '' } },
	// KV namespace for caching (create with: npx wrangler kv namespace create CACHE)
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
				hashtag: '/instagram?h=hashtag',
				location: '/instagram?l=location_id',
				params: 'media_type=all|video|picture|multiple, direct_links=true|false',
				mcp: '/mcp',
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
		404
			\
export default function App() {
  const [activeTab, setActiveTab] = useState('feeds');
  const [token, setToken] = useState(() => localStorage.getItem('rss_mcp_auth_token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
	return c.json({ error: 'Internal Server Error' }, 500);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tempToken, setTempToken] = useState('');
export { RSSReaderMCP };
  // Skeletons / Loading states
  const [isLoading, setIsLoading] = useState(true);
	fetch: app.fetch,
	scheduled: async (event: ScheduledEvent, env: Env, ctx: ExecutionContext) => {
  const [feeds, setFeeds] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [unreadItems, setUnreadItems] = useState<any[]>([]);
	queue: async (batch: MessageBatch<QueueTask>, env: Env): Promise<void> => {
  const [postLogs, setPostLogs] = useState<any[]>([]);
  const [config, setConfigState] = useState<any>({});
			\
  // Modals & Inputs
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [addFeedUrl, setAddFeedUrl] = useState('');
  const [addFeedTitle, setAddFeedTitle] = useState('');
  
  const [testFeedUrl, setTestFeedUrl] = useState('');
  const [testFeedItems, setTestFeedItems] = useState<any[]>([]);
  const [isTestingFeed, setIsTestingFeed] = useState(false);
	},
  const readerFeedFilter = '';
  const [readerSearch, setReaderSearch] = useState('');
			{
  const [isAddChatOpen, setIsAddChatOpen] = useState(false);
  const [chatName, setChatName] = useState('');
  const [chatIdVal, setChatIdVal] = useState('');
  const [chatType, setChatType] = useState('channel');
  const [chatDefault, setChatDefault] = useState(false);
				\
  const [sandboxTarget, setSandboxTarget] = useState('');
  const [sandboxType, setSandboxType] = useState('text');
  const [sandboxCaption, setSandboxCaption] = useState('');
  const [sandboxMediaUrl, setSandboxMediaUrl] = useState('');
  const [sandboxAlbumJson, setSandboxAlbumJson] = useState('');
				\
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('');
				\
  // Playground state
  const [selectedTool, setSelectedTool] = useState(MCP_TOOLS[0]);
  const [toolArgs, setToolArgs] = useState(JSON.stringify(MCP_TOOLS[0].template, null, 2));
  const [toolResult, setToolResult] = useState('');
  const [isExecutingTool, setIsExecutingTool] = useState(false);
	// - IG_DS_USER_ID
	// - TELEGRAM_BOT_TOKEN
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; toolsCalled?: string[] }>>([
    { role: 'assistant', content: 'Hi there! I am your RSS & MCP Agent. You can ask me to list your feeds, check for unread articles, search for posts, or save notes. How can I help you today?' }
	// - MCP_AUTH_TOKEN       (overrides the empty var above for production auth)
	// - AI_GATEWAY_TOKEN     (required: Cloudflare AI Gateway authenticated token)
  const [isChatting, setIsChatting] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Toast emitter
  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  // Base API caller
  const callApi = async (action: string, params: any = {}) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const response = await fetch('/api/action', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, params })
      });

      if (response.status === 401) {
        setIsAuthenticated(false);
        showToast('Unauthorized: Please set a valid access token.', 'error');
        setIsTokenModalOpen(true);
        return { error: 'Unauthorized', status: 401 };
      }

      const resData = await response.json();
      if (!response.ok) return { error: resData.error || 'Server error', status: response.status };
      return resData;
    } catch (err: any) {
      return { error: err.message || 'Network fetch failed' };
    }
  };

  const verifyToken = async () => {
    setIsLoading(true);
    const res = await callApi('get_config');
    if (res.error) {
      setIsAuthenticated(false);
    } else {
      setIsAuthenticated(true);
      setConfigState(res.data);
      if (activeTab === 'feeds') loadFeeds();
    }
    setIsLoading(false);
  };

  const handleSaveToken = () => {
    localStorage.setItem('rss_mcp_auth_token', tempToken.trim());
    setToken(tempToken.trim());
    setIsTokenModalOpen(false);
    showToast('Access token updated!', 'success');
  };

  useEffect(() => {
    verifyToken();
  }, [token]);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatting]);

  // Tab activation triggers
  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'feeds') loadFeeds();
      else if (activeTab === 'reader') loadReaderItems();
      else if (activeTab === 'telegram') loadChats();
      else if (activeTab === 'sandbox') loadSandboxOptions();
      else if (activeTab === 'logs') loadLogsAndConfig();
    }
  }, [activeTab, isAuthenticated]);

  // ── Feeds Tab ─────────────────────────────────────────────────────────────
  const loadFeeds = async () => {
    setIsLoading(true);
    const res = await callApi('list_feeds');
    if (!res.error) setFeeds(res.data || []);
    setIsLoading(false);
  };

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddFeedOpen(false);
    showToast('Registering feed and importing articles...', 'info');
    const res = await callApi('add_feed', { url: addFeedUrl, title: addFeedTitle });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Feed successfully added! Imported ${res.data.itemsInserted || 0} items.`, 'success');
      loadFeeds();
    }
    setAddFeedUrl('');
    setAddFeedTitle('');
  };

  const handleToggleFeed = async (feedId: string, currentStatus: number) => {
    const res = await callApi('set_feed_enabled', { feedId, enabled: currentStatus !== 1 });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Feed status updated.', 'success');
      loadFeeds();
    }
  };

  const handleRefreshFeed = async (feedId: string) => {
    showToast('Refreshing feed items...', 'info');
    const res = await callApi('refresh_feed', { feedId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Refreshed! Found ${res.data.itemsFetched || 0} items (${res.data.itemsInserted || 0} new).`, 'success');
      loadFeeds();
    }
  };

  const handleRefreshAllFeeds = async () => {
    showToast('Syncing all enabled feeds in the background...', 'info');
    const res = await callApi('refresh_all');
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Successfully synced ${res.data.refreshed || 0} feeds.`, 'success');
      loadFeeds();
    }
  };

  const handleRemoveFeed = async (feedId: string) => {
    if (!confirm('Are you sure you want to delete this feed and purge all stored unread items?')) return;
    const res = await callApi('remove_feed', { feedId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Feed deleted successfully.', 'success');
      loadFeeds();
    }
  };

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
      showToast(`Successfully parsed feed: \
    }
  };

  // ── Reader Tab ────────────────────────────────────────────────────────────
  const loadReaderItems = async () => {
    setIsLoading(true);
    let res;
    if (readerSearch.trim()) {
      res = await callApi('search_items', { query: readerSearch, feedId: readerFeedFilter || undefined, unreadOnly: true, limit: 30 });
    } else {
      res = await callApi('list_new_items', { feedId: readerFeedFilter || undefined, limit: 30 });
    }
    if (!res.error) setUnreadItems(res.data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isAuthenticated && activeTab === 'reader') {
      const delayDebounce = setTimeout(() => {
        loadReaderItems();
      }, 300);
      return () => clearTimeout(delayDebounce);
    }
  }, [readerSearch, readerFeedFilter]);

  const handleMarkRead = async (id: string) => {
    const res = await callApi('mark_read', { ids: [id] });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      setUnreadItems(prev => prev.filter(item => item.id !== id));
    }
  };

  const handleBulkMarkRead = async () => {
    const ids = unreadItems.map(i => i.id);
    if (ids.length === 0) return;
    if (!confirm(`Mark all ${ids.length} visible items as read?`)) return;

    showToast('Marking all read...', 'info');
    const res = await callApi('mark_read', { ids });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Marked ${ids.length} items as read.`, 'success');
      loadReaderItems();
    }
  };

  const handleTriggerAiSummary = async (itemId: string) => {
    showToast('Requesting AI summary from Gateway...', 'info');
    const res = await callApi('summarize_item', { itemId });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Arabic summary compiled and saved!', 'success');
      loadReaderItems();
    }
  };

  const handlePostToTelegram = async (id: string) => {
    const target = prompt('Enter a registered chat name / numeric ID (leave blank to send to Default chat):', '');
    if (target === null) return;
    showToast('Enriching item media and posting to Telegram...', 'info');
    const res = await callApi('post_to_telegram', { id, target: target || undefined });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast(`Posted successfully to ${res.data.chatName || res.data.chatId}!`, 'success');
    }
  };

  // ── Telegram Tab ──────────────────────────────────────────────────────────
  const loadChats = async () => {
    setIsLoading(true);
    const res = await callApi('list_chats');
    if (!res.error) setChats(res.data || []);
    setIsLoading(false);
  };

  const handleAddChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddChatOpen(false);
    const res = await callApi('add_chat', { name: chatName, chatId: chatIdVal, type: chatType, makeDefault: chatDefault });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Chat target registered!', 'success');
      loadChats();
    }
    setChatName('');
    setChatIdVal('');
    setChatType('channel');
    setChatDefault(false);
  };

  const handleSetDefaultChat = async (name: string) => {
    const res = await callApi('set_default_chat', { name });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Default target updated.', 'success');
      loadChats();
    }
  };

  const handleRemoveChat = async (name: string) => {
    if (!confirm(`Remove chat target \
    const res = await callApi('remove_chat', { name });
    if (res.error) {
      showToast(res.error, 'error');
    } else {
      showToast('Chat target removed.', 'success');
      loadChats();
    }
  };

  // ── Sandbox Tab ───────────────────────────────────────────────────────────
  const loadSandboxOptions = async () => {
    const res = await callApi('list_chats');
    if (!res.error) setChats(res.data || []);
  };

  const handlePostSandbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sandboxTarget) {
      showToast('Please select a Telegram target.', 'warning');
      return;
    }

    let params: any = { target: sandboxTarget, type: sandboxType, caption: sandboxCaption };
    if (sandboxType !== 'text' && sandboxType !== 'album') {
      params.mediaUrl = sandboxMediaUrl;
    } else if (sandboxType === 'album') {
      try {
        params.media = JSON.parse(sandboxAlbumJson);
      } catch (err) {
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

  // ── Recall & Logs Tab ─────────────────────────────────────────────────────
  const loadLogsAndConfig = async () => {
    setIsLoading(true);
    const [recallRes, logsRes, configRes] = await Promise.all([
      callApi('recall', { limit: 20 }),
      callApi('list_post_log', { limit: 20 }),
      callApi('get_config')
    ]);

    if (!recallRes.error) setTimeline(recallRes.data || []);
    if (!logsRes.error) setPostLogs(logsRes.data || []);
    if (!configRes.error) setConfigState(configRes.data || {});
    setIsLoading(false);
  };

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

  // ── MCP Playground Tab ────────────────────────────────────────────────────
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
    setToolResult(`Executing tool \
    const res = await callApi(selectedTool.name, argsObj);
    setIsExecutingTool(false);

    if (res.error) {
      setToolResult(`Execution Failed:\n\n${JSON.stringify(res, null, 2)}`);
    } else {
      setToolResult(JSON.stringify(res.data, null, 2));
    }
  };

  // ── Agent Chat Tab ────────────────────────────────────────────────────────
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    
    // Add user message to state
    const updatedMessages = [...chatMessages, { role: 'user' as const, content: userMsg }];
    setChatMessages(updatedMessages);
    setIsChatting(true);
  const handleSendChatMessage = async (e: React.FormEvent) => {
    // Call API chat endpoint
    if (!chatInput.trim() || isChatting) return;
      const response = await fetch('/api/chat', {
    const userMsg = chatInput.trim();
    setChatInput('');
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    const updatedMessages = [...chatMessages, { role: 'user' as const, content: userMsg }];
    setChatMessages(updatedMessages);
          messages: updatedMessages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
            role: m.role,
            content: m.content
          }))
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        showToast('Unauthorized: Set your access token to chat.', 'error');
        setIsTokenModalOpen(true);
        body: JSON.stringify({
          messages: updatedMessages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
            role: m.role,
            content: m.content
      const resData = await response.json();
      if (!response.ok) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${resData.error || 'Connection failed'}` }]);
      } else {
        const { response: replyText, toolsCalled } = resData.data;
        showToast('Unauthorized: Se  const selectedItem = unreadItems.find(item => item.id === selectedItemId) || null;
          role: 'assistant',
          content: replyText,
          toolsCalled: toolsCalled && toolsCalled.length > 0 ? toolsCalled : undefined
      {/* Toast Notifications */}
      <div className=\
        <AnimatePresence>
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Network error: ${err.message || String(err)}` }]);
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl text-sm min-w-[300px] max-w-[400px] shadow-2xl backdrop-blur-md border border-white/10 ${
                toast.type === 'success' ? 'bg-amber-950/90 text-amber-300 border-amber-500/30' :
                toast.type === 'error' ? 'bg-red-950/90 text-red-300 border-red-500/30' :
                toast.type === 'warning' ? 'bg-amber-950/90 text-amber-300 border-amber-500/30' :
                'bg-neutral-900/95 text-neutral-100'
      <div className=\
        <AnimatePresence>
              <span>{toast.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className=\
              key={toast.id}
              initial={{ opacity: 0, x: 50, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl text-sm min-w-[300px] max-w-[400px] shadow-2xl backdrop-blur-md border border-white/10 ${
                toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30' :
                toast.type === 'error' ? 'bg-red-950/90 text-red-300 border-red-500/30' :
                toast.type === 'warning' ? 'bg-amber-950/90 text-amber-300 border-amber-500/30' :
                'bg-slate-900/95 text-slate-100'
              }`}
            <h1 className=\
              <span>{toast.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className=\
            </motion.div>
          ))}
        </AnimatePresence>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            isAuthenticated === true ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            isAuthenticated === false ? 'bg-red-500/10 text-red-400 border-red-500/20' :
            'bg-neutral-900 text-neutral-500 border-white/5'
        <div className=\
          <div className=\
          <div>
            <h1 className=\
            <span className=\
          </div>
        </div>

        <div className=\
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
            isAuthenticated === true ? 'bg-emerald-950/30 text-emerald-400 border-emerald-500/20' :
            isAuthenticated === false ? 'bg-red-950/30 text-red-400 border-red-500/20' :
            'bg-slate-900/40 text-slate-500 border-white/5'
          }`}>
            {isAuthenticated === true ? <ShieldCheck size={14} /> : <ShieldWarning size={14} />}
            <span>{isAuthenticated === true ? 'Authenticated' : isAuthenticated === false ? 'No Access' : 'Connecting'}</span>
          </div>
          <button 
            onClick={() => { setTempToken(token); setIsTokenModalOpen(true); }}
            className=\
          >
            <Gear size={14} />
            <span>Setup Token</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <div className=\
        {/* Navigation Sidebar */}
        <aside className=\
          <ul className=\
            {[
              { id: 'feeds', label: 'RSS Feeds', icon: Rss },
              { id: 'reader', label: 'Feed Reader', icon: BookOpen },
              { id: 'telegram', label: 'Telegram Targets', icon: TelegramLogo },
              { id: 'sandbox', label: 'Post Sandbox', icon: PaperPlaneTilt },
              { id: 'logs', label: 'Recall & Logs', icon: Clock },
              { id: 'playground', label: 'MCP Playground', icon: Terminal },
              { id: 'chat', label: 'Agent Chat', icon: ChatCircleText }
            ].map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      active ? 'bg-indigo-600/15 text-indigo-400 font-semibold border-l-3 border-indigo-500 rounded-l-none' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>

        {/* Content Panel */}
        <main className=\
          
          {/* SKELETON LOADER */}
          {isLoading && (
            <div className=\
              <div className=\
              <div className=\
                <div className=\
                <div className=\
                <div className=\
              </div>
            </div>
          )}

          {/* TAB: RSS FEEDS */}
          {!isLoading && activeTab === 'feeds' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className=\
              <div className=\
                <div>
                  <h2 className=\
                  <p className=\
                </div>
                <div className=\
                  <button 
                    onClick={handleRefreshAllFeeds}
                    className=\
                  >
                    <ArrowsClockwise size={14} />
                    <span>Sync All</span>
                  </button>
                  <button 
                    onClick={() => setIsAddFeedOpen(true)}
                    className=\
                  >
                    <Plus size={14} />
                    <span>Add Feed</span>
                  </button>
                </div>
              </div>

              {/* Feeds Table */}
              <div className=\
                <div className=\
                  <table className=\
                    <thead>
                      <tr className=\
                        <th className=\
                        <th className=\
                        <th className=\
                        <th className=\
                        <th className=\
                      </tr>
                    </thead>
                    <tbody className=\
                      {feeds.length === 0 ? (
                        <tr>
                          <td colSpan={5} className=\
                        </tr>
                      ) : (
                        feeds.map(feed => (
                          <tr key={feed.id} className=\
                            <td className=\
                              <div className=\
                                <span className=\
                                <button 
                                  onClick={() => copyText(feed.url)}
                                  className=\
                                >
                                  <Copy size={10} />
                                  <span>Copy</span>
                                </button>
                              </div>
                              <span className=\
                            </td>
                            <td className=\
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                feed.enabled === 1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                              }`}>{feed.enabled === 1 ? 'Enabled' : 'Disabled'}</span>
                            </td>
                            <td className=\
                            <td className=\
                              <span className=\
                            </td>
                            <td className=\
                              <div className=\
                                <button 
                                  onClick={() => handleRefreshFeed(feed.id)}
                                  className=\
                                  title=\
                                >
                                  <ArrowsClockwise size={13} />
                                </button>
                                <button 
                                  onClick={() => handleToggleFeed(feed.id, feed.enabled)}
                                  className=\
                                >
                                  {feed.enabled === 1 ? 'Disable' : 'Enable'}
                                </button>
                                <button 
                                  onClick={() => handleRemoveFeed(feed.id)}
                                  className=\
                                >
                                  <Trash size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Test Parser Sandbox */}
              <div className=\
                <h3 className=\
                <p className=\
                
                <div className=\
                  <div className=\
                    <input 
                      type=\
                      value={testFeedUrl} 
                      onChange={e => setTestFeedUrl(e.target.value)} 
                      placeholder=\
                      className=\
                    />
                    <button 
                      onClick={handleTestFeed}
                      disabled={isTestingFeed}
                      className=\
                    >
                      {isTestingFeed ? 'Fetching...' : 'Test Fetch'}
                    </button>
                  </div>

                  {testFeedItems.length > 0 && (
                    <div className=\
                      <h4 className=\
                      <div className=\
                        {testFeedItems.map((item, idx) => (
                          <div key={idx} className=\
                            <span className=\
                            <span className=\
                            <p className=\
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: FEED READER */}
          {!isLoading && activeTab === 'reader' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className=\
              <div className=\
                <div>
                  <h2 className=\
                  <p className=\
                </div>
                <div className=\
                  <button 
                    onClick={handleBulkMarkRead} 
                    className=\
                  >
                    Mark All Read
                  </button>
                  <div className=\
                    <input 
                      type=\
                      value={readerSearch} 
                      onChange={e => setReaderSearch(e.target.value)} 
                      placeholder=\
                      className=\
                    />
                    <MagnifyingGlass size={14} className=\
                  </div>
                </div>
              </div>

              {/* Feed items */}
              <div className=\
                {unreadItems.length === 0 ? (
                  <div className=\
                    Your unread queue is empty! All content up to date.
                  </div>
                ) : (
                  unreadItems.map(item => (
                    <div key={item.id} className=\
                      <div className=\
                        <div>
                          <span className=\
                          <h3 className=\
                          <span className=\
                        </div>
                      </div>

                      {item.summary && (
                        <div className=\
                          {item.summary}
                        </div>
                      )}

                      <p className=\

                      <div className=\
                        <div className=\
                          <button 
                            onClick={() => handlePostToTelegram(item.id)}
                            className=\
                          >
                            Post to Telegram
                          </button>
                          {!item.summary && (
                            <button 
                              onClick={() => handleTriggerAiSummary(item.id)}
                              className=\
                            >
                              <Sparkle size={13} />
                              <span>AI Summary</span>
                            </button>
                          )}
                          <button 
                            onClick={() => handleMarkRead(item.id)}
                            className=\
                          >
                            Mark Read
                          </button>
                        </div>
                        <a href={item.link} target=\
                          <span>Original post</span>
                          <ArrowRight size={12} />
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}

          {/* TAB: TELEGRAM TARGETS */}
          {!isLoading && activeTab === 'telegram' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className=\
              <div className=\
                <div>
                  <h2 className=\
                  <p className=\
                </div>
                <button 
                  onClick={() => setIsAddChatOpen(true)}
                  className=\
                >
                  <Plus size={14} />
                  <span>Register Chat</span>
                </button>
              </div>

              {/* Chats Table */}
              <div className=\
                <div className=\
                  <table className=\
                    <thead>
                      <tr className=\
                        <th className=\
                        <th className=\
                        <th className=\
                        <th className=\
                        <th className=\
                      </tr>
                    </thead>
                    <tbody className=\
                      {chats.length === 0 ? (
                        <tr>
                          <td colSpan={5} className=\
                        </tr>
                      ) : (
                        chats.map(chat => (
                          <tr key={chat.name} className=\
                            <td className=\
                            <td className=\
                            <td className=\
                            <td className=\
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                chat.is_default === 1 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-900 text-slate-500 border border-white/5'
                              }`}>{chat.is_default === 1 ? 'Default' : 'Secondary'}</span>
                            </td>
                            <td className=\
                              <div className=\
                                {chat.is_default !== 1 && (
                                  <button 
                                    onClick={() => handleSetDefaultChat(chat.name)}
                                    className=\
                                  >
                                    Set Default
                                  </button>
                                )}
                                <button 
                                  onClick={() => handleRemoveChat(chat.name)}
                                  className=\
                                >
                                  <Trash size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: POST SANDBOX */}
Unterminated string literal.
src/App.tsx(581,3): error TS1005: ',' expected.
src/App.tsx(1577,21): error TS1005: ')' expected.
src/App.tsx(1577,33): error TS1005: ',' expected.
src/App.tsx(1580,20): error TS1109: Expression expected.
src/App.tsx(1581,17): error TS1109: Expression expected.
src/App.tsx(1582,15): error TS1109: Expression expected.
src/App.tsx(1587,13): error TS1128: Declaration or statement expected.
src/App.tsx(1588,11): error TS1109: Expression expected.
src/App.tsx(1589,9): error TS1109: Expression expected.
src/App.tsx(1590,7): error TS1109: Expression expected.
src/App.tsx(1590,8): error TS1128: Declaration or statement expected.
src/App.tsx(1591,5): error TS1128: Declaration or statement expected.
src/App.tsx(1592,3): error TS1109: Expression expected.
src/App.tsx(1593,1): error TS1128: Declaration or statement expected.


            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className=\
              <div>
                <h2 className=\
                <p className=\
              </div>

              <div className=\
                <form onSubmit={handlePostSandbox} className=\
                  <div className=\
                    <label>Telegram Destination</label>
                    <select 
                      value={sandboxTarget} 
                      onChange={e => setSandboxTarget(e.target.value)}
                      className=\
                      required
                    >
                      <option value=\
                      {chats.map(c => (
                        <option key={c.name} value={c.name}>{c.name} ({c.chat_id}){c.is_default === 1 ? ' [DEFAULT]' : ''}</option>
                      ))}
                    </select>
                  </div>

                  <div className=\
                    <label>Content Type</label>
                    <select 
                      value={sandboxType} 
                      onChange={e => setSandboxType(e.target.value)}
                      className=\
                      required
                    >
                      <option value=\
                      <option value=\
                      <option value=\
                      <option value=\
                      <option value=\
                    </select>
                  </div>

                  {(sandboxType === 'photo' || sandboxType === 'video' || sandboxType === 'audio') && (
                    <div className=\
                      <label>Media Direct URL</label>
                      <input 
                        type=\
                        value={sandboxMediaUrl} 
                        onChange={e => setSandboxMediaUrl(e.target.value)}
                        placeholder=\
                        className=\
                        required
                      />
                    </div>
                  )}

                  {sandboxType === 'album' && (
                    <div className=\
                      <label>Album configuration JSON (Array of objects)</label>
                      <textarea 
                        value={sandboxAlbumJson} 
                        onChange={e => setSandboxAlbumJson(e.target.value)}
                        placeholder='[&#10;  {\
                        className=\
                        required
                      />
                    </div>
                  )}

                  <div className=\
                    <label>Message Content / Caption (Supports HTML markup)</label>
                    <textarea 
                      value={sandboxCaption} 
                      onChange={e => setSandboxCaption(e.target.value)}
                      placeholder=\
                      className=\
                      required
                    />
                  </div>

                  <button 
                    type=\
                    className=\
                  >
                    <PaperPlaneTilt size={16} />
                    <span>Dispatch Payload</span>
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {/* TAB: RECALL & LOGS */}
          {!isLoading && activeTab === 'logs' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className=\
              <div className=\
                <div>
                  <h2 className=\
                  <p className=\
                </div>
                <button 
                  onClick={() => setIsAddNoteOpen(true)}
                  className=\
                >
                  <Note size={14} />
                  <span>New Note</span>
                </button>
              </div>

              <div className=\
                {/* Configurations & Post Logs */}
                <div className=\
                  {/* System Settings Block */}
                  <div className=\
                    <h3 className=\
                    <div className=\
                      <div>
                        <span className=\
                        <span className=\
                      </div>
                      <hr className=\
                      <div>
                        <span className=\
                        <div className=\
                          <span className={`px-2 py-0.5 rounded font-semibold ${
                            config.aiSummaryEnabled === '1' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>{config.aiSummaryEnabled === '1' ? 'Enabled' : 'Disabled'}</span>
                          <button 
                            onClick={() => handleToggleGlobalAi(config.aiSummaryEnabled)}
                            className=\
                          >
                            Toggle
                          </button>
                        </div>
                      </div>
                      <hr className=\
                      <div>
                        <span className=\
                        <div className=\
                          <select 
                            value={config.aiModel || 'nvidia/llama-3.1-nemotron-70b-instruct'} 
                            onChange={e => handleSaveModelConfig(e.target.value)}
                            className=\
                          >
                            {MODEL_OPTIONS.map(m => (
                              <option key={m.value} value={m.value}>{m.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <hr className=\
                      <div>
                        <div className=\
                          <span className=\
                          <button onClick={handleEditPromptConfig} className=\
                        </div>
                        <p className=\
                          {config.aiPrompt || 'Using default Arabic news summarizer system instructions.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Post Logs Outcomes */}
                  <div className=\
                    <h3 className=\
                    <div className=\
                      {postLogs.length === 0 ? (
                        <span className=\
                      ) : (
                        postLogs.map((log, idx) => (
                          <div key={idx} className=\
                            <div className=\
                              <span className={`font-bold uppercase ${
                                log.status === 'ok' ? 'text-emerald-400' : 'text-red-400'
                              }`}>{log.status === 'ok' ? 'success' : 'failed'}</span>
                              <span className=\
                            </div>
                            <span className=\
                            <span className=\
                            {log.error && <span className=\
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline / Recall Notes */}
                <div className=\
                  <h3 className=\
                  <div className=\
                    {timeline.length === 0 ? (
                      <span className=\
                    ) : (
                      timeline.map((entry, idx) => (
                        <div key={idx} className=\
                          <span className=\
                          <span className=\
                          <div className=\
                            {entry.type === 'note' ? (
                              <div>
                                <p className=\
                                <div className=\
                                  <div className=\
                                    {(entry.tags ? JSON.parse(entry.tags) : []).map((t: string) => (
                                      <span key={t} className=\
                                    ))}
                                  </div>
                                  <button onClick={() => handleDeleteNote(entry.id)} className=\
                                </div>
                              </div>
                            ) : (
                              <div>
                                <span>Type: <b>{entry.message_type}</b> | Outcome: <b className={entry.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>{entry.status.toUpperCase()}</b></span>
                                <p className=\
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: MCP PLAYGROUND */}
          {!isLoading && activeTab === 'playground' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className=\
              <div>
                <h2 className=\
                <p className=\
              </div>

              <div className=\
                <div className=\
                  {/* Tools List */}
                  <div className=\
                    {MCP_TOOLS.map(tool => (
                      <button
                        key={tool.name}
                        onClick={() => handleSelectTool(tool)}
                        className={`w-full text-left font-mono text-xs px-3 py-2.5 rounded-lg transition-all ${
                          selectedTool.name === tool.name ? 'bg-indigo-600/15 text-indigo-400 font-semibold' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                        }`}
                      >
                        {tool.name}
                      </button>
                    ))}
                  </div>

                  {/* Schema Exec Panel */}
                  <div className=\
                    <div>
                      <h3 className=\
                      <p className=\
                    </div>

                    <div className=\
                      <label className=\
                      <textarea
                        value={toolArgs}
                        onChange={e => setToolArgs(e.target.value)}
                        className=\
                      />
                      <button 
                        onClick={formatToolJson}
                        className=\
                      >
                        Format
                      </button>
                    </div>

                    <div>
                      <button 
                        onClick={handleExecuteTool}
                        disabled={isExecutingTool}
                        className=\
                      >
                        {isExecutingTool ? 'Calling...' : 'Call Tool'}
                      </button>
                    </div>

                    <div className=\
                      <label className=\
                      <pre className=\
                        {toolResult || '// Result payload will print here'}
                      </pre>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB: AGENT CHAT */}
          {!isLoading && activeTab === 'chat' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className=\
              <div className=\
                <h2 className=\
                <p className=\
              </div>

              {/* Chat Canvas */}
              <div className=\
                {/* Messages Box */}
                <div className=\
                  {chatMessages.map((msg, idx) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div key={idx} className={`flex flex-col max-w-[80%] ${isUser ? 'align-self-end ml-auto' : 'align-self-start mr-auto'}`}>
                        {/* Tool execution badge */}
                        {!isUser && msg.toolsCalled && (
                          <div className=\
                            <Terminal size={10} />
                            <span>Executed: {msg.toolsCalled.join(', ')}</span>
                          </div>
                        )}
                        <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                          isUser ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-slate-900 border border-white/5 text-slate-200 rounded-bl-none'
                        }`}>
                          <p className=\
                        </div>
                      </div>
                    );
                  })}
                  {isChatting && (
                    <div className=\
                      <div className=\
                        <Terminal size={10} />
                        <span>Agent is reasoning and executing tools...</span>
                      </div>
                      <div className=\
                        Thinking...
                      </div>
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input Form */}
                <form onSubmit={handleSendChatMessage} className=\
                  <input
                    type=\
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    placeholder=\
                    disabled={isChatting}
                    className=\
                  />
                  <button
                    type=\
                    disabled={isChatting || !chatInput.trim()}
                    className=\
                  >
                    <span>Send</span>
                    <ArrowRight size={14} />
                  </button>
                </form>
              </div>
            </motion.div>
          )}

        </main>
      </div>

      {/* MODAL: Access Token Setup */}
      {isTokenModalOpen && (
        <div className=\
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className=\
            <div className=\
              <h3 className=\
              <button onClick={() => setIsTokenModalOpen(false)} className=\
            </div>
            <div className=\
              <div className=\
                <label className=\
                <input 
                  type=\
                  value={tempToken} 
                  onChange={e => setTempToken(e.target.value)} 
                  placeholder=\
                  className=\
                />
                <p className=\
                  This bearer token validates administrative updates to your Cloudflare Worker. It is saved strictly in your local browser storage.
                </p>
              </div>
            </div>
            <div className=\
              <button onClick={() => setIsTokenModalOpen(false)} className=\
              <button onClick={handleSaveToken} className=\
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: Add Feed */}
      {isAddFeedOpen && (
        <div className=\
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className=\
            <form onSubmit={handleAddFeed}>
              <div className=\
                <h3 className=\
                <button type=\
              </div>
              <div className=\
                <div className=\
                  <label className=\
                  <input 
                    type=\
                    value={addFeedUrl} 
                    onChange={e => setAddFeedUrl(e.target.value)} 
                    placeholder=\
                    className=\
                    required
                  />
                </div>
                <div className=\
                  <label className=\
                  <input 
                    type=\
                    value={addFeedTitle} 
                    onChange={e => setAddFeedTitle(e.target.value)} 
                    placeholder=\
                    className=\
                  />
                </div>
              </div>
              <div className=\
                <button type=\
                <button type=\
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: Register Chat */}
      {isAddChatOpen && (
        <div className=\
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className=\
            <form onSubmit={handleAddChat}>
              <div className=\
                <h3 className=\
                <button type=\
              </div>
              <div className=\
                <div className=\
                  <label className=\
                  <input 
                    type=\
                    value={chatName} 
                    onChange={e => setChatName(e.target.value)} 
                    placeholder=\
                    className=\
                    required
                  />
                </div>
                <div className=\
                  <label className=\
                  <input 
                    type=\
                    value={chatIdVal} 
                    onChange={e => setChatIdVal(e.target.value)} 
                    placeholder=\
                    className=\
                    required
                  />
                </div>
                <div className=\
                  <label className=\
                  <select 
                    value={chatType} 
                    onChange={e => setChatType(e.target.value)} 
                    className=\
                    required
                  >
                    <option value=\
                    <option value=\
                    <option value=\
                    <option value=\
                  </select>
                </div>
                <div className=\
                  <input 
                    type=\
                    id=\
                    checked={chatDefault} 
                    onChange={e => setChatDefault(e.target.checked)} 
                    className=\
                  />
                  <label htmlFor=\
                </div>
              </div>
              <div className=\
                <button type=\
                <button type=\
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: Add Note */}
      {isAddNoteOpen && (
        <div className=\
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className=\
            <form onSubmit={handleAddNote}>
              <div className=\
                <h3 className=\
                <button type=\
              </div>
              <div className=\
                <div className=\
                  <label className=\
                  <textarea 
                    value={noteContent} 
                    onChange={e => setNoteContent(e.target.value)} 
                    placeholder=\
                    className=\
                    required
                  />
                </div>
                <div className=\
                  <label className=\
                  <input 
                    type=\
                    value={noteTags} 
                    onChange={e => setNoteTags(e.target.value)} 
                    placeholder=\
                    className=\
                  />
                </div>
              </div>
              <div className=\
                <button type=\
                <button type=\
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className=\
            <form onSubmit={handleAddNote}>
              <div className=\
                <h3 className=\
                <button type=\
              </div>
              <div className=\
                <div className=\
                  <label className=\
                  <textarea 
                    value={noteContent} 
                    onChange={e => setNoteContent(e.target.value)} 
    // Can hook up toast from window context if necessary
                    className=\
                    required
                  />
const formatDate = (unixSecs: number | null | undefined) => {
  if (!unixSecs) return 'Never';
  const date = new Date(unixSecs * 1000);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    type=\
                    value={noteTags} 
