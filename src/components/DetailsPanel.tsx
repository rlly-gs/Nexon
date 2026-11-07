import { Check, FolderOpen, Pencil, Play, Trash2, X } from "lucide-react";
import type { Game, RunningGame } from "../api";
import type { GameStat, Stats } from "../stats";
import { formatDate, formatDuration, formatRelativeDay, formatTime } from "../format";
import { CoverArt } from "./GameArt";
import { btn, Layer, LiveDot, RecompiledBadge } from "./ui";

type Props = {
  game: Game;
  stat: GameStat;
  stats: Stats;
  running: RunningGame | undefined;
  now: number;
  onClose: () => void;
  onLaunch: () => void;
  onEdit: () => void;
  onReveal: () => void;
  onRemove: () => void;
  onToggleRecompiled: () => void;
};

export function DetailsPanel({
  game,
  stat,
  stats,
  running,
  now,
  onClose,
  onLaunch,
  onEdit,
  onReveal,
  onRemove,
  onToggleRecompiled,
}: Props) {
  const recent = stats.recent.filter((s) => s.gameId === game.id).slice(0, 6);
  const avg = stat.sessions ? stat.total / stat.sessions : 0;

  return (
    <Layer onClose={onClose} className="absolute inset-0 z-30 flex justify-end bg-canvas/60 backdrop-blur-sm">
      <div
        role="dialog"
        aria-label={`${game.name} details`}
        className="thin-scrollbar flex h-full w-full max-w-md animate-slide-in flex-col overflow-y-auto bg-panel shadow-xl ring-1 ring-line/60"
      >
        <div className="flex items-start justify-between gap-4 border-b border-line/60 px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-x-2">
              <h2 className="truncate text-base font-semibold text-fg">{game.name}</h2>
              {game.recompiled && <RecompiledBadge />}
            </div>
            <p className="mt-1 text-sm text-muted">Added on {formatDate(game.addedAt)}</p>
          </div>
          <button type="button" data-nav onClick={onClose} aria-label="Close" className={`${btn.icon} -mr-2 -mt-1`}>
            <X className="size-5" />
          </button>
        </div>

        <div className="px-6 pt-5">
          <div className="relative aspect-video overflow-hidden rounded-lg ring-1 ring-inset ring-white/10">
            <CoverArt game={{ ...game, cover: game.background ?? game.cover }} />
          </div>
        </div>

        <dl className="mx-6 mt-5 divide-y divide-line/60 border-y border-line/60">
          <Row label="Time played" value={stat.total ? formatDuration(stat.total) : "Never played"} />
          <Row label="Sessions" value={String(stat.sessions)} />
          <Row label="Average session" value={stat.sessions ? formatDuration(avg) : "—"} />
          <Row label="Last played" value={stat.lastPlayed ? formatRelativeDay(stat.lastPlayed, now) : "—"} />
        </dl>

        {/* A button styled as a checkbox, so A / Enter / click all toggle it. */}
        <div className="px-4 pt-4">
          <button
            type="button"
            role="checkbox"
            aria-checked={game.recompiled}
            data-nav
            onClick={onToggleRecompiled}
            className="flex w-full items-start gap-x-3 rounded-md p-2 text-left hover:bg-fg/5"
          >
            <span
              aria-hidden="true"
              className={`mt-0.5 grid size-4 shrink-0 place-items-center rounded ring-1 ring-inset ${
                game.recompiled ? "bg-accent text-accent-on ring-accent" : "bg-canvas ring-line"
              }`}
            >
              {game.recompiled && <Check className="size-3" strokeWidth={3.5} />}
            </span>
            <span className="text-sm">
              <span className="block font-medium text-fg">Recompiled</span>
              <span className="block text-muted">Native PC port built from the original game's code.</span>
            </span>
          </button>
        </div>

        <div className="px-6 py-5">
          <h3 className="text-sm font-medium text-fg">Recent sessions</h3>
          {recent.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Launch the game from Nexon to start tracking.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line/60">
              {recent.map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                  <span className="text-muted">
                    {formatRelativeDay(s.start, now)}, {formatTime(s.start)}
                  </span>
                  <span
                    className={`flex items-center gap-x-1.5 font-medium tabular-nums ${
                      s.live ? "text-green-600 dark:text-green-400" : "text-fg"
                    }`}
                  >
                    {s.live && <LiveDot />}
                    {formatDuration(s.duration)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-wrap gap-2 px-6 pb-5">
          <button type="button" data-nav onClick={onReveal} className={btn.ghost}>
            <FolderOpen className="size-4" /> Show in folder
          </button>
          <button type="button" data-nav onClick={onRemove} disabled={!!running} className={`${btn.danger} disabled:opacity-50`}>
            <Trash2 className="size-4" /> Remove
          </button>
        </div>

        <div className="mt-auto flex gap-3 border-t border-line/60 px-6 py-4">
          <button type="button" data-nav data-autofocus onClick={onLaunch} className={`${btn.primary} flex-1`}>
            <Play className="size-4" fill="currentColor" />
            {running ? (running.detected ? "Playing" : "Starting…") : "Play"}
          </button>
          <button type="button" data-nav onClick={onEdit} className={btn.secondary}>
            <Pencil className="size-4" /> Edit
          </button>
        </div>
      </div>
    </Layer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium tabular-nums text-fg">{value}</dd>
    </div>
  );
}
