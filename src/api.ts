import { convertFileSrc, invoke } from "@tauri-apps/api/core";

export type Profile = {
  name: string;
  avatar: string | null;
  createdAt: number;
};

export type Game = {
  id: string;
  name: string;
  path: string;
  target: string | null;
  args: string | null;
  workingDir: string | null;
  monitorExe: string | null;
  icon: string | null;
  cover: string | null;
  background: string | null;
  recompiled: boolean;
  /** Dominant cover hues (0-360); null until analyzed, empty when the cover has no strong colors. */
  palette: number[] | null;
  addedAt: number;
};

export type Settings = {
  base: string;
  accent: string;
  mode: "system" | "dark" | "light";
};

export type ImageKind = "cover" | "background";

export type Session = {
  id: string;
  gameId: string;
  start: number;
  end: number;
};

export type RunningGame = {
  gameId: string;
  startedAt: number;
  detected: boolean;
};

export type Snapshot = {
  profile: Profile;
  settings: Settings;
  games: Game[];
  sessions: Session[];
  running: RunningGame[];
};

export type GameEdit = {
  name: string;
  args: string | null;
  monitorExe: string | null;
};

export const CHANGED_EVENT = "nexon://changed";

export const api = {
  snapshot: () => invoke<Snapshot>("get_snapshot"),
  addGames: (paths: string[]) => invoke<Game[]>("add_games", { paths }),
  updateGame: (id: string, edit: GameEdit) => invoke<void>("update_game", { id, edit }),
  setImage: (id: string, kind: ImageKind, image: string | null) =>
    invoke<void>("set_game_image", { id, kind, image }),
  setRecompiled: (id: string, recompiled: boolean) => invoke<void>("set_recompiled", { id, recompiled }),
  updateSettings: (settings: Settings) => invoke<void>("update_settings", { settings }),
  removeGame: (id: string) => invoke<void>("remove_game", { id }),
  launch: (id: string) => invoke<void>("launch_game", { id }),
  reveal: (id: string) => invoke<void>("reveal_game", { id }),
  updateProfile: (name: string) => invoke<void>("update_profile", { name }),
  setAvatar: (image: string | null) => invoke<void>("set_avatar", { image }),
};

/** Local path → URL the webview can display. */
export const fileUrl = (path: string | null | undefined) =>
  path ? convertFileSrc(path) : undefined;

export const errorText = (e: unknown) =>
  typeof e === "string" ? e : e instanceof Error ? e.message : JSON.stringify(e);
