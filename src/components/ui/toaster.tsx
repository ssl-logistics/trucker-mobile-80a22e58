import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, className, ...props }) {
        const isRed = typeof className === "string" && className.includes("bg-red");
        return (
          <Toast 
            key={id} 
            variant={variant}
            className={className}
            {...props}
            onClick={() => dismiss(id)}
          >
            {variant === "destructive" ? (
              <AlertCircle className={`h-5 w-5 flex-shrink-0 ${isRed ? "text-white" : "text-red-500"}`} />
            ) : (
              <CheckCircle2 className={`h-5 w-5 flex-shrink-0 ${isRed ? "text-white" : "text-green-500"}`} />
            )}
            <div className="flex-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
