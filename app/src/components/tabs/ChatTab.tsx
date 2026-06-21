import { useState, useRef, useEffect } from 'react';
import { Robot, ArrowRight, Lightning } from '@phosphor-icons/react';
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
    if (chatBottomRef.current) chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isChatting]);

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;

    const userMsg = chatInput.trim();
    setChatInput('');

    const updatedMessages = [...chatMessages, { role: 'user' as const, content: userMsg }];
    setChatMessages(updatedMessages);
    setIsChatting(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          messages: updatedMessages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({ role: m.role, content: m.content }))
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
    <div className="h-full flex flex-col">
      {/* Agent header */}
      <div className="flex-none px-6 md:px-8 py-4 border-b border-line flex items-center gap-3.5 bg-surface">
        <div className="w-[38px] h-[38px] rounded-full bg-accent flex items-center justify-center text-onaccent flex-none">
          <Robot size={18} />
        </div>
        <div>
          <div className="font-display font-semibold text-[18px] text-ink leading-tight">The Feed Agent</div>
          <div className="font-mono text-[10px] text-ok">● online · 26 tools at hand</div>
        </div>
      </div>

      {/* Messages */}
      <div className="rr-scroll flex-1 min-h-0 px-6 md:px-14 py-8 flex flex-col gap-5">
        {chatMessages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          return (
            <div key={idx} className="mx-auto w-full max-w-[760px] flex flex-col gap-2.5">
              {isUser ? (
                <div className="self-end ml-auto max-w-[70%] bg-accent text-onaccent px-[18px] py-3.5 rounded-[18px_18px_4px_18px] text-[15px] leading-[1.55] whitespace-pre-wrap w-fit">
                  {msg.content}
                </div>
              ) : (
                <>
                  <div className="max-w-[80%] bg-surface border border-line text-ink px-[19px] py-[15px] rounded-[18px_18px_18px_4px] font-display text-[16px] leading-[1.6] whitespace-pre-wrap">
                    {msg.content}
                  </div>
                  {msg.toolsCalled && (
                    <div className="flex gap-2 flex-wrap">
                      {msg.toolsCalled.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-full bg-bg-base border border-line font-mono text-[11px] text-muted">
                          <Lightning size={11} weight="fill" className="text-accent" />
                          {t}
                          <span className="text-ok">✓</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
        {isChatting && (
          <div className="mx-auto w-full max-w-[760px] flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-[10px] text-accent font-mono animate-pulse">
              <Lightning size={11} weight="fill" />
              <span>Agent is reasoning and executing tools…</span>
            </div>
            <div className="max-w-[80%] bg-surface border border-dashed border-line text-muted px-[19px] py-[15px] rounded-[18px_18px_18px_4px] font-display text-[16px] animate-pulse">
              Thinking…
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* Composer */}
      <div className="flex-none px-6 md:px-14 pt-4 pb-6 flex justify-center">
        <form onSubmit={handleSendChatMessage} className="max-w-[760px] w-full flex items-center gap-2.5 pl-5 pr-2 py-2 rounded-2xl bg-surface border border-line-strong">
          <input
            type="text"
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            placeholder="Ask the agent to search, summarize, or post…"
            disabled={isChatting}
            className="flex-1 bg-transparent text-[15px] text-ink placeholder:text-muted focus:outline-none py-1.5"
          />
          <button
            type="submit"
            disabled={isChatting || !chatInput.trim()}
            className="btn-press w-10 h-10 rounded-xl bg-accent text-onaccent flex items-center justify-center cursor-pointer disabled:opacity-50 flex-none"
          >
            <ArrowRight size={17} weight="bold" />
          </button>
        </form>
      </div>
    </div>
  );
};
export default ChatTab;
