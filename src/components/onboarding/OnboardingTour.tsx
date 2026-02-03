import { useState, useEffect, useCallback } from "react";
import { X, ChevronRight, ChevronLeft, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

interface TourStep {
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
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [hasCompleted, setHasCompleted] = useState(false);
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
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const position = steps[currentStep].position || "bottom";
    
    let top = 0;
    let left = 0;

    switch (position) {
      case "top":
        top = rect.top - 120;
        left = rect.left + rect.width / 2 - 150;
        break;
      case "bottom":
        top = rect.bottom + 12;
        left = rect.left + rect.width / 2 - 150;
        break;
      case "left":
        top = rect.top + rect.height / 2 - 60;
        left = rect.left - 320;
        break;
      case "right":
        top = rect.top + rect.height / 2 - 60;
        left = rect.right + 12;
        break;
    }

    // Keep tooltip within viewport
    left = Math.max(16, Math.min(left, window.innerWidth - 320));
    top = Math.max(16, Math.min(top, window.innerHeight - 150));

    setTooltipPosition({ top, left });

    // Highlight the target element
    target.classList.add("tour-highlight");
    return () => target.classList.remove("tour-highlight");
  }, [currentStep, isVisible, steps]);

  useEffect(() => {
    updateTooltipPosition();
    window.addEventListener("resize", updateTooltipPosition);
    window.addEventListener("scroll", updateTooltipPosition);
    
    return () => {
      window.removeEventListener("resize", updateTooltipPosition);
      window.removeEventListener("scroll", updateTooltipPosition);
      // Clean up highlight
      const target = document.querySelector(steps[currentStep]?.target);
      if (target) target.classList.remove("tour-highlight");
    };
  }, [updateTooltipPosition, steps, currentStep]);

  const handleNext = () => {
    // Remove highlight from current
    const currentTarget = document.querySelector(steps[currentStep]?.target);
    if (currentTarget) currentTarget.classList.remove("tour-highlight");

    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    // Remove highlight from current
    const currentTarget = document.querySelector(steps[currentStep]?.target);
    if (currentTarget) currentTarget.classList.remove("tour-highlight");

    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(storageKey, "true");
    setIsVisible(false);
    setHasCompleted(true);
    onComplete?.();
  };

  const handleSkip = () => {
    // Remove all highlights
    document.querySelectorAll(".tour-highlight").forEach(el => {
      el.classList.remove("tour-highlight");
    });
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

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-[9998]"
        onClick={handleSkip}
      />

      {/* Tooltip */}
      <div
        className="fixed z-[9999] w-[300px] bg-card rounded-xl shadow-2xl border animate-in fade-in zoom-in-95 duration-300"
        style={{ top: tooltipPosition.top, left: tooltipPosition.left }}
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

      {/* Global styles for highlighting */}
      <style>{`
        .tour-highlight {
          position: relative;
          z-index: 9999 !important;
          box-shadow: 0 0 0 4px hsl(var(--primary) / 0.3), 0 0 20px hsl(var(--primary) / 0.2);
          border-radius: 8px;
        }
      `}</style>
    </>
  );
};
