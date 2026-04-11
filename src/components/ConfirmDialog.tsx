import { useEffect } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** primary：品牌绿；danger：删除类操作 */
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "确定",
  cancelLabel = "取消",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const confirmClass =
    confirmVariant === "danger"
      ? "border border-red-200 bg-white text-red-600 hover:bg-red-50"
      : "bg-primary text-white shadow-md shadow-primary/20 hover:brightness-105";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 font-display"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="关闭"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "confirm-dialog-title" : undefined}
        className="relative z-10 w-full max-w-[320px] rounded-2xl bg-white p-6 shadow-2xl"
      >
        {title ? (
          <h2 id="confirm-dialog-title" className="text-lg font-bold text-slate-900">
            {title}
          </h2>
        ) : null}
        <p
          className={[
            "text-sm leading-relaxed text-slate-600",
            title ? "mt-3" : "",
          ].join(" ")}
        >
          {message}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 transition-colors active:bg-slate-50"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={[
              "flex-1 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98]",
              confirmClass,
            ].join(" ")}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
