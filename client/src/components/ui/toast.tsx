import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

/**
 * Minimal Radix Toast setup in BookLeaf tokens. Call `useToast()` anywhere
 * under <ToastProvider> to confirm an action ("Reply sent", "Draft ready").
 */
interface ToastItem {
  id: number;
  title: string;
  description?: string;
}

const ToastCtx = createContext<{ toast: (title: string, description?: string) => void }>({ toast: () => {} });

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((title: string, description?: string) => {
    const id = Date.now() + Math.random();
    setItems((current) => [...current, { id, title, description }]);
  }, []);

  return (
    <ToastCtx.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right" duration={4000}>
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            onOpenChange={(open) => {
              if (!open) setItems((current) => current.filter((t) => t.id !== item.id));
            }}
            className="rounded-lg border border-line bg-card px-4 py-3 shadow-[0_8px_24px_rgba(35,32,27,0.14)]"
          >
            <ToastPrimitive.Title className="text-sm font-semibold text-ink">{item.title}</ToastPrimitive.Title>
            {item.description && (
              <ToastPrimitive.Description className="mt-0.5 text-sm text-ink-soft">
                {item.description}
              </ToastPrimitive.Description>
            )}
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 p-4" />
      </ToastPrimitive.Provider>
    </ToastCtx.Provider>
  );
}
