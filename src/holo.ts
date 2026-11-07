import type { Game } from "./api";
import { hueFor } from "./format";

/** Tilt input in [-1, 1] fed from outside (controller sticks, arrow keys). */
export type TiltInput = { x: number; y: number; active: boolean };

/**
 * Hues the foil should use: the cover's dominant colors when it has a cover,
 * otherwise the colors of the generated placeholder art.
 */
export function foilHues(game: Game): number[] {
  if (game.cover) return game.palette ?? [hueFor(game.name)];
  const h = hueFor(game.name);
  return [h, (h + 25) % 360];
}

/** Repeating rainbow-like foil built from the given hues (silver when there are none). */
export function foilGradient(hues: number[]): string {
  let stops: string[];
  if (hues.length === 0) {
    stops = ["hsl(220 14% 78%)", "hsl(210 20% 96%)", "hsl(200 18% 70%)", "hsl(230 16% 88%)"];
  } else {
    stops = [];
    for (const h of hues) {
      stops.push(`hsl(${h} 95% 60%)`, `hsl(${(h + 20) % 360} 95% 72%)`);
    }
    // A single color still needs some movement: add analogous neighbors.
    if (hues.length === 1) stops.push(`hsl(${(hues[0] + 340) % 360} 90% 66%)`, `hsl(${(hues[0] + 45) % 360} 85% 64%)`);
  }
  const span = 30; // % of the gradient per cycle
  const step = span / stops.length;
  const list = stops.map((c, i) => `${c} ${(i * step).toFixed(1)}%`).join(", ");
  return `repeating-linear-gradient(115deg, ${list}, ${stops[0]} ${span}%)`;
}
