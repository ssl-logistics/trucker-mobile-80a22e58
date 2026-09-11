import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Bot, MessageCircle } from "lucide-react";
import { ChatbotDrawer } from "./ChatbotDrawer";
import { ChatListSheet } from "@/components/chat/ChatListSheet";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserRole } from "@/hooks/useUserRole";

// Pages that show the bottom navigation bar
const PAGES_WITH_NAV = ["/home", "/chat", "/dashboard", "/settings"];

export function FloatingChatbot() {
  const [showChatbot, setShowChatbot] = useState(false);
  const [showChatList, setShowChatList] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [enabled, setEnabled] = useState(() => localStorage.getItem('chatbot_enabled') !== 'false');
  const location = useLocation();
  const { t } = useLanguage();
  const { isFreelanceDriver } = useUserRole();

  // Only show on pages with bottom navigation
  const shouldShow = PAGES_WITH_NAV.includes(location.pathname);

  useEffect(() => {
    setMounted(true);
    const handler = () => setEnabled(localStorage.getItem('chatbot_enabled') !== 'false');
    window.addEventListener('chatbot-toggle', handler);
    return () => window.removeEventListener('chatbot-toggle', handler);
  }, []);

  const chatButtonContent = (
    <button
      onClick={() => setShowChatList(true)}
      style={{
        position: "fixed",
        right: 16,
        bottom: 96,
        zIndex: 9998,
        width: 48,
        height: 48,
        borderRadius: "50%",
        backgroundColor: "hsl(var(--secondary))",
        color: "#ffffff",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        cursor: "pointer",
        transform: "translate3d(0, 0, 0)",
        WebkitTransform: "translate3d(0, 0, 0)",
      }}
      aria-label={t('nav.chat')}
    >
      <MessageCircle style={{ width: 24, height: 24 }} />
    </button>
  );

  const botButtonContent = (
    <button
      onClick={() => setShowChatbot(true)}
      style={{
        position: "fixed",
        right: 16,
        bottom: 96,
        zIndex: 9998,
        width: 48,
        height: 48,
        borderRadius: "50%",
        backgroundColor: "hsl(var(--secondary))",
        color: "#ffffff",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        cursor: "pointer",
        transform: "translate3d(0, 0, 0)",
        WebkitTransform: "translate3d(0, 0, 0)",
      }}
      aria-label={t('chatbot.title')}
    >
      <Bot style={{ width: 24, height: 24 }} />
    </button>
  );

  // Freelance chat icon is always visible; bot icon follows page + toggle rules
  if (isFreelanceDriver ? false : (!shouldShow || !enabled)) {
    return null;
  }

  return (
    <>
      {mounted && createPortal(
        isFreelanceDriver ? chatButtonContent : botButtonContent,
        document.body
      )}
      {!isFreelanceDriver && <ChatbotDrawer open={showChatbot} onOpenChange={setShowChatbot} />}
      {isFreelanceDriver && <ChatListSheet open={showChatList} onOpenChange={setShowChatList} />}
    </>
  );
}
