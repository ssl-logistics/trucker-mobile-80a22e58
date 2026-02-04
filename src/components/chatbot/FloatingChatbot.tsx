import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Bot } from "lucide-react";
import { ChatbotDrawer } from "./ChatbotDrawer";

// Pages that show the bottom navigation bar
const PAGES_WITH_NAV = ["/home", "/chat", "/dashboard", "/settings"];

export function FloatingChatbot() {
  const [showChatbot, setShowChatbot] = useState(false);
  const [mounted, setMounted] = useState(false);
  const location = useLocation();

  // Only show on pages with bottom navigation
  const shouldShow = PAGES_WITH_NAV.includes(location.pathname);

  useEffect(() => {
    setMounted(true);
  }, []);

  const buttonContent = (
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
      aria-label="ผู้ช่วย AI"
    >
      <Bot style={{ width: 24, height: 24 }} />
    </button>
  );

  // Don't render if not on a main page
  if (!shouldShow) {
    return null;
  }

  return (
    <>
      {mounted && createPortal(buttonContent, document.body)}
      <ChatbotDrawer open={showChatbot} onOpenChange={setShowChatbot} />
    </>
  );
}
