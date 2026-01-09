import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
import { CheckCircle2, AlertCircle } from "lucide-react";

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast 
            key={id} 
            variant={variant}
            {...props}
            onClick={() => dismiss(id)}
          >
            {variant === "destructive" ? (
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
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
