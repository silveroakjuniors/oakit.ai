/**
 * Student Module - Chat Hook
 * Manages chat messages and interactions
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

const INITIAL_MESSAGE: ChatMessage = {
  role: 'ai',
  text: "Hi! I'm Oakie 🌳 Ask me anything about topics your class has covered. I'm here to help you understand better!",
  ts: 0,
};

export interface UseChatReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  addMessage: (message: ChatMessage) => void;
  clearChat: () => void;
  endRef: React.RefObject<HTMLDivElement>;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const addMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const clearChat = useCallback(() => {
    setMessages([INITIAL_MESSAGE]);
    setInput('');
  }, []);

  return {
    messages,
    input,
    setInput,
    addMessage,
    clearChat,
    endRef,
  };
}
