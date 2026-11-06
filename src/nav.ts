/**
 * Spatial navigation: focus moves to the nearest `[data-nav]` element in the
 * requested direction. Works with a controller, keyboard and mouse on any screen.
 *
 * - `[data-nav-scope]`: confines navigation (modals/panels). The last one in the DOM wins.
 * - `[data-nav-default]`: element that gets focus when nothing is focused.
 * - Layers (`pushLayer`): the B button / Esc closes the topmost layer.
 */

export type Direction = "up" | "down" | "left" | "right";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function navScope(): HTMLElement {
  const scopes = document.querySelectorAll<HTMLElement>("[data-nav-scope]");
  return scopes.length ? scopes[scopes.length - 1] : document.body;
}

export function navItems(): HTMLElement[] {
  return [...navScope().querySelectorAll<HTMLElement>("[data-nav]")].filter(
    (el) => el.offsetParent !== null && !(el as HTMLButtonElement).disabled,
  );
}

export function focusEl(el: HTMLElement, scroll = true) {
  el.focus({ preventScroll: true });
  if (scroll) {
    el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion() ? "auto" : "smooth" });
  }
}

export function focusDefault() {
  const scope = navScope();
  const el = scope.querySelector<HTMLElement>("[data-nav-default]") ?? navItems()[0];
  if (el) focusEl(el);
}

export function move(dir: Direction) {
  const cur = document.activeElement as HTMLElement | null;
  const items = navItems();
  if (!cur || !cur.matches("[data-nav]") || !navScope().contains(cur)) return focusDefault();

  const r = cur.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of items) {
    if (el === cur) continue;
    const b = el.getBoundingClientRect();
    const bx = b.left + b.width / 2;
    const by = b.top + b.height / 2;
    let main: number;
    let cross: number;
    if (dir === "right") {
      if (bx <= cx + 2) continue;
      main = Math.max(0, b.left - r.right);
      cross = Math.abs(by - cy);
    } else if (dir === "left") {
      if (bx >= cx - 2) continue;
      main = Math.max(0, r.left - b.right);
      cross = Math.abs(by - cy);
    } else if (dir === "down") {
      if (by <= cy + 2) continue;
      main = Math.max(0, b.top - r.bottom);
      cross = Math.abs(bx - cx);
    } else {
      if (by >= cy - 2) continue;
      main = Math.max(0, r.top - b.bottom);
      cross = Math.abs(bx - cx);
    }
    // Prefer what is aligned (same row/column) over what is merely close.
    const score = main + cross * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  if (best) focusEl(best);
}

/** A button / Enter: activates the focused element. */
export function activate() {
  const el = document.activeElement as HTMLElement | null;
  if (el && el.matches("[data-nav]") && !el.matches("input, textarea")) el.click();
  else if (!el || el === document.body) focusDefault();
}

// ---------- Layers (modals, panels) ----------

const layers: (() => void)[] = [];
let rootBack: (() => void) | null = null;

export function pushLayer(close: () => void) {
  layers.push(close);
  return () => {
    const i = layers.lastIndexOf(close);
    if (i >= 0) layers.splice(i, 1);
  };
}

export const hasLayer = () => layers.length > 0;

/** What B / Esc does when no layer is open. */
export function setRootBack(fn: (() => void) | null) {
  rootBack = fn;
}

export function back() {
  const top = layers[layers.length - 1];
  if (top) top();
  else rootBack?.();
}
