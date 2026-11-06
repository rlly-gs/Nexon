import type { Settings } from "./api";

type Mode = "dark" | "light";
/** canvas, panel, panel-2, line, fg, muted, subtle (RGB values from the Tailwind palette) */
type BaseScale = [string, string, string, string, string, string, string];
/** accent, accent-hover, accent-text, on-accent */
type AccentScale = [string, string, string, string];

export const BASES: Record<string, { name: string } & Record<Mode, BaseScale>> = {
  zinc: {
    name: "Zinc",
    dark: ["9 9 11", "24 24 27", "39 39 42", "63 63 70", "250 250 250", "161 161 170", "113 113 122"],
    light: ["244 244 245", "255 255 255", "228 228 231", "212 212 216", "24 24 27", "82 82 91", "113 113 122"],
  },
  slate: {
    name: "Slate",
    dark: ["2 6 23", "15 23 42", "30 41 59", "51 65 85", "248 250 252", "148 163 184", "100 116 139"],
    light: ["241 245 249", "255 255 255", "226 232 240", "203 213 225", "15 23 42", "71 85 105", "100 116 139"],
  },
  stone: {
    name: "Stone",
    dark: ["12 10 9", "28 25 23", "41 37 36", "68 64 60", "250 250 249", "168 162 158", "120 113 108"],
    light: ["245 245 244", "255 255 255", "231 229 228", "214 211 209", "28 25 23", "87 83 78", "120 113 108"],
  },
};

export const ACCENTS: Record<string, { name: string; swatch: string } & Record<Mode, AccentScale>> = {
  indigo: {
    name: "Indigo",
    swatch: "#6366f1",
    dark: ["99 102 241", "129 140 248", "129 140 248", "255 255 255"],
    light: ["79 70 229", "99 102 241", "79 70 229", "255 255 255"],
  },
  sky: {
    name: "Sky",
    swatch: "#0ea5e9",
    dark: ["2 132 199", "14 165 233", "56 189 248", "255 255 255"],
    light: ["2 132 199", "14 165 233", "3 105 161", "255 255 255"],
  },
  emerald: {
    name: "Emerald",
    swatch: "#10b981",
    dark: ["5 150 105", "16 185 129", "52 211 153", "255 255 255"],
    light: ["5 150 105", "16 185 129", "4 120 87", "255 255 255"],
  },
  amber: {
    name: "Amber",
    swatch: "#f59e0b",
    dark: ["245 158 11", "251 191 36", "251 191 36", "28 25 23"],
    light: ["245 158 11", "251 191 36", "180 83 9", "28 25 23"],
  },
  mono: {
    name: "Neutral",
    swatch: "#a1a1aa",
    dark: ["250 250 250", "212 212 216", "212 212 216", "9 9 11"],
    light: ["24 24 27", "63 63 70", "63 63 70", "255 255 255"],
  },
};

const BASE_VARS = ["--canvas", "--panel", "--panel-2", "--line", "--fg", "--muted", "--subtle"];
const ACCENT_VARS = ["--accent", "--accent-hover", "--accent-text", "--on-accent"];

export function resolveMode(mode: Settings["mode"]): Mode {
  if (mode === "dark" || mode === "light") return mode;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(s: Settings) {
  const mode = resolveMode(s.mode);
  const base = (BASES[s.base] ?? BASES.zinc)[mode];
  const accent = (ACCENTS[s.accent] ?? ACCENTS.indigo)[mode];
  const root = document.documentElement;
  BASE_VARS.forEach((v, i) => root.style.setProperty(v, base[i]));
  ACCENT_VARS.forEach((v, i) => root.style.setProperty(v, accent[i]));
  root.style.colorScheme = mode;
  root.classList.toggle("dark", mode === "dark");
}
