import React, { useState, useEffect, useRef } from 'react';
import { 
  Rss, BookOpen, TelegramLogo, PaperPlaneTilt, 
  Clock, Terminal, ChatCircleText, Plus, 
  Trash, Gear, 
  ArrowsClockwise, Sparkle, Note, MagnifyingGlass,
  ArrowRight, ShieldCheck, ShieldWarning, CaretLeft, CaretRight, X, Sun, Moon
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';

// Predefined model options matching the bot commands
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

interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export default function App() {
  const [activeTab, setActiveTab] = useState('feeds');
  const [token, setToken] = useState(() => localStorage.getItem('rss_mcp_auth_token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tempToken, setTempToken] = useState('');
  
  // Custom states for redesign theme & collapse
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedReaderItem, setSelectedReaderItem] = useState<any>(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  // Skeletons / Loading states
  const [isLoading, setIsLoading] = useState(true);

  // Data states
  const [feeds, setFeeds] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [unreadItems, setUnreadItems] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [postLogs, setPostLogs] = useState<any[]>([]);
  const [config, setConfigState] = useState<any>({});
  
  // Modals & Inputs
  const [isAddFeedOpen, setIsAddFeedOpen] = useState(false);
  const [addFeedUrl, setAddFeedUrl] = useState('');
  const [addFeedTitle, setAddFeedTitle] = useState('');
  
  const [testFeedUrl, setTestFeedUrl] = useState('');
  const [testFeedItems, setTestFeedItems] = useState<any[]>([]);
  const [isTestingFeed, setIsTestingFeed] = useState(false);

  const readerFeedFilter = '';
  const [readerSearch, setReaderSearch] = useState('');

  const [isAddChatOpen, setIsAddChatOpen] = useState(false);
  const [chatName, setChatName] = useState('');
  const [chatIdVal, setChatIdVal] = useState('');
  const [chatType, setChatType] = useState('channel');
  const [chatDefault, setChatDefault] = useState(false);

  const [sandboxTarget, setSandboxTarget] = useState('');
  const [sandboxType, setSandboxType] = useState('text');
  const [sandboxCaption, setSandboxCaption] = useState('');
  const [sandboxMediaUrl, setSandboxMediaUrl] = useState('');
  const [sandboxAlbumJson, setSandboxAlbumJson] = useState('');

  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteTags, setNoteTags] = useState('');

  // Playground state
  const [selectedTool, setSelectedTool] = useState(MCP_TOOLS[0]);
  const [toolArgs, setToolArgs] = useState(JSON.stringify(MCP_TOOLS[0].template, null, 2));
  const [toolResult, setToolResult] = useState('');
  const [isExecutingTool, setIsExecutingTool] = useState(false);

  // Chat Agent state
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; toolsCalled?: string[] }>>([
    { role: 'assistant', content: 'Hi there! I am your RSS & MCP Agent. You can ask me to list your feeds, check for unread articles, search for posts, or save notes. How can I help you today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Theme Sync Effect
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Toast emitter
  const showToast = (message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard!', 'success');
    });
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
      showToast(`Successfully parsed feed: "${res.data.feedTitle || 'Unnamed'}"`, 'success');
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
    if (!res.error) {
      const items = res.data || [];
      setUnreadItems(items);
      if (selectedReaderItem) {
        const found = items.find((i: any) => i.id === selectedReaderItem.id);
        if (found) {
          setSelectedReaderItem((prev: any) => prev ? { ...prev, ...found } : found);
        }
      }
    }
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
      if (selectedReaderItem?.id === id) {
        setSelectedReaderItem(null);
      }
    }
  };

  const handleSelectItem = async (item: any) => {
    setSelectedReaderItem(item);
    const res = await callApi('get_item', { id: item.id });
    if (!res.error && res.data) {
      setSelectedReaderItem((prev: any) => {
        if (prev?.id === item.id) {
          return {
            ...prev,
            text: res.data.text,
            summary: res.data.summary,
            media: res.data.media,
            mediaType: res.data.media_type,
            contentHtml: res.data.content_html,
          };
        }
        return prev;
      });
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
      setSelectedReaderItem(null);
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
      if (selectedReaderItem?.id === itemId) {
        setSelectedReaderItem((prev: any) => prev ? { ...prev, summary: res.data.summary } : null);
      }
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
    if (!confirm(`Remove chat target "${name}"?`)) return;
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
    setToolResult(`Executing tool "${selectedTool.name}"...`);
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

    // Call API chat endpoint
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          messages: updatedMessages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      if (response.status === 401) {
        showToast('Unauthorized: Set your access token to chat.', 'error');
        setIsTokenModalOpen(true);
        setIsChatting(false);
        return;
      }

      const resData = await response.json();
      if (!response.ok) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${resData.error || 'Connection failed'}` }]);
      } else {
        const { response: replyText, toolsCalled } = resData.data;
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: replyText,
          toolsCalled: toolsCalled && toolsCalled.length > 0 ? toolsCalled : undefined
        }]);
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Network error: ${err.message || String(err)}` }]);
    } finally {
      setIsChatting(false);
    }
  };

  const springTransition = { type: 'spring', stiffness: 100, damping: 20 } as const;

  return (
    <div className="bg-glow-radial min-h-[100dvh] flex flex-col antialiased relative">
      {/* Visual textures - DOM Optimized */}
      <div className="mesh-grid absolute inset-0 z-0 pointer-events-none opacity-40" />
      <div className="grain-overlay" />

      {/* Toast Notifications */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2.5 z-[9999]">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={springTransition}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 rounded-xl text-sm min-w-[300px] max-w-[400px] shadow-2xl backdrop-blur-md border border-border-base ${
                toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30' :
                toast.type === 'error' ? 'bg-rose-950/90 text-rose-300 border-rose-500/30' :
                toast.type === 'warning' ? 'bg-amber-950/90 text-amber-300 border-amber-500/30' :
                'bg-bg-card text-text-base'
              }`}
            >
              <span>{toast.message}</span>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} 
                className="text-text-muted hover:text-text-base text-lg cursor-pointer transition"
              >
                <X size={14} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <header className="sticky top-0 bg-bg-card/75 backdrop-blur-md border-b border-border-base px-8 py-5 flex items-center justify-between z-40">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-accent-primary flex items-center justify-center font-bold text-white shadow-lg shadow-accent-primary/10">R</div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-xl leading-tight bg-gradient-to-r from-text-base to-text-muted bg-clip-text text-transparent">RSS Bridge & MCP</h1>
              <span className="w-1.5 h-1.5 rounded-full bg-accent-primary shadow-[0_0_10px_var(--color-accent-primary)]" />
            </div>
            <span className="text-[10px] text-text-muted font-mono tracking-widest uppercase">Cloudflare Worker Panel</span>
          </div>
        </div>

        {/* Global theme controls */}
        <div className="flex items-center gap-4">
          {/* Light/Dark Toggle Button */}
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="p-2.5 rounded-xl bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition flex items-center justify-center"
            title="Toggle theme mode"
          >
            {theme === 'light' ? <Moon size={15} /> : <Sun size={15} />}
          </motion.button>

          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            isAuthenticated === true ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            isAuthenticated === false ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
            'bg-bg-input text-text-muted border-border-base'
          }`}>
            {isAuthenticated === true ? <ShieldCheck size={14} className="text-emerald-400" /> : <ShieldWarning size={14} className="text-rose-400" />}
            <span className="font-mono">{isAuthenticated === true ? 'Authenticated' : isAuthenticated === false ? 'No Access' : 'Connecting'}</span>
          </div>

          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={() => { setTempToken(token); setIsTokenModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base transition duration-200 cursor-pointer"
          >
            <Gear size={14} />
            <span>Setup Token</span>
          </motion.button>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-[1400px] w-full mx-auto px-8 py-10 flex-grow grid grid-cols-1 md:grid-cols-[auto_1fr] gap-12 z-10 relative">
        {/* Navigation Sidebar */}
        <aside className="relative">
          <motion.div 
            animate={{ width: sidebarCollapsed ? 72 : 240 }}
            transition={springTransition}
            className="liquid-glass rounded-2xl p-4 flex flex-col justify-between h-[calc(100vh-200px)] sticky top-28 overflow-hidden"
          >
            <div className="flex flex-col gap-6">
              <ul className="flex flex-col gap-1.5">
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
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setActiveTab(tab.id)}
                        className={`w-full flex items-center gap-3.5 px-4 py-3.5 rounded-xl text-sm font-semibold transition duration-200 relative cursor-pointer ${
                          active ? 'bg-accent-primary/10 text-accent-primary font-bold border-l-2 border-accent-primary' : 'text-text-muted hover:text-text-base hover:bg-white/5'
                        }`}
                      >
                        <Icon size={18} className="flex-shrink-0" />
                        {!sidebarCollapsed && (
                          <motion.span 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }}
                            className="truncate"
                          >
                            {tab.label}
                          </motion.span>
                        )}
                      </motion.button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Sidebar toggle */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="mt-auto flex items-center justify-center p-3 rounded-xl border border-border-base bg-bg-input text-text-muted hover:text-text-base cursor-pointer transition"
            >
              {sidebarCollapsed ? <CaretRight size={16} /> : <CaretLeft size={16} />}
            </motion.button>
          </motion.div>
        </aside>

        {/* Content Panel */}
        <main className="min-w-0">
          <AnimatePresence mode="wait">
            
            {/* SKELETON LOADER */}
            {isLoading && (
              <motion.div 
                key="skeleton"
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }}
                className="flex flex-col gap-6"
              >
                <div className="h-10 w-1/3 bg-white/5 rounded-xl animate-pulse" />
                <div className="p-8 rounded-2xl border border-border-base bg-bg-card/30 flex flex-col gap-4 animate-pulse">
                  <div className="h-5 w-full bg-white/5 rounded-lg" />
                  <div className="h-5 w-3/4 bg-white/5 rounded-lg" />
                  <div className="h-5 w-5/6 bg-white/5 rounded-lg" />
                </div>
              </motion.div>
            )}

            {/* TAB: RSS FEEDS */}
            {!isLoading && activeTab === 'feeds' && (
              <motion.div 
                key="feeds"
                initial={{ opacity: 0, y: 8 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-8"
              >
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h2 className="font-bold text-2xl tracking-tight text-text-base">RSS Feeds</h2>
                    <p className="text-xs text-text-muted mt-1">Manage synchronized content feeds and scheduled refreshes</p>
                  </div>
                  <div className="flex gap-3">
                    <motion.button 
                      whileTap={{ scale: 0.98 }}
                      onClick={handleRefreshAllFeeds}
                      className="flex items-center gap-2 px-4.5 py-2.5 text-xs font-bold text-text-base bg-bg-input border border-border-base rounded-xl hover:bg-neutral-800 transition duration-200 cursor-pointer"
                    >
                      <ArrowsClockwise size={14} />
                      <span>Sync All</span>
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsAddFeedOpen(true)}
                      className="flex items-center gap-2 px-4.5 py-2.5 text-xs font-bold text-white bg-accent-primary rounded-xl hover:bg-accent-primary-hover transition duration-200 shadow-lg shadow-accent-primary/10 cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>Add Feed</span>
                    </motion.button>
                  </div>
                </div>

                {/* Feeds Card Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {feeds.length === 0 ? (
                    <div className="lg:col-span-2 p-12 text-center border border-dashed border-border-base rounded-2xl bg-bg-card/25 text-sm text-text-muted">
                      No feeds registered. Click "Add Feed" to start importing content.
                    </div>
                  ) : (
                    feeds.map(feed => (
                      <motion.div 
                        key={feed.id}
                        whileHover={{ y: -4 }}
                        transition={springTransition}
                        className="liquid-glass p-6 rounded-2xl flex flex-col justify-between relative overflow-hidden group min-h-[160px]"
                      >
                        <div className="flex flex-col gap-2.5">
                          <div className="flex justify-between items-start gap-4">
                            <span className="font-bold text-base text-text-base truncate max-w-[70%]">{feed.title}</span>
                            <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase ${
                              feed.enabled === 1 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${feed.enabled === 1 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500'}`} />
                              {feed.enabled === 1 ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <span className="text-xs text-text-muted font-mono block truncate cursor-pointer hover:text-text-base" onClick={() => handleCopyText(feed.url)}>
                            {feed.url}
                          </span>
                        </div>

                        <div className="flex justify-between items-center border-t border-border-base pt-4 mt-6">
                          <div className="flex flex-col text-[11px] text-text-muted font-mono">
                            <span className="uppercase tracking-wider text-[9px] text-text-muted font-bold opacity-60">Last Synchronized</span>
                            <span className="mt-0.5 text-text-base font-bold">{formatDate(feed.last_fetched_at)}</span>
                          </div>
                          
                          <div className="flex gap-2 opacity-80 group-hover:opacity-100 transition duration-200">
                            <motion.button 
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleRefreshFeed(feed.id)}
                              className="p-2.5 rounded-xl bg-bg-input border border-border-base text-text-muted hover:text-text-base transition duration-200 cursor-pointer"
                              title="Sync Feed"
                            >
                              <ArrowsClockwise size={14} />
                            </motion.button>
                            <motion.button 
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleToggleFeed(feed.id, feed.enabled)}
                              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-bg-input border border-border-base text-text-base hover:text-text-base transition duration-200 cursor-pointer"
                            >
                              {feed.enabled === 1 ? 'Pause' : 'Activate'}
                            </motion.button>
                            <motion.button 
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleRemoveFeed(feed.id)}
                              className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 transition duration-200 cursor-pointer"
                              title="Remove"
                            >
                              <Trash size={14} />
                            </motion.button>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>

                {/* Test Parser Sandbox */}
                <div className="mt-8 border-t border-border-base pt-8">
                  <h3 className="font-bold text-lg text-text-base">Test Feed Parser</h3>
                  <p className="text-xs text-text-muted mt-1">Download and preview items from any external feed before registering it</p>
                  
                  <div className="liquid-glass mt-4 p-6 rounded-2xl flex flex-col gap-4">
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
                        <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2">
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
                </div>
              </motion.div>
            )}

            {/* TAB: FEED READER (Split-Screen) */}
            {!isLoading && activeTab === 'reader' && (
              <motion.div 
                key="reader"
                initial={{ opacity: 0, y: 8 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-6 h-[calc(100vh-190px)] min-h-[550px]"
              >
                <div className="flex justify-between items-center gap-4 flex-wrap">
                  <div>
                    <h2 className="font-bold text-2xl tracking-tight text-text-base">Feed Reader</h2>
                    <p className="text-xs text-text-muted mt-1">Review unread synced items and trigger dispatch actions</p>
                  </div>
                  <div className="flex gap-3 items-center">
                    <motion.button 
                      whileTap={{ scale: 0.98 }}
                      onClick={async () => {
                        await handleRefreshAllFeeds();
                        loadReaderItems();
                      }}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-base hover:text-text-base transition duration-200 cursor-pointer"
                    >
                      <ArrowsClockwise size={14} className={isLoading ? "animate-spin" : ""} />
                      <span>Sync Feeds</span>
                    </motion.button>
                    <motion.button 
                      whileTap={{ scale: 0.98 }}
                      onClick={handleBulkMarkRead} 
                      className="px-4 py-2.5 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-base hover:text-text-base transition duration-200 cursor-pointer"
                    >
                      Mark All Read
                    </motion.button>
                    <div className="relative">
                      <input 
                        type="text" 
                        value={readerSearch} 
                        onChange={e => setReaderSearch(e.target.value)} 
                        placeholder="Search keywords..." 
                        className="bg-bg-input border border-border-base rounded-xl pl-9 pr-4 py-2 text-xs text-text-base focus:outline-none focus:border-accent-primary w-[200px]"
                      />
                      <MagnifyingGlass size={14} className="absolute left-3.5 top-3 text-text-muted" />
                    </div>
                  </div>
                </div>

                {/* 2-Pane Split Screen Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-grow overflow-hidden">
                  
                  {/* Left Pane: Items List (Col span 5) */}
                  <div className="lg:col-span-5 h-full flex flex-col gap-4 overflow-hidden">
                    <div className="overflow-y-auto flex-grow flex flex-col gap-3 pr-2 scrollbar-thin">
                      {unreadItems.length === 0 ? (
                        <div className="p-12 text-center border border-dashed border-border-base rounded-2xl bg-bg-card/25 text-sm text-text-muted">
                          Your unread queue is empty.
                        </div>
                      ) : (
                        unreadItems.map(item => {
                          const isActive = selectedReaderItem?.id === item.id;
                          return (
                            <motion.button 
                              key={item.id}
                              whileHover={{ x: 2 }}
                              onClick={() => handleSelectItem(item)}
                              className={`p-4 text-left rounded-xl transition duration-200 border cursor-pointer flex flex-col gap-2 ${
                                isActive 
                                  ? 'bg-accent-primary/10 border-accent-primary/40 shadow-lg text-text-base' 
                                  : 'bg-bg-card/20 border-border-base hover:bg-bg-card/50 text-text-muted'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-3 w-full">
                                <span className="text-[10px] uppercase font-bold tracking-wide text-accent-primary px-2 py-0.5 rounded bg-accent-primary/5 border border-accent-primary/15 truncate">
                                  {item.feed_title}
                                </span>
                                <span className="text-[10px] text-text-muted font-mono whitespace-nowrap self-center">
                                  {formatDate(item.timestamp).split(' ')[1]}
                                </span>
                              </div>
                              <span className={`font-bold text-sm leading-snug line-clamp-2 ${isActive ? 'text-text-base' : 'text-text-base/80'}`}>
                                {item.title}
                              </span>
                              <span className="text-[11px] text-text-muted font-mono block">By {item.author || 'Author'}</span>
                            </motion.button>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Right Pane: Item Content Viewer (Col span 7) */}
                  <div className="lg:col-span-7 h-full flex flex-col liquid-glass rounded-2xl overflow-hidden relative">
                    <AnimatePresence mode="wait">
                      {!selectedReaderItem ? (
                        <motion.div 
                          key="empty"
                          initial={{ opacity: 0 }} 
                          animate={{ opacity: 1 }} 
                          exit={{ opacity: 0 }}
                          className="flex flex-col items-center justify-center h-full p-12 text-center text-text-muted gap-3"
                        >
                          <BookOpen size={42} className="text-text-muted/60" />
                          <span className="text-sm font-semibold">Select an article from the list to preview</span>
                          <span className="text-xs text-text-muted/50">Select content to view the direct text, Arabic summaries, and Telegram dispatch operations</span>
                        </motion.div>
                      ) : (
                        <motion.div 
                          key={selectedReaderItem.id}
                          initial={{ opacity: 0, x: 10 }} 
                          animate={{ opacity: 1, x: 0 }} 
                          exit={{ opacity: 0, x: -10 }}
                          className="flex flex-col h-full overflow-hidden"
                        >
                          {/* Viewer Header */}
                          <div className="p-6 border-b border-border-base bg-bg-card/25">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-accent-primary bg-accent-primary/5 px-2.5 py-0.5 rounded border border-accent-primary/15 mb-2 inline-block">
                              {selectedReaderItem.feed_title}
                            </span>
                            <h3 className="font-bold text-lg text-text-base leading-snug tracking-tight">
                              {selectedReaderItem.title}
                            </h3>
                            <div className="flex gap-4 text-xs text-text-muted mt-2.5 font-mono">
                              <span>By {selectedReaderItem.author || 'unknown'}</span>
                              <span>•</span>
                              <span>Synced {formatDate(selectedReaderItem.timestamp)}</span>
                            </div>
                          </div>

                          {/* Viewer Body (Scrollable) */}
                          <div className="p-6 flex-grow overflow-y-auto flex flex-col gap-6">
                            {selectedReaderItem.text === undefined ? (
                              <div className="flex flex-col items-center justify-center py-20 text-text-muted gap-3 flex-grow">
                                <div className="w-8 h-8 border-3 border-accent-primary border-t-transparent rounded-full animate-spin"></div>
                                <span className="text-xs font-medium tracking-wide">Fetching article content...</span>
                              </div>
                            ) : (
                              <>
                                {/* AI Summary Block (RTL Arabic) */}
                                {selectedReaderItem.summary ? (
                                  <div className="p-5 rounded-xl bg-accent-primary/5 border border-accent-primary/20 flex flex-col gap-2">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-accent-primary uppercase tracking-widest">
                                      <Sparkle size={12} />
                                      <span>Arabic AI Summary</span>
                                    </div>
                                    <p className="text-sm text-text-base leading-relaxed font-sans text-right" dir="rtl">
                                      {selectedReaderItem.summary}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="p-5 rounded-xl bg-bg-input border border-border-base flex justify-between items-center">
                                    <span className="text-xs text-text-muted">No Arabic AI summary compiled.</span>
                                    <motion.button 
                                      whileTap={{ scale: 0.95 }}
                                      onClick={() => handleTriggerAiSummary(selectedReaderItem.id)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-bg-input border border-border-base text-text-base hover:text-text-base cursor-pointer"
                                    >
                                      <Sparkle size={12} className="text-accent-primary animate-pulse" />
                                      <span>Summarize Now</span>
                                    </motion.button>
                                  </div>
                                )}

                                {/* Feed Item Body Text */}
                                {selectedReaderItem.contentHtml ? (
                                  <div 
                                    className="text-sm text-text-base/90 leading-relaxed break-words max-w-[65ch] rss-content-html"
                                    dangerouslySetInnerHTML={{ __html: selectedReaderItem.contentHtml }}
                                  />
                                ) : (
                                  <div className="text-sm text-text-base/90 leading-relaxed break-words max-w-[65ch] whitespace-pre-wrap">
                                    {selectedReaderItem.text}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Viewer Footer actions */}
                          <div className="p-4 border-t border-border-base bg-bg-card/40 flex justify-between items-center flex-wrap gap-3 mt-auto">
                            <div className="flex gap-2">
                              <motion.button 
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handlePostToTelegram(selectedReaderItem.id)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary hover:bg-accent-primary-hover text-white transition duration-200 cursor-pointer"
                              >
                                Post to Telegram
                              </motion.button>
                              <motion.button 
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleMarkRead(selectedReaderItem.id)}
                                className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer"
                              >
                                Mark Read
                              </motion.button>
                            </div>
                            
                            <a 
                              href={selectedReaderItem.link} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-xs text-text-muted hover:text-accent-primary transition flex items-center gap-1.5 font-semibold"
                            >
                              <span>Original Source</span>
                              <ArrowRight size={12} />
                            </a>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB: TELEGRAM TARGETS */}
            {!isLoading && activeTab === 'telegram' && (
              <motion.div 
                key="telegram"
                initial={{ opacity: 0, y: 8 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col gap-6"
              >
                <div className="flex justify-between items-center flex-wrap gap-4">
                  <div>
                    <h2 className="font-bold text-2xl tracking-tight text-text-base">Telegram Targets</h2>
                    <p className="text-xs text-text-muted mt-1">Configure Telegram channels and groups to receive dispatches</p>
                  </div>
                  <motion.button 
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsAddChatOpen(true)}
                    className="flex items-center gap-2 px-4.5 py-2.5 text-xs font-bold text-white bg-accent-primary rounded-xl hover:bg-accent-primary-hover transition duration-200 shadow-lg cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Register Chat</span>
                  </motion.button>
                </div>

                {/* Grid layout of Chats */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {chats.length === 0 ? (
                    <div className="md:col-span-2 p-12 text-center border border-dashed border-border-base rounded-2xl bg-bg-card/25 text-sm text-text-muted">
                      No chat targets registered. Click "Register Chat" to configure.
                    </div>
                  ) : (
                    chats.map(chat => {
                      const isDefault = chat.is_default === 1;
                      return (
                        <motion.div 
                          key={chat.name}
                          whileHover={{ y: -2 }}
                          transition={springTransition}
                          className={`liquid-glass p-6 rounded-2xl flex flex-col justify-between relative ${
                            isDefault ? 'border-accent-primary/20 bg-accent-primary/5' : ''
                          }`}
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-base text-text-base">{chat.name}</span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded tracking-wide uppercase ${
                                chat.type === 'channel' ? 'bg-accent-primary/10 text-accent-primary' : 'bg-bg-input border border-border-base text-text-muted'
                              }`}>
                                {chat.type}
                              </span>
                            </div>
                            <span className="text-xs text-text-muted font-mono block select-all">
                              {chat.chat_id}
                            </span>
                          </div>

                          <div className="flex justify-between items-center mt-6 pt-4 border-t border-border-base">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                              isDefault ? 'bg-accent-primary/20 text-accent-primary' : 'bg-bg-input text-text-muted/60'
                            }`}>
                              {isDefault ? 'Default Destination' : 'Secondary Destination'}
                            </span>

                            <div className="flex gap-2">
                              {!isDefault && (
                                <motion.button 
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => handleSetDefaultChat(chat.name)}
                                  className="px-3 py-1.5 text-xs font-bold rounded-xl bg-bg-input border border-border-base text-text-base hover:text-text-base cursor-pointer transition"
                                >
                                  Make Default
                                </motion.button>
                              )}
                              <motion.button 
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleRemoveChat(chat.name)}
                                className="p-2.5 rounded-xl bg-rose-950/20 border border-rose-900/20 text-rose-400 hover:bg-rose-900/30 cursor-pointer transition duration-200"
                              >
                                <Trash size={14} />
                              </motion.button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB: POST SANDBOX */}
            {!isLoading && activeTab === 'sandbox' && (
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
                        className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold bg-accent-primary hover:bg-accent-primary-hover text-white transition duration-200 mt-2 cursor-pointer"
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
                      {/* Telegram UI Header mock */}
                      <div className="bg-bg-card/40 p-4 border-b border-border-base flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent-primary flex items-center justify-center text-xs font-bold text-white uppercase">
                          {sandboxTarget ? sandboxTarget.slice(0, 2) : 'T'}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-text-base">{sandboxTarget || 'Target Chat'}</span>
                          <span className="text-[9px] text-text-muted font-mono">Channel Feed</span>
                        </div>
                      </div>

                      {/* Mock Image/Video Area */}
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

                      {/* Caption Section */}
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
            )}

            {/* TAB: RECALL & LOGS */}
            {!isLoading && activeTab === 'logs' && (
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
              </motion.div>
            )}

            {/* TAB: MCP PLAYGROUND */}
            {!isLoading && activeTab === 'playground' && (
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
            )}

            {/* TAB: AGENT CHAT */}
            {!isLoading && activeTab === 'chat' && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, y: 8 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -8 }}
                className="flex flex-col h-[calc(100vh-190px)] min-h-[500px]"
              >
                <div className="mb-4">
                  <h2 className="font-bold text-2xl tracking-tight text-text-base">Agent Chat</h2>
                  <p className="text-xs text-text-muted mt-1">Converse with the assistant equipped with all 26 local RSS and database tools</p>
                </div>

                {/* Chat Canvas */}
                <div className="flex-grow border border-border-base bg-bg-card/25 backdrop-blur-md rounded-2xl p-6 flex flex-col justify-between overflow-hidden relative">
                  {/* Messages Box */}
                  <div className="flex-grow overflow-y-auto flex flex-col gap-5 pr-2 mb-4 scrollbar-thin">
                    {chatMessages.map((msg, idx) => {
                      const isUser = msg.role === 'user';
                      return (
                        <div key={idx} className={`flex flex-col max-w-[80%] ${isUser ? 'self-end ml-auto' : 'self-start mr-auto'}`}>
                          {/* Tool execution badge */}
                          {!isUser && msg.toolsCalled && (
                            <div className="flex items-center gap-1.5 text-[9px] text-accent-primary font-mono mb-1.5 px-2 py-0.5 rounded bg-accent-primary/5 border border-accent-primary/10 self-start">
                              <Terminal size={10} />
                              <span>Executed: {msg.toolsCalled.join(', ')}</span>
                            </div>
                          )}
                          <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                            isUser ? 'bg-accent-primary text-white rounded-br-none' : 'bg-bg-input border border-border-base text-text-base rounded-bl-none'
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          </div>
                        </div>
                      );
                    })}
                    {isChatting && (
                      <div className="flex flex-col max-w-[80%] self-start mr-auto">
                        <div className="flex items-center gap-1.5 text-[9px] text-accent-primary font-mono mb-1.5 px-2 py-0.5 rounded bg-accent-primary/5 border border-accent-primary/10 self-start animate-pulse">
                          <Terminal size={10} />
                          <span>Agent is reasoning and executing tools...</span>
                        </div>
                        <div className="p-4 rounded-2xl text-sm bg-bg-input/65 border border-dashed border-border-base text-text-muted rounded-bl-none animate-pulse">
                          Thinking...
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  {/* Input Form */}
                  <form onSubmit={handleSendChatMessage} className="flex gap-3 mt-auto border-t border-border-base pt-4 z-10">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      placeholder="Ask agent: 'Find unread items about technology' or 'Add note saying deployment succeeded'..."
                      disabled={isChatting}
                      className="flex-grow bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold"
                    />
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={isChatting || !chatInput.trim()}
                      className="px-6 py-3.5 rounded-xl bg-accent-primary hover:bg-accent-primary-hover text-white font-bold transition duration-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <span>Send</span>
                      <ArrowRight size={14} />
                    </motion.button>
                  </form>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </main>
      </div>

      {/* MODAL: Access Token Setup */}
      {isTokenModalOpen && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-bg-card border border-border-base w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          >
            <div className="px-6 py-4.5 border-b border-border-base flex justify-between items-center">
              <h3 className="font-bold text-base text-text-base">Access Credentials</h3>
              <button onClick={() => setIsTokenModalOpen(false)} className="text-text-muted hover:text-text-base text-xl cursor-pointer">&times;</button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">MCP_AUTH_TOKEN</label>
                <input 
                  type="password" 
                  value={tempToken} 
                  onChange={e => setTempToken(e.target.value)} 
                  placeholder="Enter bearer secret token..." 
                  className="bg-bg-input border border-border-base rounded-xl px-4 py-3 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono mt-1"
                />
                <p className="text-[10px] text-text-muted leading-relaxed mt-2.5 font-semibold">
                  This bearer token validates administrative updates to your Cloudflare Worker. It is saved strictly in your local browser storage.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border-base bg-neutral-950/20 flex justify-end gap-3">
              <button onClick={() => setIsTokenModalOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition">Cancel</button>
              <button onClick={handleSaveToken} className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition">Save Secret</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* MODAL: Add Feed */}
      {isAddFeedOpen && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-bg-card border border-border-base w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          >
            <form onSubmit={handleAddFeed}>
              <div className="px-6 py-4.5 border-b border-border-base flex justify-between items-center">
                <h3 className="font-bold text-base text-text-base">Register RSS Feed</h3>
                <button type="button" onClick={() => setIsAddFeedOpen(false)} className="text-text-muted hover:text-text-base text-xl cursor-pointer">&times;</button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Feed Source URL</label>
                  <input 
                    type="url" 
                    value={addFeedUrl} 
                    onChange={e => setAddFeedUrl(e.target.value)} 
                    placeholder="https://example.com/rss.xml" 
                    className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono mt-1"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Friendly Title (Optional)</label>
                  <input 
                    type="text" 
                    value={addFeedTitle} 
                    onChange={e => setAddFeedTitle(e.target.value)} 
                    placeholder="e.g. Technology News" 
                    className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold mt-1"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border-base bg-neutral-950/20 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAddFeedOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition">Register</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: Register Chat */}
      {isAddChatOpen && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-bg-card border border-border-base w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          >
            <form onSubmit={handleAddChat}>
              <div className="px-6 py-4.5 border-b border-border-base flex justify-between items-center">
                <h3 className="font-bold text-base text-text-base">Register Telegram Target</h3>
                <button type="button" onClick={() => setIsAddChatOpen(false)} className="text-text-muted hover:text-text-base text-xl cursor-pointer">&times;</button>
              </div>
              <div className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Friendly Name (Internal identifier)</label>
                  <input 
                    type="text" 
                    value={chatName} 
                    onChange={e => setChatName(e.target.value)} 
                    placeholder="e.g. main_channel" 
                    className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold mt-1"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Telegram Chat ID (Numeric)</label>
                  <input 
                    type="text" 
                    value={chatIdVal} 
                    onChange={e => setChatIdVal(e.target.value)} 
                    placeholder="e.g. -100123456789" 
                    className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-mono mt-1"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Chat Type</label>
                  <select 
                    value={chatType} 
                    onChange={e => setChatType(e.target.value)} 
                    className="bg-bg-input border border-border-base rounded-xl px-4 py-3.5 text-sm text-text-base focus:outline-none focus:border-accent-primary font-semibold cursor-pointer mt-1"
                    required
                  >
                    <option value="channel">Channel</option>
                    <option value="group">Group</option>
                    <option value="private">Private Chat</option>
                    <option value="bot">Bot Direct Conversation</option>
                  </select>
                </div>
                <div className="flex items-center gap-3.5 mt-3 select-none cursor-pointer">
                  <input 
                    type="checkbox" 
                    id="modalChatDefault" 
                    checked={chatDefault} 
                    onChange={e => setChatDefault(e.target.checked)} 
                    className="w-4 h-4 rounded border-border-base bg-bg-input text-accent-primary focus:ring-0 focus:ring-offset-0 cursor-pointer"
                  />
                  <label htmlFor="modalChatDefault" className="text-xs text-text-base font-semibold cursor-pointer">Make this the default send target</label>
                </div>
              </div>
              <div className="px-6 py-4 border-t border-border-base bg-neutral-950/20 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAddChatOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition">Register</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* MODAL: Add Note */}
      {isAddNoteOpen && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-bg-card border border-border-base w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
          >
            <form onSubmit={handleAddNote}>
              <div className="px-6 py-4.5 border-b border-border-base flex justify-between items-center">
                <h3 className="font-bold text-base text-text-base">Add Recall Memory Note</h3>
                <button type="button" onClick={() => setIsAddNoteOpen(false)} className="text-text-muted hover:text-text-base text-xl cursor-pointer">&times;</button>
              </div>
              <div className="p-6 flex flex-col gap-4">
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
              </div>
              <div className="px-6 py-4 border-t border-border-base bg-neutral-950/20 flex justify-end gap-3">
                <button type="button" onClick={() => setIsAddNoteOpen(false)} className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition">Save Memory</button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

const formatDate = (unixSecs: number | null | undefined) => {
  if (!unixSecs) return 'Never';
  const date = new Date(unixSecs * 1000);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};
