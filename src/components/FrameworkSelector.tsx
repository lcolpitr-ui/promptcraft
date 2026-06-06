import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useAppStore } from "../stores/appStore";
import { FRAMEWORKS } from "../lib/frameworks";
import { Zap, ChevronDown, Check } from "lucide-react";

export function FrameworkSelector() {
  const { frameworkMode, selectedFramework, setFrameworkMode, selectFramework } = useAppStore();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 计算下拉菜单位置
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left
      });
    }
  };

  // 点击外部关闭
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    updatePosition();
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  const dropdown = isOpen ? createPortal(
    <div
      ref={dropdownRef}
      className="fixed max-h-[60vh] w-80 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-lg border border-border bg-background shadow-2xl"
      style={{ top: position.top, left: Math.max(8, Math.min(position.left, window.innerWidth - 328)), zIndex: 9999, backgroundColor: 'var(--background)', backdropFilter: 'none' }}
    >
      <div className="p-2">
        <button
          onClick={() => {
            selectFramework(null);
            setIsOpen(false);
          }}
          className="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent"
        >
          <span className="min-w-0 text-wrap-anywhere">自动匹配</span>
          {!selectedFramework && <Check className="h-4 w-4 shrink-0 text-primary" />}
        </button>
        <div className="border-t border-border my-1" />
        {FRAMEWORKS.map((fw) => (
          <button
            key={fw.id}
            onClick={() => {
              selectFramework(fw);
              setIsOpen(false);
            }}
            className={`flex w-full min-w-0 items-start gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent ${
              selectedFramework?.id === fw.id ? "bg-accent" : ""
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex min-w-0 items-center gap-2 font-medium">
                <span className="min-w-0 text-wrap-anywhere">{fw.name}</span>
                {selectedFramework?.id === fw.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2 text-wrap-anywhere">
                {fw.description}
              </div>
              <div className="mt-1.5 flex min-w-0 flex-wrap gap-1">
                {fw.bestFor.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="min-w-0 max-w-full rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-wrap-anywhere"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <button
          onClick={() => {
            setFrameworkMode(frameworkMode === "auto" ? "manual" : "auto");
            if (frameworkMode === "manual") setIsOpen(false);
          }}
          className={`flex min-w-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
            frameworkMode === "auto"
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          }`}
        >
          <Zap className="h-3 w-3 shrink-0" />
          <span className="min-w-0 text-wrap-anywhere">{frameworkMode === "auto" ? "自动匹配" : "手动选择"}</span>
        </button>

        {frameworkMode === "manual" && (
          <button
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            className="flex min-w-0 items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:bg-secondary/80"
          >
            <span className="min-w-0 text-wrap-anywhere">{selectedFramework?.name || "选择框架"}</span>
            <ChevronDown className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {dropdown}
    </>
  );
}
