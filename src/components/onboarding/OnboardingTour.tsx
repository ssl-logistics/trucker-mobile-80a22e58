import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight, ChevronLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  position?: "top" | "bottom" | "left" | "right";
}

interface OnboardingTourProps {
  steps: TourStep[];
  storageKey: string;
  onComplete?: () => void;
}

export const OnboardingTour = ({ steps, storageKey, onComplete }: OnboardingTourProps) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
   const [tooltipPosition, setTooltipPosition] = useState<{ top: number; left: number } | null>(null);
   const [highlightRect, setHighlightRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [hasCompleted, setHasCompleted] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const { t } = useLanguage();

  // Check if tour was completed before
  useEffect(() => {
    const completed = localStorage.getItem(storageKey);
    if (!completed) {
      // Delay start to let page render
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    } else {
      setHasCompleted(true);
    }
  }, [storageKey]);

  const updateTooltipPosition = useCallback(() => {
    if (!isVisible || !steps[currentStep]) return;

    const target = document.querySelector(steps[currentStep].target);
    if (!target) {
      console.log('[Tour] Target not found:', steps[currentStep].target);
      return;
    }

    // Clean up previous modifications
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    const rect = target.getBoundingClientRect();
     console.log('[Tour] Target rect:', { 
       target: steps[currentStep].target,
       top: rect.top, 
       bottom: rect.bottom, 
       left: rect.left, 
       right: rect.right,
       width: rect.width,
       height: rect.height
     });
     
    const position = steps[currentStep].position || "bottom";
    
    let top = 0;
    let left = 0;
     const tooltipWidth = 300;
     const tooltipHeight = 180; // Approximate tooltip height
     const gap = 16; // Gap between target and tooltip

    switch (position) {
      case "top":
         top = rect.top - tooltipHeight - gap;
         left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "bottom":
         top = rect.bottom + gap;
         left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
         top = rect.top + rect.height / 2 - tooltipHeight / 2;
         left = rect.left - tooltipWidth - gap;
        break;
      case "right":
         top = rect.top + rect.height / 2 - tooltipHeight / 2;
         left = rect.right + gap;
        break;
    }

    // Keep tooltip within viewport
     left = Math.max(16, Math.min(left, window.innerWidth - tooltipWidth - 16));
     top = Math.max(16, Math.min(top, window.innerHeight - tooltipHeight - 16));

     console.log('[Tour] Calculated tooltip position:', { top, left, position });
     
    setTooltipPosition({ top, left });

    // Handle overflow: hidden parents that would clip the highlight border
    let currentParent = target.parentElement;
    const parentsToRestore: Array<{ element: HTMLElement; overflow: string }> = [];
    
    while (currentParent && currentParent !== document.body) {
      const computedStyle = window.getComputedStyle(currentParent);
      if (computedStyle.overflow === 'hidden' || computedStyle.overflowY === 'hidden' || computedStyle.overflowX === 'hidden') {
        parentsToRestore.push({
          element: currentParent,
          overflow: currentParent.style.overflow || ''
        });
        // Use setProperty with important flag to override CSS classes
        currentParent.style.setProperty('overflow', 'visible', 'important');
      }
      currentParent = currentParent.parentElement;
    }

    // Make the target element appear above the overlay
    const targetElement = target as HTMLElement;
    const originalZIndex = targetElement.style.zIndex;
    const originalPosition = targetElement.style.position;
    
    targetElement.style.setProperty('z-index', '9999', 'important');
    targetElement.style.setProperty('position', 'relative', 'important');
    
     // Set highlight rectangle position with padding
     const highlightPadding = 6;
    setHighlightRect({
       top: rect.top - highlightPadding,
       left: rect.left - highlightPadding,
       width: rect.width + highlightPadding * 2,
       height: rect.height + highlightPadding * 2,
    });

    // Store cleanup function
    cleanupRef.current = () => {
      // Restore original overflow values
      parentsToRestore.forEach(({ element, overflow }) => {
        if (overflow) {
          element.style.setProperty('overflow', overflow);
        } else {
          element.style.removeProperty('overflow');
        }
      });
      // Restore target element styles
      if (originalZIndex) {
        targetElement.style.zIndex = originalZIndex;
      } else {
        targetElement.style.removeProperty('z-index');
      }
      if (originalPosition) {
        targetElement.style.position = originalPosition;
      } else {
        targetElement.style.removeProperty('position');
      }
    };
  }, [currentStep, isVisible, steps]);

  useEffect(() => {
     if (!isVisible) return;
     
     // Multiple attempts to ensure positioning works
     const updateWithRetry = () => {
      updateTooltipPosition();
     };
    
     // Initial update
     updateWithRetry();
     
     // Retry after short delays to handle async rendering
     const timer1 = setTimeout(updateWithRetry, 50);
     const timer2 = setTimeout(updateWithRetry, 150);
     const timer3 = setTimeout(updateWithRetry, 300);
    
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition);
    
    return () => {
       clearTimeout(timer1);
       clearTimeout(timer2);
       clearTimeout(timer3);
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition);
    };
   }, [updateTooltipPosition, isVisible, currentStep]);

   // Cleanup on unmount or when tour ends
  useEffect(() => {
     return () => {
       if (cleanupRef.current) {
         cleanupRef.current();
         cleanupRef.current = null;
       }
     };
   }, []);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Clean up before completing
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    localStorage.setItem(storageKey, "true");
    setIsVisible(false);
    setHasCompleted(true);
    onComplete?.();
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleRestart = () => {
    setCurrentStep(0);
    setIsVisible(true);
    setHasCompleted(false);
  };

  if (!isVisible) {
    return null;
  }

  const step = steps[currentStep];
  if (!step) return null;

   // Don't render until we have calculated positions
   if (!tooltipPosition || !highlightRect) {
     return (
       <div className="fixed inset-0 bg-black/50 z-[9998]" />
     );
   }
 
  // Create highlight element using portal to document.body
  const highlightElement = createPortal(
    <div
      className="pointer-events-none border-4 border-primary rounded-2xl"
      style={{
        position: 'fixed',
        top: highlightRect.top,
        left: highlightRect.left,
        width: highlightRect.width,
        height: highlightRect.height,
        zIndex: 10001,
        boxShadow: '0 0 0 4px hsl(var(--primary) / 0.3), 0 0 30px hsl(var(--primary) / 0.4), inset 0 0 0 2px hsl(var(--primary) / 0.5)',
        animation: 'tour-pulse 2s ease-in-out infinite',
      }}
    />,
    document.body
  );

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={handleSkip}
      />

      {/* Highlight Border via Portal */}
      {highlightElement}

      {/* Tooltip */}
      <div
         className="bg-card rounded-xl shadow-2xl border animate-in fade-in zoom-in-95 duration-300"
         style={{ 
           position: 'fixed',
           top: `${tooltipPosition.top}px`,
           left: `${tooltipPosition.left}px`,
           transform: 'none',
           margin: 0,
           width: '300px',
           zIndex: 10000,
         }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-primary font-bold text-sm">
                {currentStep + 1}
              </span>
            </div>
            <span className="text-xs text-muted-foreground">
              {currentStep + 1} / {steps.length}
            </span>
          </div>
          <button
            onClick={handleSkip}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-foreground mb-2">{step.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t bg-muted/30">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="text-xs"
          >
            ข้าม
          </Button>
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="text-xs"
              >
                <ChevronLeft className="w-3 h-3 mr-1" />
                ย้อนกลับ
              </Button>
            )}
            <Button
              size="sm"
              onClick={handleNext}
              className="text-xs"
            >
              {currentStep === steps.length - 1 ? "เสร็จสิ้น" : "ถัดไป"}
              {currentStep < steps.length - 1 && (
                <ChevronRight className="w-3 h-3 ml-1" />
              )}
            </Button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-1 pb-3">
          {steps.map((_, index) => (
            <div
              key={index}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                index === currentStep
                  ? "bg-primary w-4"
                  : index < currentStep
                  ? "bg-primary/50"
                  : "bg-muted-foreground/30"
              )}
            />
          ))}
        </div>
      </div>

      {/* Keyframe animation */}
      <style>{`
        @keyframes tour-pulse {
          0%, 100% {
            border-color: hsl(var(--primary));
            box-shadow: 0 0 0 4px hsl(var(--primary) / 0.3), 0 0 30px hsl(var(--primary) / 0.4);
          }
          50% {
            border-color: hsl(var(--primary) / 0.8);
            box-shadow: 0 0 0 6px hsl(var(--primary) / 0.2), 0 0 40px hsl(var(--primary) / 0.5);
          }
        }
      `}</style>
    </>
  );
};
