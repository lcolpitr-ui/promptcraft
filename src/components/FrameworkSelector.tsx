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
      className="fixed w-80 bg-background border border-border rounded-lg shadow-2xl max-h-[60vh] overflow-y-auto"
      style={{ top: position.top, left: position.left, zIndex: 9999, backgroundColor: 'var(--background)', backdropFilter: 'none' }}
    >
      <div className="p-2">
        <button
          onClick={() => {
            selectFramework(null);
            setIsOpen(false);
          }}
          className="w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-md hover:bg-accent transition-colors"
        >
          <span>自动匹配</span>
          {!selectedFramework && <Check className="w-4 h-4 text-primary" />}
        </button>
        <div className="border-t border-border my-1" />
        {FRAMEWORKS.map((fw) => (
          <button
            key={fw.id}
            onClick={() => {
              selectFramework(fw);
              setIsOpen(false);
            }}
            className={`w-full flex items-start gap-3 px-3 py-2.5 text-sm rounded-md hover:bg-accent transition-colors text-left ${
              selectedFramework?.id === fw.id ? "bg-accent" : ""
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="font-medium flex items-center gap-2">
                {fw.name}
                {selectedFramework?.id === fw.id && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {fw.description}
              </div>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {fw.bestFor.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 text-[10px] bg-secondary rounded-full"
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
      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setFrameworkMode(frameworkMode === "auto" ? "manual" : "auto");
            if (frameworkMode === "manual") setIsOpen(false);
          }}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-colors whitespace-nowrap ${
            frameworkMode === "auto"
              ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
              : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
          }`}
        >
          <Zap className="w-3 h-3" />
          {frameworkMode === "auto" ? "自动匹配" : "手动选择"}
        </button>

        {frameworkMode === "manual" && (
          <button
            ref={buttonRef}
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors whitespace-nowrap"
          >
            {selectedFramework?.name || "选择框架"}
            <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {dropdown}
    </>
  );
}
