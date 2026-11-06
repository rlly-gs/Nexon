import { useEffect, useRef, useState } from "react";

/** Current time in seconds, updated every `intervalMs`. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    setNow(Date.now() / 1000);
    const id = setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export type PadButton =
  | "up" | "down" | "left" | "right"
  | "a" | "b" | "x" | "y"
  | "lb" | "rb" | "view" | "start";

// Gamepad API standard mapping (Xbox controllers, PlayStation via Steam/DS4Windows, etc.)
const BUTTONS: [PadButton, number][] = [
  ["a", 0], ["b", 1], ["x", 2], ["y", 3], ["lb", 4], ["rb", 5], ["view", 8], ["start", 9],
];
const REPEATING = new Set<PadButton>(["up", "down", "left", "right"]);
const FIRST_REPEAT_MS = 380;
const REPEAT_MS = 120;
const STICK = 0.55;

/**
 * Reads the controller every frame and calls `handlers` when a button is pressed
 * (directions repeat while held). Returns the connected controller's name.
 */
export function useGamepad(handlers: Partial<Record<PadButton, () => void>>): string | null {
  const ref = useRef(handlers);
  ref.current = handlers;
  const [connected, setConnected] = useState<string | null>(null);

  useEffect(() => {
    const held: Partial<Record<PadButton, boolean>> = {};
    const nextRepeat: Partial<Record<PadButton, number>> = {};
    let lastId: string | null = null;
    let frame = 0;

    const press = (name: PadButton, down: boolean, now: number) => {
      if (down && !held[name]) {
        ref.current[name]?.();
        nextRepeat[name] = now + FIRST_REPEAT_MS;
      } else if (down && REPEATING.has(name) && now > (nextRepeat[name] ?? 0)) {
        ref.current[name]?.();
        nextRepeat[name] = now + REPEAT_MS;
      }
      held[name] = down;
    };

    const poll = (now: number) => {
      let pad: Gamepad | null = null;
      try {
        pad = [...(navigator.getGamepads?.() ?? [])].find((p): p is Gamepad => !!p) ?? null;
      } catch {
        pad = null;
      }
      const id = pad ? pad.id.replace(/\s*\(.*?\)\s*/g, " ").trim() || "Controller" : null;
      if (id !== lastId) {
        lastId = id;
        setConnected(id);
      }
      // Only respond while the window is focused (e.g. ignore input while you play).
      if (pad && document.hasFocus()) {
        const btn = (i: number) => !!pad!.buttons[i] && (pad!.buttons[i].pressed || pad!.buttons[i].value > 0.5);
        const ax = pad.axes[0] ?? 0;
        const ay = pad.axes[1] ?? 0;
        press("up", btn(12) || ay < -STICK, now);
        press("down", btn(13) || ay > STICK, now);
        press("left", btn(14) || ax < -STICK, now);
        press("right", btn(15) || ax > STICK, now);
        for (const [name, i] of BUTTONS) press(name, btn(i), now);
      }
      frame = requestAnimationFrame(poll);
    };
    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, []);

  return connected;
}
