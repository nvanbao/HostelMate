import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2 } from 'lucide-react';
import { sendAiMessage } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function AiChatbot() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ id: string; role: 'user' | 'ai'; content: string }[]>([
    {
      id: '1',
      role: 'ai',
      content: user?.role === 'ADMIN' 
        ? 'Xin chào Chủ nhà! Tôi có thể giúp gì cho bạn hôm nay? (VD: Hướng dẫn quản lý khách thuê, thống kê phòng...)'
        : 'Xin chào! Tôi là trợ lý ảo HostelMate. Bạn muốn tìm phòng hay cần hỗ trợ gì ạ?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  if (!user) return null;

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { id: Date.now().toString(), role: 'user' as const, content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const historyForApi = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await sendAiMessage(userMessage.content, user.role, user.tenant_id || undefined, historyForApi);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: res.reply }]);
    } catch (error: any) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', content: error.message || 'Xin lỗi, tôi đang gặp sự cố kết nối. Vui lòng thử lại sau nhé!' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Chat Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-white/50 backdrop-blur-2xl text-[#007AFF] border border-white/60 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:bg-white/60 transition-all duration-300 flex items-center justify-center z-50 ${isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100 hover:-translate-y-1'}`}
      >
        <MessageSquare className="w-6 h-6" />
      </button>

      {/* Chat Window */}
      <div
        className={`fixed bottom-6 right-6 w-[380px] h-[600px] bg-white/40 backdrop-blur-[40px] rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-white/60 flex flex-col overflow-hidden transition-all duration-300 z-50 origin-bottom-right ${isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'}`}
      >
        {/* Header */}
        <div className="bg-white/40 backdrop-blur-xl border-b border-black/5 px-5 py-4 flex items-center justify-between shadow-sm z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-[#007AFF] to-[#5AC8FA] rounded-full flex items-center justify-center shadow-inner">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-[17px] text-black tracking-tight leading-tight">Trợ lý AI</h3>
              <p className="text-[#007AFF] text-xs font-medium mt-0.5">Trực tuyến</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="w-8 h-8 flex items-center justify-center bg-black/5 hover:bg-black/10 rounded-full transition-colors text-black/60">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-transparent [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-black/10 [&::-webkit-scrollbar-thumb]:rounded-full">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`p-3.5 rounded-[22px] backdrop-blur-md shadow-sm ${msg.role === 'user' ? 'bg-[#007AFF] text-white rounded-tr-[6px]' : 'bg-white/80 text-black border border-white/60 rounded-tl-[6px]'}`}>
                <div className={`text-[15px] prose prose-sm prose-p:leading-relaxed max-w-none ${msg.role === 'user' ? 'text-white' : 'text-black prose-pre:bg-black/5 prose-pre:text-black prose-th:bg-black/5 prose-td:border-black/10'}`}>
                  {msg.role === 'user' ? (
                    msg.content
                  ) : (
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                  )}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2 max-w-[85%]">
              <div className="px-4 py-3 bg-white/80 backdrop-blur-md border border-white/60 shadow-sm rounded-[22px] rounded-tl-[6px] text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#007AFF]" /> Đang suy nghĩ...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 bg-white/40 backdrop-blur-2xl border-t border-black/5 relative z-10">
          <form onSubmit={handleSend} className="flex items-center gap-2 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="iMessage"
              className="flex-1 bg-white/60 backdrop-blur-xl border border-black/5 text-black text-[15px] rounded-full pl-5 pr-12 py-2.5 focus:bg-white/80 transition-all shadow-inner outline-none placeholder-black/40"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="absolute right-1.5 w-8 h-8 bg-[#007AFF] text-white rounded-full flex items-center justify-center hover:bg-[#007AFF]/90 transition-all disabled:opacity-50 disabled:scale-90 disabled:cursor-not-allowed shadow-sm"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
