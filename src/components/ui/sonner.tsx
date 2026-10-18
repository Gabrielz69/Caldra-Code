import { useEffect } from "react";
import { toast, Toaster as Sonner } from "sonner";
import { AudioManager } from "@/lib/audio/AudioManager";

// Vincula feedback sonoro sutil da CALDRA a notificações do sistema
if (typeof window !== "undefined") {
  const origSuccess = toast.success;
  const origError = toast.error;
  const origWarning = toast.warning;

  // Evita re-encapsulamento se já aplicado
  if (!(origSuccess as any).__caldra_audio) {
    const wrappedSuccess = ((...args: any[]) => {
      AudioManager.play("notify_success");
      return (origSuccess as any)(...args);
    }) as typeof toast.success;
    (wrappedSuccess as any).__caldra_audio = true;
    toast.success = wrappedSuccess;

    const wrappedError = ((...args: any[]) => {
      AudioManager.play("notify_error");
      return (origError as any)(...args);
    }) as typeof toast.error;
    (wrappedError as any).__caldra_audio = true;
    toast.error = wrappedError;

    const wrappedWarning = ((...args: any[]) => {
      AudioManager.play("notify_warning");
      return (origWarning as any)(...args);
    }) as typeof toast.warning;
    (wrappedWarning as any).__caldra_audio = true;
    toast.warning = wrappedWarning;
  }
}

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
