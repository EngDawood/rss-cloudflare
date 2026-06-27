import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from './context/AppContext';

// Layout & Shell Components
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';

// Tab Components
import { FeedsTab } from './components/tabs/FeedsTab';
import { ReaderTab } from './components/tabs/ReaderTab';
import { TelegramTab } from './components/tabs/TelegramTab';
import { FoloTab } from './components/tabs/FoloTab';
import { SandboxTab } from './components/tabs/SandboxTab';
import { LogsTab } from './components/tabs/LogsTab';
import { PlaygroundTab } from './components/tabs/PlaygroundTab';
import { ChatTab } from './components/tabs/ChatTab';
import { InstancesTab } from './components/tabs/InstancesTab';
import { TestTab } from './components/tabs/TestTab';
import { McpTab } from './components/tabs/McpTab';
import { WorkflowsTab } from './components/tabs/WorkflowsTab';
import { BundlesTab } from './components/tabs/BundlesTab';

// Common Components
import { Modal } from './components/common/Modal';
import { ToastContainer } from './components/common/ToastContainer';

export default function App() {
  const {
    activeTab,
    isLoading,
    isAuthenticated,
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
      case 'folo':
        return <FoloTab />;
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
      case 'mcp':
        return <McpTab />;
      case 'workflows':
        return <WorkflowsTab />;
      case 'bundles':
        return <BundlesTab />;
      case 'test':
        return <TestTab />;
      default:
        return <FeedsTab />;
    }
  };

  return (
    <div className="rr-app bg-bg-base text-text-base h-[100dvh] flex antialiased relative overflow-hidden">
      {/* Visual textures */}
      <div className="mesh-grid absolute inset-0 z-0 pointer-events-none opacity-50" />
      <div className="grain-overlay" />

      {/* Toast Notifications */}
      <ToastContainer />

      {/* Navigation Sidebar (full height) */}
      <Sidebar />

      {/* Main column */}
      <div className="flex-1 min-w-0 flex flex-col relative z-10">
        <Header />

        <main className="flex-1 min-h-0 relative bg-bg-base">
          <AnimatePresence mode="wait">

            {/* SKELETON LOADER */}
            {isLoading && (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 rr-scroll flex flex-col gap-6 px-10 py-8"
              >
                <div className="h-10 w-1/3 bg-surface rounded-xl animate-pulse" />
                <div className="p-8 rounded-2xl border border-border-base bg-surface/60 flex flex-col gap-4 animate-pulse">
                  <div className="h-5 w-full bg-surface-2 rounded-lg" />
                  <div className="h-5 w-3/4 bg-surface-2 rounded-lg" />
                  <div className="h-5 w-5/6 bg-surface-2 rounded-lg" />
                </div>
              </motion.div>
            )}

            {/* Unauthenticated gate */}
            {!isLoading && isAuthenticated === false && (
              <motion.div
                key="locked"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-5 text-center px-8"
              >
                <div className="w-[76px] h-[76px] rounded-full bg-surface border border-border-base flex items-center justify-center text-accent text-3xl">🔒</div>
                <div>
                  <div className="font-display font-semibold text-2xl text-ink mb-1.5">Access restricted</div>
                  <p className="text-muted text-sm max-w-sm leading-relaxed">Enter your bearer token to read and manage the Reading Room.</p>
                </div>
                <button
                  onClick={() => setIsTokenModalOpen(true)}
                  className="btn-press px-5 py-2.5 rounded-full text-[13px] font-semibold bg-accent text-onaccent hover:bg-accent-primary-hover transition cursor-pointer"
                >
                  Enter Token
                </button>
              </motion.div>
            )}

            {/* Render selected panel */}
            {!isLoading && isAuthenticated === true && (
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="absolute inset-0"
              >
                {renderActiveTab()}
              </motion.div>
            )}

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
              className="btn-press px-4 py-2 rounded-full text-xs font-semibold bg-bg-input border border-border-base text-text-muted hover:text-text-base cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveToken}
              className="btn-press px-4 py-2 rounded-full text-xs font-semibold bg-accent text-onaccent hover:bg-accent-primary-hover cursor-pointer transition"
            >
              Save Secret
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-muted uppercase tracking-[0.14em] font-mono">MCP_AUTH_TOKEN</label>
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
