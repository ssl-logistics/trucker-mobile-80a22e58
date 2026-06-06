import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface CachedQA {
  question: string;
  answer: string;
  timestamp: number;
}

const CACHE_KEY = "chatbot-qa-cache-v2";
const LEGACY_CACHE_KEY = "chatbot-qa-cache";
const SIMILARITY_THRESHOLD = 0.8;

// Simple similarity check using Levenshtein-like approach
function getSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 1;
  
  const words1 = s1.split(/\s+/);
  const words2 = s2.split(/\s+/);
  
  const commonWords = words1.filter(w => words2.includes(w));
  const totalWords = Math.max(words1.length, words2.length);
  
  return commonWords.length / totalWords;
}

function findCachedAnswer(question: string, cache: CachedQA[]): string | null {
  for (const item of cache) {
    if (getSimilarity(question, item.question) >= SIMILARITY_THRESHOLD) {
      return item.answer;
    }
  }
  return null;
}

function getCache(): CachedQA[] {
  try {
    // Clear legacy cache to avoid stale brand responses (TheTroob -> The Trucker)
    if (localStorage.getItem(LEGACY_CACHE_KEY)) {
      localStorage.removeItem(LEGACY_CACHE_KEY);
    }

    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

function saveToCache(question: string, answer: string) {
  const cache = getCache();
  // Check if similar question already exists
  const existingIndex = cache.findIndex(
    item => getSimilarity(question, item.question) >= SIMILARITY_THRESHOLD
  );
  
  if (existingIndex >= 0) {
    cache[existingIndex] = { question, answer, timestamp: Date.now() };
  } else {
    cache.push({ question, answer, timestamp: Date.now() });
  }
  
  // Keep only last 50 Q&A pairs
  const trimmedCache = cache.slice(-50);
  localStorage.setItem(CACHE_KEY, JSON.stringify(trimmedCache));
}

interface ChatbotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatbotDrawer({ open, onOpenChange }: ChatbotDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { t, language } = useLanguage();
  const { userType } = useAuth();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Add welcome message when opened
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: t('chatbot.welcome'),
          timestamp: Date.now(),
        },
      ]);
    }
  }, [open, messages.length]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Check cache first
      const cachedAnswer = findCachedAnswer(userMessage.content, getCache());
      
      if (cachedAnswer) {
        // Use cached answer
        const assistantMessage: Message = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: cachedAnswer,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, assistantMessage]);
        setIsLoading(false);
        return;
      }

      // Call AI if no cache hit
      const response = await supabase.functions.invoke("chatbot-assistant", {
        body: {
          messages: messages
            .filter(m => m.id !== "welcome")
            .concat(userMessage)
            .map(m => ({ role: m.role, content: m.content })),
          language,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const assistantContent = response.data?.content || t('chatbot.fallback');
      
      // Save to cache
      saveToCache(userMessage.content, assistantContent);

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantContent,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Chatbot error:", error);
      toast({
        title: t('chatbot.error'),
        description: t('chatbot.errorDesc'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[340px] w-[90%] h-[400px] flex flex-col p-0 gap-0 rounded-2xl border-0 overflow-hidden [&>button]:hidden">
        <DialogHeader className="px-4 py-3 flex-shrink-0 bg-secondary relative">
          <DialogTitle className="flex items-center gap-2 text-base text-white">
            <Bot className="w-5 h-5 text-white" />
            The Trucker
          </DialogTitle>
          <button 
            onClick={() => onOpenChange(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </DialogHeader>

        <ScrollArea className="flex-1 p-3" ref={scrollRef}>
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {message.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3.5 h-3.5 text-secondary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    message.role === "user"
                      ? "bg-secondary text-white"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
                {message.role === "user" && (
                  <div className="w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-secondary" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3.5 h-3.5 text-secondary" />
                </div>
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-secondary" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="p-3 border-t bg-background flex-shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={t('chatbot.placeholder')}
              disabled={isLoading}
              className="flex-1 h-9 text-sm"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-9 w-9 bg-secondary hover:bg-secondary/90 text-white"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
