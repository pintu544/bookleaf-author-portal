import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactNode } from "react";

/**
 * Radix Dialog in BookLeaf tokens — used for the AI draft review, a task
 * that genuinely benefits from protected focus before text lands in the
 * reply box.
 */
export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export const DialogContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { title: string; description?: string; children: ReactNode }
>(({ title, description, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/40" />
    <DialogPrimitive.Content
      ref={ref}
      className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-xl border border-line bg-card p-6 shadow-[0_16px_40px_rgba(35,32,27,0.2)]"
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <DialogPrimitive.Title className="font-display text-lg font-semibold text-ink">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-1 text-sm leading-relaxed text-ink-soft">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
        <DialogPrimitive.Close
          aria-label="Close"
          className="rounded-md p-1.5 text-ink-soft hover:bg-paper-deep hover:text-ink"
        >
          <X className="h-4 w-4" />
        </DialogPrimitive.Close>
      </div>
      <div className="mt-4">{children}</div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = "DialogContent";
