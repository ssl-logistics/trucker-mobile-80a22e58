import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, X, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

interface Position {
  x: number;
  y: number;
}

const CACHE_KEY = "chatbot-qa-cache";
const CHAT_POSITION_KEY = "chatbot-window-position";
const SIMILARITY_THRESHOLD = 0.8;
const WINDOW_WIDTH = 320;
const WINDOW_HEIGHT = 380;
const BOTTOM_NAV_HEIGHT = 80;

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
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : [];
  } catch {
    return [];
  }
}

function saveToCache(question: string, answer: string) {
  const cache = getCache();
  const existingIndex = cache.findIndex(
    item => getSimilarity(question, item.question) >= SIMILARITY_THRESHOLD
  );
  
  if (existingIndex >= 0) {
    cache[existingIndex] = { question, answer, timestamp: Date.now() };
  } else {
    cache.push({ question, answer, timestamp: Date.now() });
  }
  
  const trimmedCache = cache.slice(-50);
  localStorage.setItem(CACHE_KEY, JSON.stringify(trimmedCache));
}

function getInitialPosition(): Position {
  try {
    const saved = localStorage.getItem(CHAT_POSITION_KEY);
    if (saved) {
      const pos = JSON.parse(saved);
      const maxX = window.innerWidth - WINDOW_WIDTH;
      const maxY = window.innerHeight - WINDOW_HEIGHT - BOTTOM_NAV_HEIGHT;
      return {
        x: Math.min(Math.max(0, pos.x), maxX),
        y: Math.min(Math.max(0, pos.y), maxY),
      };
    }
  } catch {}
  // Default: bottom right
  return {
    x: window.innerWidth - WINDOW_WIDTH - 16,
    y: window.innerHeight - WINDOW_HEIGHT - BOTTOM_NAV_HEIGHT - 16,
  };
}

interface ChatbotDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatbotDrawer({ open, onOpenChange }: ChatbotDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [position, setPosition] = useState<Position>(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const { toast } = useToast();

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
          content: "สวัสดีครับ! ผมเป็นผู้ช่วย AI พร้อมตอบคำถามเกี่ยวกับแอปพลิเคชัน TheTroob ครับ มีอะไรให้ช่วยไหมครับ?",
          timestamp: Date.now(),
        },
      ]);
    }
  }, [open, messages.length]);

  // Update position on window resize
  useEffect(() => {
    const handleResize = () => {
      const maxX = window.innerWidth - WINDOW_WIDTH;
      const maxY = window.innerHeight - WINDOW_HEIGHT - BOTTOM_NAV_HEIGHT;
      setPosition(prev => ({
        x: Math.min(Math.max(0, prev.x), maxX),
        y: Math.min(Math.max(0, prev.y), maxY),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Drag handlers
  const handleDragStart = (clientX: number, clientY: number) => {
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
    setIsDragging(true);
  };

  const handleDragMove = (clientX: number, clientY: number) => {
    if (!dragRef.current) return;

    const deltaX = clientX - dragRef.current.startX;
    const deltaY = clientY - dragRef.current.startY;

    const maxX = window.innerWidth - WINDOW_WIDTH;
    const maxY = window.innerHeight - WINDOW_HEIGHT - BOTTOM_NAV_HEIGHT;

    const newX = Math.min(Math.max(0, dragRef.current.startPosX + deltaX), maxX);
    const newY = Math.min(Math.max(0, dragRef.current.startPosY + deltaY), maxY);

    setPosition({ x: newX, y: newY });
  };

  const handleDragEnd = () => {
    if (dragRef.current) {
      localStorage.setItem(CHAT_POSITION_KEY, JSON.stringify(position));
    }
    dragRef.current = null;
    setIsDragging(false);
  };

  // Mouse events for header drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleDragMove(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, position]);

  // Touch events
  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    handleDragEnd();
  };

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
      const cachedAnswer = findCachedAnswer(userMessage.content, getCache());
      
      if (cachedAnswer) {
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

      const response = await supabase.functions.invoke("chatbot-assistant", {
        body: {
          messages: messages
            .filter(m => m.id !== "welcome")
            .concat(userMessage)
            .map(m => ({ role: m.role, content: m.content })),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const assistantContent = response.data?.content || "ขออภัยครับ ไม่สามารถตอบคำถามได้ในขณะนี้";
      
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
        title: "เกิดข้อผิดพลาด",
        description: "ไม่สามารถส่งข้อความได้ กรุณาลองใหม่อีกครั้ง",
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

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/20 z-[9998]" 
        onClick={() => onOpenChange(false)}
      />
      
      {/* Chat Window */}
      <div
        className="fixed z-[9999] bg-background rounded-2xl shadow-2xl border flex flex-col overflow-hidden"
        style={{
          left: position.x,
          top: position.y,
          width: WINDOW_WIDTH,
          height: WINDOW_HEIGHT,
        }}
      >
        {/* Draggable Header */}
        <div
          className={`flex items-center justify-between px-3 py-2 border-b bg-primary text-primary-foreground rounded-t-2xl ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: "none" }}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 opacity-60" />
            <Bot className="w-5 h-5" />
            <span className="font-medium text-sm">ผู้ช่วย AI</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
            }}
            className="p-1 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Messages */}
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
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-3 h-3 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="text-xs whitespace-pre-wrap leading-relaxed">{message.content}</p>
                </div>
                {message.role === "user" && (
                  <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-3 h-3" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-2 border-t bg-background flex-shrink-0">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="พิมพ์ข้อความ..."
              disabled={isLoading}
              className="flex-1 h-8 text-xs"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-8 w-8"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
