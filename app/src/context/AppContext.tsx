/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import type { ApiResponse } from '../hooks/useApi';

export interface Toast {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

interface AppContextType {
  // Navigation & UI
  activeTab: string;
  setActiveTab: (tab: string) => void;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  theme: string;
  setTheme: (theme: string) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Authentication
  token: string;
  setToken: (token: string) => void;
  isAuthenticated: boolean | null;
  setIsAuthenticated: (auth: boolean | null) => void;
  isTokenModalOpen: boolean;
  setIsTokenModalOpen: (open: boolean) => void;
  tempToken: string;
  setTempToken: (token: string) => void;
  verifyToken: () => Promise<void>;

  // Toast Notifications
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type']) => void;
  removeToast: (id: number) => void;

  // Global API
  callApi: <T = any>(action: string, params?: any) => Promise<ApiResponse<T>>;
  isApiLoading: boolean;

  // Shared Data States
  feeds: any[];
  setFeeds: React.Dispatch<React.SetStateAction<any[]>>;
  channels: any[];
  setChannels: React.Dispatch<React.SetStateAction<any[]>>;
  categories: any[];
  setCategories: React.Dispatch<React.SetStateAction<any[]>>;
  chats: any[];
  setChats: React.Dispatch<React.SetStateAction<any[]>>;
  unreadItems: any[];
  setUnreadItems: React.Dispatch<React.SetStateAction<any[]>>;
  timeline: any[];
  setTimeline: React.Dispatch<React.SetStateAction<any[]>>;
  postLogs: any[];
  setPostLogs: React.Dispatch<React.SetStateAction<any[]>>;
  config: any;
  setConfigState: React.Dispatch<React.SetStateAction<any>>;

  // Shared Loader Functions
  loadFeeds: (silent?: boolean) => Promise<void>;
  loadChats: () => Promise<void>;
  loadReaderItems: () => Promise<void>;
  loadLogsAndConfig: () => Promise<void>;

  // Reader Filter Settings
  readerFeedFilter: string[];
  setReaderFeedFilter: (filter: string[]) => void;
  readerStatusFilter: 'unread' | 'read' | 'all';
  setReaderStatusFilter: (status: 'unread' | 'read' | 'all') => void;
  readerSearch: string;
  setReaderSearch: (search: string) => void;
  readerCategoryId: string;
  setReaderCategoryId: React.Dispatch<React.SetStateAction<string>>;

  // Category and View Filters
  feedViewFilter: 'all' | 'mcp' | 'telegram' | 'category';
  setFeedViewFilterState: React.Dispatch<React.SetStateAction<'all' | 'mcp' | 'telegram' | 'category'>>;
  selectedChannelId: string | null;
  setSelectedChannelIdState: React.Dispatch<React.SetStateAction<string | null>>;
  selectedFeedCategoryId: string | null;
  setSelectedFeedCategoryIdState: React.Dispatch<React.SetStateAction<string | null>>;
  categoryFeedIds: Record<string, string[]>;
  setCategoryFeedIds: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  
  setFeedViewFilter: (v: 'all' | 'mcp' | 'telegram' | 'category') => void;
  setSelectedFeedCategoryId: (id: string | null) => Promise<void>;
  setSelectedChannelId: (id: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const validTabs = ['feeds', 'reader', 'telegram', 'sandbox', 'logs', 'mcp', 'workflows', 'playground', 'chat', 'instances', 'test'];
  const [activeTab, setActiveTab] = useState(() => {
    const path = window.location.pathname.replace(/^\//, '').split('/')[0];
    return validTabs.includes(path) ? path : 'feeds';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [isLoading, setIsLoading] = useState(true);

  // Authentication
  const [token, setTokenState] = useState(() => localStorage.getItem('rss_mcp_auth_token') || '');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false);
  const [tempToken, setTempToken] = useState('');

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Feed/Category filters
  const [feedViewFilter, setFeedViewFilterState] = useState<'all' | 'mcp' | 'telegram' | 'category'>(
    () => (localStorage.getItem('rss_feed_filter') as 'all' | 'mcp' | 'telegram' | 'category') || 'all'
  );
  const [selectedChannelId, setSelectedChannelIdState] = useState<string | null>(
    () => localStorage.getItem('rss_channel_filter') || null
  );
  const [selectedFeedCategoryId, setSelectedFeedCategoryIdState] = useState<string | null>(
    () => localStorage.getItem('rss_category_filter') || null
  );
  const [categoryFeedIds, setCategoryFeedIds] = useState<Record<string, string[]>>({});

  // Data
  const [feeds, setFeeds] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [chats, setChats] = useState<any[]>([]);
  const [unreadItems, setUnreadItems] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [postLogs, setPostLogs] = useState<any[]>([]);
  const [config, setConfigState] = useState<any>({});

  // Reader Filters
  const [readerFeedFilter, setReaderFeedFilter] = useState<string[]>([]);
  const [readerStatusFilter, setReaderStatusFilter] = useState<'unread' | 'read' | 'all'>('unread');
  const [readerSearch, setReaderSearch] = useState('');
  const [readerCategoryId, setReaderCategoryId] = useState<string>('');

  // Toast Helpers
  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, [removeToast]);

  // API Client Hook
  const { callApi, isApiLoading } = useApi(token, (msg) => {
    setIsAuthenticated(false);
    showToast(msg, 'error');
    setIsTokenModalOpen(true);
  });

  const setToken = (newToken: string) => {
    localStorage.setItem('rss_mcp_auth_token', newToken.trim());
    setTokenState(newToken.trim());
  };

  // Filter Helpers
  const setFeedViewFilter = (v: 'all' | 'mcp' | 'telegram' | 'category') => {
    setFeedViewFilterState(v);
    localStorage.setItem('rss_feed_filter', v);
    if (v !== 'telegram') {
      setSelectedChannelIdState(null);
      localStorage.removeItem('rss_channel_filter');
    }
    if (v !== 'mcp' && v !== 'category') {
      setSelectedFeedCategoryIdState(null);
      localStorage.removeItem('rss_category_filter');
    }
  };

  const setSelectedFeedCategoryId = async (id: string | null) => {
    setSelectedFeedCategoryIdState(id);
    if (id) {
      localStorage.setItem('rss_category_filter', id);
      if (!categoryFeedIds[id]) {
        const res = await callApi('get_category_feeds', { categoryId: id });
        if (!res.error) setCategoryFeedIds(prev => ({ ...prev, [id]: (res.data || []).map((f: any) => f.id) }));
      }
    } else {
      localStorage.removeItem('rss_category_filter');
    }
  };

  const setSelectedChannelId = (id: string | null) => {
    setSelectedChannelIdState(id);
    if (id) localStorage.setItem('rss_channel_filter', id);
    else localStorage.removeItem('rss_channel_filter');
  };

  const verifyToken = useCallback(async () => {
    setIsLoading(true);
    const res = await callApi('get_config');
    if (res.error) {
      setIsAuthenticated(false);
    } else {
      setIsAuthenticated(true);
      setConfigState(res.data || {});
      
      // Prefetch common filters
      const [feedsRes, channelsRes, catsRes] = await Promise.all([
        callApi('list_feeds'),
        callApi('list_channels'),
        callApi('list_categories'),
      ]);
      if (!feedsRes.error) setFeeds(feedsRes.data || []);
      if (!channelsRes.error) setChannels(channelsRes.data || []);
      if (!catsRes.error) setCategories(catsRes.data || []);
    }
    setIsLoading(false);
  }, [callApi]);

  // Data Loading Helpers
  const loadFeeds = async (silent = false) => {
    if (!silent) setIsLoading(true);
    const [feedsRes, channelsRes, catsRes] = await Promise.all([
      callApi('list_feeds'),
      callApi('list_channels'),
      callApi('list_categories'),
    ]);
    if (!feedsRes.error) setFeeds(feedsRes.data || []);
    if (!channelsRes.error) setChannels(channelsRes.data || []);
    if (!catsRes.error) setCategories(catsRes.data || []);
    if (!silent) setIsLoading(false);
  };

  const loadChats = async () => {
    const res = await callApi('list_chats');
    if (!res.error) setChats(res.data || []);
  };

  const loadReaderItems = async () => {
    let res;
    const unreadOnly = readerStatusFilter === 'unread';
    const readOnly = readerStatusFilter === 'read';

    // Resolve feed IDs: explicit selection wins; otherwise use category filter (MCP mode only)
    let activeFeeds: string[] | undefined = readerFeedFilter.length > 0 ? readerFeedFilter : undefined;
    if (!activeFeeds && (feedViewFilter === 'mcp' || feedViewFilter === 'category') && readerCategoryId) {
      if (categoryFeedIds[readerCategoryId]) {
        activeFeeds = categoryFeedIds[readerCategoryId];
      } else {
        const catFeedsRes = await callApi('get_category_feeds', { categoryId: readerCategoryId });
        if (!catFeedsRes.error && catFeedsRes.data) {
          const ids = catFeedsRes.data.map((f: any) => f.id);
          setCategoryFeedIds(prev => ({ ...prev, [readerCategoryId]: ids }));
          activeFeeds = ids;
        }
      }
    }

    if (readerSearch.trim()) {
      res = await callApi('search_items', {
        query: readerSearch,
        feedId: activeFeeds,
        unreadOnly,
        readOnly,
        limit: 30
      });
    } else {
      res = await callApi('list_new_items', {
        feedId: activeFeeds,
        unreadOnly,
        readOnly,
        limit: 30
      });
    }
    if (!res.error) {
      setUnreadItems(res.data || []);
    }
  };

  const loadLogsAndConfig = async () => {
    const [recallRes, logsRes, configRes] = await Promise.all([
      callApi('recall', { limit: 20 }),
      callApi('list_post_log', { limit: 20 }),
      callApi('get_config')
    ]);

    if (!recallRes.error) setTimeline(recallRes.data || []);
    if (!logsRes.error) setPostLogs(logsRes.data || []);
    if (!configRes.error) setConfigState(configRes.data || {});
  };

  // Keep latest verifyToken in a ref so the effect below never needs it as a dep
  const verifyTokenRef = useRef(verifyToken);
  useEffect(() => {
    verifyTokenRef.current = verifyToken;
  }, [verifyToken]);

  // Token sync effect — only re-runs when token changes, not on every render
  useEffect(() => {
    const timer = setTimeout(() => {
      verifyTokenRef.current();
    }, 0);
    return () => clearTimeout(timer);
  }, [token]);

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

  const contextValue = useMemo(() => ({
    activeTab, setActiveTab, sidebarCollapsed, setSidebarCollapsed, theme, setTheme, isLoading, setIsLoading,
    token, setToken, isAuthenticated, setIsAuthenticated, isTokenModalOpen, setIsTokenModalOpen, tempToken, setTempToken, verifyToken,
    toasts, showToast, removeToast,
    callApi, isApiLoading,
    feeds, setFeeds, channels, setChannels, categories, setCategories, chats, setChats, unreadItems, setUnreadItems, timeline, setTimeline, postLogs, setPostLogs, config, setConfigState,
    loadFeeds, loadChats, loadReaderItems, loadLogsAndConfig,
    readerFeedFilter, setReaderFeedFilter, readerStatusFilter, setReaderStatusFilter, readerSearch, setReaderSearch, readerCategoryId, setReaderCategoryId,
    feedViewFilter, setFeedViewFilterState, selectedChannelId, setSelectedChannelIdState, selectedFeedCategoryId, setSelectedFeedCategoryIdState, categoryFeedIds, setCategoryFeedIds,
    setFeedViewFilter, setSelectedFeedCategoryId, setSelectedChannelId
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [
    activeTab, sidebarCollapsed, theme, isLoading,
    token, isAuthenticated, isTokenModalOpen, tempToken, verifyToken,
    toasts, callApi, isApiLoading,
    feeds, channels, categories, chats, unreadItems, timeline, postLogs, config,
    readerFeedFilter, readerStatusFilter, readerSearch, readerCategoryId,
    feedViewFilter, selectedChannelId, selectedFeedCategoryId, categoryFeedIds,
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
