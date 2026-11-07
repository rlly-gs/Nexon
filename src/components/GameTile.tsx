import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Game, RunningGame } from "../api";
import { formatClock } from "../format";
import { foilGradient, foilHues, type TiltInput } from "../holo";
import { CoverArt } from "./GameArt";
import { LiveDot } from "./ui";

type Props = {
  game: Game;
  isDefault: boolean;
  running: RunningGame | undefined;
  now: number;
  /** Holo mode turned on from the controller (R3) for this tile. */
  holo: boolean;
  /** Stick / arrow-key tilt, shared with App. */
  tiltInput: MutableRefObject<TiltInput>;
  onFocusGame: (id: string) => void;
  onLaunch: (id: string) => void;
};

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const DRAG_THRESHOLD = 10; // px before a press becomes a drag
const DRAG_RANGE = 120; // px of drag for a full tilt
const MAX_TILT_X = 18; // degrees
const MAX_TILT_Y = 14;
const LIFT = 0.07; // extra scale while holo

/**
 * A cover in the carousel row. Easter egg: dragging it with the mouse, or R3 + a
 * stick on the controller, turns it into a holographic card tinted with its cover's colors.
 */
export function GameTile({ game, isDefault, running, now, holo, tiltInput, onFocusGame, onLaunch }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ ox: number; oy: number; x: number; y: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const active = holo || dragging;
  const live = useRef({ active, holo });
  live.current = { active, holo };
  const anim = useRef({ x: 0, y: 0, amt: 0, frame: 0, running: false });

  // Stop any animation if the tile goes away.
  useEffect(() => () => cancelAnimationFrame(anim.current.frame), []);

  // Animation loop: runs while active and until the tile has settled back.
  useEffect(() => {
    const a = anim.current;
    if (!active || a.running) return;
    a.running = true;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastInput = performance.now();

    const tick = (t: number) => {
      const el = ref.current;
      const { active: on, holo: fromPad } = live.current;
      let tx = 0;
      let ty = 0;
      if (on) {
        const d = drag.current;
        if (d?.active) {
          tx = d.x;
          ty = d.y;
          lastInput = t;
        } else if (fromPad && tiltInput.current.active) {
          tx = tiltInput.current.x;
          ty = tiltInput.current.y;
          lastInput = t;
        } else if (!reduced && t - lastInput > 1200) {
          // Idle: a gentle sway so the foil keeps catching the light.
          tx = Math.sin(t / 1700) * 0.3;
          ty = Math.cos(t / 2300) * 0.2;
        }
      }
      const ease = reduced ? 1 : 0.14;
      a.x += (tx - a.x) * ease;
      a.y += (ty - a.y) * ease;
      a.amt += ((on ? 1 : 0) - a.amt) * (reduced ? 1 : 0.16);

      if (el) {
        const s = el.style;
        s.setProperty("--px", `${50 + a.x * 45}%`);
        s.setProperty("--py", `${50 + a.y * 45}%`);
        s.setProperty("--gx", `${50 + a.x * 50}%`);
        s.setProperty("--gy", `${50 + a.y * 50}%`);
        s.setProperty("--tilt", `${Math.min(1, Math.hypot(a.x, a.y))}`);
        s.setProperty("--amt", `${a.amt}`);
        s.transition = "none";
        s.zIndex = "10";
        s.transform = `perspective(700px) rotateX(${-a.y * MAX_TILT_Y}deg) rotateY(${a.x * MAX_TILT_X}deg) scale(${1 + LIFT * a.amt})`;
      }

      const settled = !on && a.amt < 0.01 && Math.abs(a.x) < 0.005 && Math.abs(a.y) < 0.005;
      if (settled) {
        if (el) {
          // Hand the transform back to the normal focus styles.
          el.style.removeProperty("transform");
          el.style.removeProperty("transition");
          el.style.removeProperty("z-index");
          el.style.setProperty("--amt", "0");
        }
        a.running = false;
        return;
      }
      a.frame = requestAnimationFrame(tick);
    };
    a.frame = requestAnimationFrame(tick);
  }, [active, tiltInput]);

  const onPointerDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return;
    suppressClick.current = false;
    drag.current = { ox: e.clientX, oy: e.clientY, x: 0, y: 0, active: false };
    const onMove = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ev.clientX - d.ox;
      const dy = ev.clientY - d.oy;
      if (!d.active && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
        d.active = true;
        setDragging(true);
      }
      if (d.active) {
        d.x = clamp(dx / DRAG_RANGE);
        d.y = clamp(dy / DRAG_RANGE);
      }
    };
    const onUp = () => {
      if (drag.current?.active) suppressClick.current = true;
      drag.current = null;
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <button
      ref={ref}
      type="button"
      data-nav
      data-nav-default={isDefault || undefined}
      data-game-id={game.id}
      aria-label={game.name}
      onFocus={() => onFocusGame(game.id)}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (suppressClick.current) {
          suppressClick.current = false; // that press was a drag, not a click
          return;
        }
        onLaunch(game.id);
      }}
      style={{ "--foil": foilGradient(foilHues(game)) } as CSSProperties}
      className={`relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-lg shadow-sm ring-1 ring-inset ring-white/10 transition-transform focus:-translate-y-1 focus:outline-offset-[3px] xl:w-36 ${
        active ? "cursor-grabbing shadow-2xl" : ""
      }`}
    >
      <CoverArt game={game} showTitle />
      <span className="holo-shine" />
      <span className="holo-sparkle" />
      <span className="holo-glare" />
      {running && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-x-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-green-400 backdrop-blur">
          <LiveDot />
          {running.detected ? formatClock(now - running.startedAt) : "Starting"}
        </span>
      )}
    </button>
  );
}
