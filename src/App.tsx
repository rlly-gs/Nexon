import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, open } from "@tauri-apps/plugin-dialog";
import { Upload } from "lucide-react";
import { api, CHANGED_EVENT, errorText, type Game, type Settings, type Snapshot } from "./api";
import { computeStats, type Stats } from "./stats";
import { useGamepad, useNow } from "./hooks";
import { activate, back, focusEl, hasLayer, move, navScope, setRootBack, type Direction } from "./nav";
import { applyTheme } from "./theme";
import { TopBar } from "./components/TopBar";
import { Carousel } from "./components/Carousel";
import { Backdrop } from "./components/GameArt";
import { DetailsPanel } from "./components/DetailsPanel";
import { EditGameModal } from "./components/EditGameModal";
import { AppearanceModal } from "./components/AppearanceModal";
import { ProfileView } from "./components/ProfileView";
import { HintsBar } from "./components/HintsBar";

export type View = "library" | "profile";
type Toast = { kind: "error" | "info"; text: string };

const ARROWS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/** Most recent first (played or added). */
function sortGames(games: Game[], stats: Stats) {
  const key = (g: Game) => Math.max(stats.byGame[g.id]?.lastPlayed ?? 0, g.addedAt);
  return [...games].sort((a, b) => key(b) - key(a));
}

async function toggleFullscreen() {
  const w = getCurrentWindow();
  await w.setFullscreen(!(await w.isFullscreen()));
}

export default function App() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [view, setView] = useState<View>("library");
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [appearance, setAppearance] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<number>();

  const now = useNow(snap?.running.length ? 1000 : 15_000);
  const stats = useMemo(() => (snap ? computeStats(snap, now) : null), [snap, now]);

  // The row order only changes when the library changes, not every second.
  const order = useMemo(
    () => (snap && stats ? sortGames(snap.games, stats).map((g) => g.id) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snap?.games, snap?.sessions.length],
  );
  const games = useMemo(() => {
    const byId = new Map(snap?.games.map((g) => [g.id, g]));
    return order.map((id) => byId.get(id)).filter((g): g is Game => !!g);
  }, [order, snap?.games]);
  const focused = games.find((g) => g.id === focusedId) ?? games[0] ?? null;

  // ---------- Toasts ----------
  const notify = useCallback((kind: Toast["kind"], text: string) => {
    setToast({ kind, text });
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), kind === "error" ? 6000 : 2500);
  }, []);
  const onError = useCallback((e: unknown) => notify("error", errorText(e)), [notify]);

  // ---------- Data ----------
  const refresh = useCallback(() => {
    api.snapshot().then(setSnap).catch(onError);
  }, [onError]);

  useEffect(() => {
    refresh();
    const un = listen(CHANGED_EVENT, refresh);
    return () => {
      un.then((f) => f());
    };
  }, [refresh]);

  // ---------- Theme ----------
  const settings = snap?.settings;
  useEffect(() => {
    if (!settings) return;
    applyTheme(settings);
    if (settings.mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme(settings);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [settings?.base, settings?.accent, settings?.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeSettings = useCallback(
    (s: Settings) => {
      applyTheme(s);
      setSnap((prev) => (prev ? { ...prev, settings: s } : prev));
      api.updateSettings(s).catch(onError);
    },
    [onError],
  );

  // ---------- Adding games ----------
  const addPaths = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return;
      setAdding(true);
      try {
        const added = await api.addGames(paths);
        if (added.length) {
          notify("info", added.length === 1 ? `${added[0].name} added` : `${added.length} games added`);
          setView("library");
          setFocusedId(added[0].id);
        }
      } catch (e) {
        onError(e);
      } finally {
        setAdding(false);
      }
    },
    [notify, onError],
  );

  const addFromDialog = useCallback(async () => {
    const sel = await open({
      multiple: true,
      title: "Choose a game (.exe, .lnk or .url shortcut)",
      filters: [{ name: "Games and shortcuts", extensions: ["exe", "lnk", "url"] }],
    });
    if (sel) addPaths(Array.isArray(sel) ? sel : [sel]);
  }, [addPaths]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    getCurrentWebview()
      .onDragDropEvent((e) => {
        const p = e.payload;
        if (p.type === "enter" || p.type === "over") setDragging(true);
        else if (p.type === "leave") setDragging(false);
        else if (p.type === "drop") {
          setDragging(false);
          addPaths(p.paths);
        }
      })
      .then((f) => (disposed ? f() : (unlisten = f)));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [addPaths]);

  // ---------- Game actions ----------
  const launch = useCallback(
    (id: string) => {
      const game = snap?.games.find((g) => g.id === id);
      if (!game) return;
      if (snap?.running.some((r) => r.gameId === id)) return notify("info", `${game.name} is already running`);
      api
        .launch(id)
        .then(() => notify("info", `Starting ${game.name}…`))
        .catch(onError);
    },
    [snap, notify, onError],
  );

  const removeGame = useCallback(
    async (game: Game) => {
      const ok = await ask(`Remove "${game.name}" from your library?\nIts playtime history will be deleted too.`, {
        title: "Nexon",
        kind: "warning",
        okLabel: "Remove",
        cancelLabel: "Cancel",
      });
      if (!ok) return;
      try {
        await api.removeGame(game.id);
        setDetailsId(null);
        setFocusedId(null);
      } catch (e) {
        onError(e);
      }
    },
    [onError],
  );

  const toggleRecompiled = useCallback(
    (game: Game) => {
      const recompiled = !game.recompiled;
      // Optimistic: flip it right away; the backend event refreshes the snapshot after.
      setSnap((prev) =>
        prev ? { ...prev, games: prev.games.map((g) => (g.id === game.id ? { ...g, recompiled } : g)) } : prev,
      );
      api.setRecompiled(game.id, recompiled).catch((e) => {
        onError(e);
        refresh();
      });
    },
    [onError, refresh],
  );

  const fullscreen = useCallback(() => {
    toggleFullscreen().catch(onError);
  }, [onError]);

  const openGameInLibrary = useCallback((id: string) => {
    setFocusedId(id);
    setView("library");
  }, []);

  // ---------- Controller and keyboard ----------
  useEffect(() => {
    setRootBack(() => setView((v) => (v === "profile" ? "library" : v)));
    return () => setRootBack(null);
  }, []);

  const pad = useGamepad({
    up: () => move("up"),
    down: () => move("down"),
    left: () => move("left"),
    right: () => move("right"),
    a: activate,
    b: back,
    x: () => !hasLayer() && view === "library" && focused && setDetailsId(focused.id),
    y: () => !hasLayer() && setView((v) => (v === "profile" ? "library" : "profile")),
    lb: () => !hasLayer() && setView("library"),
    rb: () => !hasLayer() && setView("profile"),
    start: fullscreen,
    view: () => !hasLayer() && setAppearance(true),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        return back();
      }
      if (e.key === "F11") {
        e.preventDefault();
        return fullscreen();
      }
      const target = e.target as HTMLElement;
      if (target.matches("input, textarea, select")) return;
      const dir = ARROWS[e.key];
      if (dir) {
        e.preventDefault();
        move(dir);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // Hovering also moves focus (console-style), except while typing.
  const onHover = (e: MouseEvent) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-nav]");
    if (!el || el === document.activeElement || el.matches("input, textarea")) return;
    if ((document.activeElement as HTMLElement | null)?.matches("input, textarea")) return;
    if (navScope().contains(el)) focusEl(el, false);
  };

  // ---------- Render ----------
  if (!snap || !stats) {
    return <div className="grid h-full place-items-center text-sm text-muted">Loading…</div>;
  }

  const detailsGame = snap.games.find((g) => g.id === detailsId) ?? null;
  const editing = snap.games.find((g) => g.id === editingId) ?? null;
  const runningOf = (id: string) => snap.running.find((r) => r.gameId === id);

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-canvas" onMouseOver={onHover}>
      {view === "library" && focused && <Backdrop game={focused} />}

      <TopBar
        view={view}
        onView={setView}
        profile={snap.profile}
        now={now}
        adding={adding}
        onAdd={addFromDialog}
        onAppearance={() => setAppearance(true)}
        onFullscreen={fullscreen}
      />

      <main className="relative z-10 flex min-h-0 flex-1 flex-col">
        {view === "library" ? (
          <Carousel
            games={games}
            focused={focused}
            stats={stats}
            running={snap.running}
            now={now}
            adding={adding}
            onFocusGame={setFocusedId}
            onLaunch={launch}
            onDetails={setDetailsId}
            onAdd={addFromDialog}
          />
        ) : (
          <ProfileView snap={snap} stats={stats} now={now} onError={onError} onOpenGame={openGameInLibrary} />
        )}
      </main>

      {pad && <HintsBar pad={pad} inLayer={!!(detailsGame || editing || appearance)} />}

      {detailsGame && (
        <DetailsPanel
          game={detailsGame}
          stat={stats.byGame[detailsGame.id]}
          stats={stats}
          running={runningOf(detailsGame.id)}
          now={now}
          onClose={() => setDetailsId(null)}
          onLaunch={() => launch(detailsGame.id)}
          onEdit={() => setEditingId(detailsGame.id)}
          onReveal={() => api.reveal(detailsGame.id).catch(onError)}
          onRemove={() => removeGame(detailsGame)}
          onToggleRecompiled={() => toggleRecompiled(detailsGame)}
        />
      )}

      {editing && (
        <EditGameModal game={editing} running={!!runningOf(editing.id)} onClose={() => setEditingId(null)} onError={onError} />
      )}

      {appearance && (
        <AppearanceModal settings={snap.settings} onChange={changeSettings} onClose={() => setAppearance(false)} />
      )}

      {dragging && (
        <div className="absolute inset-0 z-50 grid place-items-center bg-canvas/80 p-8 backdrop-blur-sm">
          <div className="flex size-full flex-col items-center justify-center gap-y-3 rounded-2xl border-2 border-dashed border-accent text-fg">
            <Upload className="size-10 text-accent-text" />
            <p className="text-lg font-semibold">Drop to add to your library</p>
            <p className="text-sm text-muted">.exe, .lnk or .url shortcuts</p>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          onClick={() => setToast(null)}
          className={`absolute bottom-20 left-1/2 z-50 max-w-[min(560px,calc(100%-2rem))] -translate-x-1/2 animate-rise cursor-pointer whitespace-pre-line rounded-md bg-panel px-4 py-2.5 text-sm font-medium text-fg shadow-lg ring-1 ${
            toast.kind === "error" ? "ring-red-500/50" : "ring-line/60"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}
