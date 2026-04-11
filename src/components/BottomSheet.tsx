import { useEffect, useMemo, useRef, useState } from "react";

type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxHeightClassName?: string;
};

const CLOSE_DISTANCE = 120;
const CLOSE_VELOCITY = 0.45;

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  maxHeightClassName = "max-h-[90vh]",
}: BottomSheetProps) {
  const [translateY, setTranslateY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startY: 0, startAt: 0, currentY: 0, currentAt: 0 });

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setTranslateY(0);
  }, [open]);

  const sheetStyle = useMemo(
    () => ({
      transform: `translateY(${translateY}px)`,
      transition: dragging ? "none" : "transform 200ms ease",
    }),
    [dragging, translateY],
  );

  const beginDrag = (clientY: number) => {
    dragRef.current.startY = clientY;
    dragRef.current.startAt = Date.now();
    dragRef.current.currentY = clientY;
    dragRef.current.currentAt = Date.now();
    setDragging(true);
  };

  const moveDrag = (clientY: number) => {
    if (!dragging) return;
    const distance = Math.max(0, clientY - dragRef.current.startY);
    setTranslateY(distance);
    dragRef.current.currentY = clientY;
    dragRef.current.currentAt = Date.now();
  };

  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    const distance = Math.max(0, dragRef.current.currentY - dragRef.current.startY);
    const elapsed = Math.max(1, dragRef.current.currentAt - dragRef.current.startAt);
    const velocity = distance / elapsed;
    if (distance >= CLOSE_DISTANCE || velocity > CLOSE_VELOCITY) {
      onClose();
      return;
    }
    setTranslateY(0);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/60">
      <button
        type="button"
        aria-label="关闭弹窗"
        className="absolute inset-0 h-full w-full cursor-default"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        style={sheetStyle}
        className={`relative z-10 overflow-hidden rounded-t-2xl bg-white shadow-sheetUp ${maxHeightClassName} flex flex-col`}
      >
        <div
          className="flex cursor-grab items-center justify-center py-2 active:cursor-grabbing"
          onPointerDown={(e) => beginDrag(e.clientY)}
          onPointerMove={(e) => moveDrag(e.clientY)}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        {title ? (
          <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100"
              onClick={onClose}
            >
              <span className="material-symbols-outlined text-slate-600">close</span>
            </button>
          </header>
        ) : null}

        <div className="no-scrollbar overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-slate-100 bg-white p-5">{footer}</div> : null}
      </section>
    </div>
  );
}

