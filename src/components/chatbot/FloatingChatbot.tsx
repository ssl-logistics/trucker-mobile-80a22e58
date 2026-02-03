import { useState } from "react";
import { Bot } from "lucide-react";
import { ChatbotDrawer } from "./ChatbotDrawer";

export function FloatingChatbot() {
  const [showChatbot, setShowChatbot] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowChatbot(true)}
        className="fixed right-4 bottom-24 z-[9998] w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:shadow-xl transition-shadow"
        aria-label="ผู้ช่วย AI"
      >
        <Bot className="w-6 h-6" />
      </button>

      <ChatbotDrawer open={showChatbot} onOpenChange={setShowChatbot} />
    </>
  );
}
