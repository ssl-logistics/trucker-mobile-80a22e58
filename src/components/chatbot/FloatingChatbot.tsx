import { useState, useRef, useEffect } from "react";
import { Bot } from "lucide-react";
import { ChatbotDrawer } from "./ChatbotDrawer";

const POSITION_KEY = "chatbot-button-position";

interface Position {
  x: number;
  y: number;
}

// Safe zones - areas where the button can be dragged
const BOTTOM_NAV_HEIGHT = 70; // Bottom navigation height (matches actual nav height)
const BUTTON_SIZE = 48;

function getInitialPosition(): Position {
  try {
    const saved = localStorage.getItem(POSITION_KEY);
    if (saved) {
      const pos = JSON.parse(saved);
      // Validate position is within safe zones
      const maxX = window.innerWidth - BUTTON_SIZE;
      const maxY = window.innerHeight - BOTTOM_NAV_HEIGHT - BUTTON_SIZE;
      return {
        x: Math.min(Math.max(0, pos.x), maxX),
        y: Math.min(Math.max(0, pos.y), maxY),
      };
    }
  } catch {}
  // Default: bottom right (above bottom nav)
  return {
    x: window.innerWidth - 64,
    y: window.innerHeight - BOTTOM_NAV_HEIGHT - BUTTON_SIZE - 20,
  };
}

export function FloatingChatbot() {
  const [showChatbot, setShowChatbot] = useState(false);
  const [position, setPosition] = useState<Position>(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hasMoved = useRef(false);

  // Update position on window resize
  useEffect(() => {
    const handleResize = () => {
      const maxX = window.innerWidth - BUTTON_SIZE;
      const maxY = window.innerHeight - BOTTOM_NAV_HEIGHT - BUTTON_SIZE;
      setPosition(prev => ({
        x: Math.min(Math.max(0, prev.x), maxX),
        y: Math.min(Math.max(0, prev.y), maxY),
      }));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleStart = (clientX: number, clientY: number) => {
    hasMoved.current = false;
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startPosX: position.x,
      startPosY: position.y,
    };
    setIsDragging(true);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!dragRef.current) return;

    const deltaX = clientX - dragRef.current.startX;
    const deltaY = clientY - dragRef.current.startY;

    // Consider it a move if dragged more than 5px
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      hasMoved.current = true;
    }

    // Constrain to safe zones (avoid bottom nav only)
    const maxX = window.innerWidth - BUTTON_SIZE;
    const maxY = window.innerHeight - BOTTOM_NAV_HEIGHT - BUTTON_SIZE;

    const newX = Math.min(Math.max(0, dragRef.current.startPosX + deltaX), maxX);
    const newY = Math.min(Math.max(0, dragRef.current.startPosY + deltaY), maxY);

    setPosition({ x: newX, y: newY });
  };

  const handleEnd = () => {
    if (dragRef.current) {
      // Save position
      localStorage.setItem(POSITION_KEY, JSON.stringify(position));
    }
    dragRef.current = null;
    setIsDragging(false);
  };

  // Mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX, e.clientY);
      }
    };

    const handleMouseUp = () => {
      if (isDragging) {
        handleEnd();
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
    handleStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleMove(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  const handleClick = () => {
    // Only open chatbot if button wasn't dragged
    if (!hasMoved.current) {
      setShowChatbot(true);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleClick}
        className={`fixed z-[9999] w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center transition-shadow ${
          isDragging ? "shadow-xl scale-110" : "hover:shadow-xl"
        }`}
        style={{
          left: position.x,
          top: position.y,
          touchAction: "none",
          cursor: isDragging ? "grabbing" : "grab",
        }}
        aria-label="ผู้ช่วย AI"
      >
        <Bot className="w-6 h-6" />
      </button>

      <ChatbotDrawer open={showChatbot} onOpenChange={setShowChatbot} />
    </>
  );
}
