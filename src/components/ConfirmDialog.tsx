import { useEffect } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** primary：主题色（与 `tailwind` 的 `primary` 一致）；danger：#FA5151（删除等危险操作） */
  confirmVariant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

/** 对齐微信原生 showModal：白底圆角、灰底遮罩、内容区与底部双栏按钮 */
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

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-10 font-display"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="关闭"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "confirm-dialog-title" : undefined}
        className="relative z-10 w-full max-w-[300px] overflow-hidden rounded-[12px] bg-white shadow-xl"
      >
        <div className="px-6 pb-5 pt-7 text-center">
          {title ? (
            <h2
              id="confirm-dialog-title"
              className="text-[17px] font-semibold leading-snug text-black"
            >
              {title}
            </h2>
          ) : null}
          <p
            className={[
              "text-[15px] font-normal leading-[1.45] text-[#666666]",
              title ? "mt-3" : "",
            ].join(" ")}
          >
            {message}
          </p>
        </div>

        <div className="flex border-t border-solid border-[#E5E5E5]">
          <button
            type="button"
            className="flex-1 border-r border-solid border-[#E5E5E5] bg-white py-3.5 text-[17px] font-semibold text-black transition-colors active:bg-black/[0.04]"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={[
              "flex-1 bg-white py-3.5 text-[17px] font-semibold transition-colors active:bg-black/[0.04]",
              confirmVariant === "danger" ? "text-[#FA5151]" : "text-primary",
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
