import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from './context/AppContext';

// Layout & Shell Components
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';

// Tab Components
import { FeedsTab } from './components/tabs/FeedsTab';
import { ReaderTab } from './components/tabs/ReaderTab';
import { TelegramTab } from './components/tabs/TelegramTab';
import { SandboxTab } from './components/tabs/SandboxTab';
import { LogsTab } from './components/tabs/LogsTab';
import { PlaygroundTab } from './components/tabs/PlaygroundTab';
import { ChatTab } from './components/tabs/ChatTab';
import { InstancesTab } from './components/tabs/InstancesTab';
import { TestTab } from './components/tabs/TestTab';

// Common Components
import { Modal } from './components/common/Modal';
import { ToastContainer } from './components/common/ToastContainer';

export default function App() {
  const {
    activeTab,
    isLoading,
    isTokenModalOpen,
    setIsTokenModalOpen,
    tempToken,
    setTempToken,
    setToken,
    showToast
  } = useApp();

  const handleSaveToken = () => {
    setToken(tempToken);
    setIsTokenModalOpen(false);
    showToast('Access token updated!', 'success');
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'feeds':
        return <FeedsTab />;
      case 'reader':
        return <ReaderTab />;
      case 'telegram':
        return <TelegramTab />;
      case 'sandbox':
        return <SandboxTab />;
      case 'logs':
        return <LogsTab />;
      case 'playground':
        return <PlaygroundTab />;
      case 'chat':
        return <ChatTab />;
      case 'instances':
        return <InstancesTab />;
      case 'test':
        return <TestTab />;
      default:
        return <FeedsTab />;
    }
  };

  return (
    <div className="bg-glow-radial min-h-[100dvh] flex flex-col antialiased relative">
      {/* Visual textures - DOM Optimized */}
      <div className="mesh-grid absolute inset-0 z-0 pointer-events-none opacity-40" />
      <div className="grain-overlay" />

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Header */}
      <Header />

      {/* Main Container */}
      <div className="max-w-[1400px] w-full mx-auto px-8 py-10 flex-grow grid grid-cols-1 md:grid-cols-[auto_1fr] gap-12 z-10 relative">
        {/* Navigation Sidebar */}
        <Sidebar />

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

            {/* Render selected panel */}
            {!isLoading && renderActiveTab()}

          </AnimatePresence>
        </main>
      </div>

      {/* MODAL: Access Token Setup */}
      <Modal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        title="Access Credentials"
        footer={
          <>
            <button 
              onClick={() => setIsTokenModalOpen(false)} 
              className="px-4 py-2 rounded-xl text-xs font-bold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition"
            >
              Cancel
            </button>
            <button 
              onClick={handleSaveToken} 
              className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-primary text-white hover:bg-accent-primary-hover cursor-pointer transition"
            >
              Save Secret
            </button>
          </>
        }
      >
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
      </Modal>
    </div>
  );
}
