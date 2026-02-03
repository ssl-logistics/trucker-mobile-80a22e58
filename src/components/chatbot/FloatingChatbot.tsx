import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Bot } from "lucide-react";
import { ChatbotDrawer } from "./ChatbotDrawer";

export function FloatingChatbot() {
  const [showChatbot, setShowChatbot] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  return (
    <>
      {mounted && createPortal(buttonContent, document.body)}
      <ChatbotDrawer open={showChatbot} onOpenChange={setShowChatbot} />
    </>
  );
}
