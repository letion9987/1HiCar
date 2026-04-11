import type { ReactNode } from "react";
import { useEffect, useMemo, useRef } from "react";

export type WheelItem<T extends string | number> = {
  value: T;
  label: ReactNode;
};

type WheelColumnProps<T extends string | number> = {
  items: WheelItem<T>[];
  selected: T;
  onChange: (value: T) => void;
  heightClassName?: string; // outer fixed height (e.g. h-44)
  itemHeightPx?: number; // default 48 (h-12)
  disabled?: boolean;
};

const DEFAULT_ITEM_HEIGHT_PX = 48;

export default function WheelColumn<T extends string | number>({
  items,
  selected,
  onChange,
  heightClassName = "h-44",
  itemHeightPx = DEFAULT_ITEM_HEIGHT_PX,
  disabled,
}: WheelColumnProps<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastIndexRef = useRef<number>(-1);

  const selectedIndex = useMemo(() => {
    return Math.max(
      0,
      items.findIndex((it) => it.value === selected),
    );
  }, [items, selected]);

  // Sync scroll position to the selected item (so center is always selected).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = items.findIndex((it) => it.value === selected);
    if (idx < 0) return;
    el.scrollTop = idx * itemHeightPx;
    lastIndexRef.current = idx;
  }, [items, itemHeightPx, selected]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el || disabled) return;

    // With py-16 (64px) on the scroll container, the center aligns when scrollTop ~= index*itemHeight.
    const rawIndex = el.scrollTop / itemHeightPx;
    const nextIndex = Math.max(0, Math.min(items.length - 1, Math.round(rawIndex)));
    if (nextIndex === lastIndexRef.current) return;
    lastIndexRef.current = nextIndex;
    const item = items[nextIndex];
    if (item) onChange(item.value);
  };

  return (
    <div className={`relative ${heightClassName} overflow-hidden`}>
      {/* 固定在列中线的一行选中背景：不随列表滚动，与 stitch/_1 每行 h-12 + bg-primary/10 + rounded-lg 一致 */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-1/2 z-0 -translate-y-1/2 rounded-lg bg-primary/10"
        style={{ height: itemHeightPx }}
        aria-hidden
      />

      <div
        ref={scrollRef}
        onScroll={() => {
          // Small microtask debounce via rAF to avoid too frequent setState.
          requestAnimationFrame(handleScroll);
        }}
        className="relative z-10 no-scrollbar h-full overflow-y-auto py-16"
      >
        <div className="flex flex-col">
          {items.map((item) => {
            const active = item.value === selected;
            return (
              <button
                key={String(item.value)}
                type="button"
                onClick={() => onChange(item.value)}
                disabled={disabled}
                className="flex h-12 w-full items-center justify-center"
              >
                <span
                  className={
                    active
                      ? "text-lg font-bold text-primary"
                      : "text-sm font-medium text-slate-400"
                  }
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

