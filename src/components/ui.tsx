import { useEffect, useRef, type ReactNode } from "react";
import { focusDefault, pushLayer } from "../nav";

/** Button classes, following Tailwind's component patterns. */
export const btn = {
  primary:
    "inline-flex items-center justify-center gap-x-2 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-on shadow-sm hover:bg-accent-hover disabled:opacity-60",
  secondary:
    "inline-flex items-center justify-center gap-x-2 rounded-md bg-fg/10 px-4 py-2.5 text-sm font-semibold text-fg ring-1 ring-inset ring-fg/10 hover:bg-fg/15 disabled:opacity-60",
  small:
    "inline-flex items-center justify-center gap-x-1.5 rounded-md bg-fg/10 px-3 py-1.5 text-sm font-semibold text-fg ring-1 ring-inset ring-fg/10 hover:bg-fg/15 disabled:opacity-60",
  ghost:
    "inline-flex items-center justify-center gap-x-2 rounded-md px-3 py-2 text-sm font-semibold text-muted hover:bg-fg/5 hover:text-fg",
  danger:
    "inline-flex items-center justify-center gap-x-2 rounded-md px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-500/10 dark:text-red-400",
  icon: "grid size-9 place-items-center rounded-md text-muted hover:bg-fg/10 hover:text-fg",
};

export const input =
  "block w-full min-w-0 rounded-md bg-canvas px-3 py-2 text-sm text-fg ring-1 ring-inset ring-line placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent";

/**
 * Modal/panel layer: keeps navigation inside it, closes with B/Esc or by
 * clicking outside, and returns focus to where it was when closed.
 */
export function Layer({
  onClose,
  className,
  children,
}: {
  onClose: () => void;
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const pop = pushLayer(() => closeRef.current());
    const root = ref.current;
    const first =
      root?.querySelector<HTMLElement>("[data-autofocus]") ?? root?.querySelector<HTMLElement>("[data-nav]");
    first?.focus({ preventScroll: true });
    return () => {
      pop();
      if (previous && previous.isConnected && previous !== document.body) previous.focus({ preventScroll: true });
      else requestAnimationFrame(focusDefault);
    };
  }, []);

  return (
    <div
      ref={ref}
      data-nav-scope
      className={className}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      {children}
    </div>
  );
}

/** Green "playing now" indicator. */
export function LiveDot({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 6 6" aria-hidden="true" className={`size-1.5 shrink-0 animate-pulse fill-current ${className}`}>
      <circle r="3" cx="3" cy="3" />
    </svg>
  );
}

export function Logo({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" aria-hidden="true" className={`text-accent ${className}`}>
      <rect x="32" y="32" width="960" height="960" rx="220" fill="currentColor" opacity=".14" />
      <path d="M292 752V272h116l208 300V272h116v480H616L408 452v300z" fill="currentColor" />
    </svg>
  );
}

/** Drawn controller button (A, B, X, Y, LB...). */
export function Glyph({ children, round = true }: { children: ReactNode; round?: boolean }) {
  return (
    <kbd
      className={`inline-grid h-5 place-items-center bg-panel-2 font-sans text-[10px] font-semibold text-fg ring-1 ring-inset ring-line ${
        round ? "w-5 rounded-full" : "rounded px-1.5"
      }`}
    >
      {children}
    </kbd>
  );
}
