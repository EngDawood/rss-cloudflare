import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Terminal, ArrowRight } from '@phosphor-icons/react';
import { useApp } from '../../context/AppContext';

export const ChatTab: React.FC = () => {
  const { token, showToast } = useApp();
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; toolsCalled?: string[] }>>([
    { role: 'assistant', content: 'Hi there! I am your RSS & MCP Agent. You can ask me to list your feeds, check for unread articles, search for posts, or save notes. How can I help you today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatting]);

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

  return (
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
  );
};
export default ChatTab;
