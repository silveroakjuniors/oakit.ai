/**
 * Student Module - Ask Oakie Tab Component
 * AI chat assistant interface
 */

import React from 'react';
import { Send, Loader2 } from 'lucide-react';
import { ChatMessage } from '../../types';

interface AskOakieTabProps {
  messages: ChatMessage[];
  input: string;
  loading: boolean;
  disabled: boolean;
  onInput: (value: string) => void;
  onSend: () => void;
  endRef: React.RefObject<HTMLDivElement>;
}

/**
 * Pure component for chat interface
 */
export const AskOakieTab = React.memo<AskOakieTabProps>(
  ({ messages, input, loading, disabled, onInput, onSend, endRef }) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSend();
      }
    };

    return (
      <div className="flex flex-col h-[calc(100vh-220px)] lg:h-[calc(100vh-120px)]">
        {/* Disabled during test warning */}
        {disabled && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-3 text-xs text-amber-700 font-medium">
            ⚠ Ask Oakie is disabled during an active test.
          </div>
        )}

        {/* Messages container */}
        <div className="flex-1 overflow-y-auto space-y-3 pb-2">
          {messages.map((msg, idx) => (
            <ChatBubble key={idx} message={msg} />
          ))}

          {/* Loading indicator */}
          {loading && <OakieLoadingBubble />}

          {/* Auto-scroll anchor */}
          <div ref={endRef} />
        </div>

        {/* Input area */}
        <div className="flex gap-2 pt-3 border-t border-neutral-100">
          <input
            value={input}
            onChange={(e) => onInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? 'Disabled during test' : 'Ask about a topic you studied…'}
            disabled={disabled || loading}
            maxLength={400}
            className="flex-1 px-4 py-2.5 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:bg-neutral-50 disabled:text-neutral-400"
            aria-label="Chat input"
          />
          <button
            onClick={onSend}
            disabled={disabled || loading || !input.trim()}
            className="w-10 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 flex items-center justify-center text-white transition-colors disabled:opacity-40"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    );
  }
);

AskOakieTab.displayName = 'AskOakieTab';

/**
 * Individual chat bubble
 */
interface ChatBubbleProps {
  message: ChatMessage;
}

const ChatBubble = React.memo<ChatBubbleProps>(({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-0.5">
          O
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-emerald-600 text-white rounded-br-sm'
            : 'bg-white border border-neutral-100 text-neutral-800 rounded-bl-sm shadow-sm'
        }`}
      >
        {message.text}
      </div>
    </div>
  );
});

ChatBubble.displayName = 'ChatBubble';

/**
 * Loading indicator for Oakie
 */
const OakieLoadingBubble = React.memo(() => (
  <div className="flex justify-start">
    <div className="w-7 h-7 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mr-2 mt-0.5">
      O
    </div>
    <div className="bg-white border border-neutral-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
      <Loader2 size={16} className="text-neutral-400 animate-spin" />
    </div>
  </div>
));

OakieLoadingBubble.displayName = 'OakieLoadingBubble';
