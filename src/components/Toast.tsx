"use client";

export interface ToastAction {
  label: string;
  onClick: () => void;
  testId?: string;
}

export interface ToastState {
  message: string;
  tone?: "info" | "error";
  actions?: ToastAction[];
}

/** Subtle bottom-center terminal notice. */
export function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
      <div
        role="status"
        data-testid="toast"
        className="pointer-events-auto flex max-w-xl animate-fade-in flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-text-muted/30 bg-bg-surface px-4 py-2 text-sm"
      >
        <span className="text-accent">~$</span>
        <span className={toast.tone === "error" ? "text-error" : "text-text-primary"}>{toast.message}</span>
        {toast.actions?.map((action) => (
          <button
            key={action.label}
            type="button"
            data-testid={action.testId}
            onClick={action.onClick}
            className="rounded px-1 text-accent outline-none hover:text-text-primary focus-visible:bg-bg-primary/60"
          >
            [{action.label}]
          </button>
        ))}
      </div>
    </div>
  );
}
