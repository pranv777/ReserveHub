import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, children, confirmLabel, busy, onConfirm, onCancel }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div role="dialog" aria-modal="true" aria-labelledby="dialog-title" className="card w-full max-w-md">
        <h2 id="dialog-title" className="text-lg font-semibold">{title}</h2>
        <div className="mt-2 text-sm text-slate-700">{children}</div>
        <div className="mt-4 flex justify-end gap-2">
          <button ref={cancelRef} type="button" className="btn" onClick={onCancel} disabled={busy}>Keep it</button>
          <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
