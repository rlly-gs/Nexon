import { useEffect } from "react";
import { Gamepad2, LoaderCircle, Play, Plus } from "lucide-react";
import type { Game, RunningGame } from "../api";
import type { Stats } from "../stats";
import { formatClock, formatDuration, formatRelativeDay } from "../format";
import { focusDefault } from "../nav";
import { CoverArt } from "./GameArt";
import { btn, LiveDot } from "./ui";

type Props = {
  games: Game[];
  focused: Game | null;
  stats: Stats;
  running: RunningGame[];
  now: number;
  adding: boolean;
  onFocusGame: (id: string) => void;
  onLaunch: (id: string) => void;
  onDetails: (id: string) => void;
  onAdd: () => void;
};

export function Carousel(props: Props) {
  const { games, focused, stats, running, now, onFocusGame, onLaunch, onDetails } = props;

  // When the screen opens, focus the selected game.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) focusDefault();
  }, [games.length === 0]);

  if (!focused) return <EmptyLibrary adding={props.adding} onAdd={props.onAdd} />;

  const run = running.find((r) => r.gameId === focused.id);
  const stat = stats.byGame[focused.id];

  return (
    <>
      <div className="flex max-w-2xl flex-1 flex-col justify-end px-8 pb-6 lg:px-10">
        <p className="text-sm font-medium text-accent-text">
          {run ? "Playing now" : stat?.lastPlayed ? "Recently played" : "In your library"}
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-fg text-balance lg:text-5xl">{focused.name}</h1>

        <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
          <Fact label="Time played" value={stat?.total ? formatDuration(stat.total) : "Never played"} />
          <Fact label="Last played" value={stat?.lastPlayed ? formatRelativeDay(stat.lastPlayed, now) : "—"} />
          <Fact label="Sessions" value={String(stat?.sessions ?? 0)} />
          {run && (
            <div>
              <dt className="text-xs text-muted">Now</dt>
              <dd className="mt-0.5 flex items-center gap-x-1.5 text-sm font-semibold tabular-nums text-green-600 dark:text-green-400">
                <LiveDot />
                {run.detected ? formatClock(now - run.startedAt) : "Starting…"}
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-6 flex flex-wrap gap-3">
          <button type="button" data-nav onClick={() => onLaunch(focused.id)} className={btn.primary}>
            {run && !run.detected ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" fill="currentColor" />
            )}
            {run ? (run.detected ? "Playing" : "Starting…") : "Play"}
          </button>
          <button type="button" data-nav onClick={() => onDetails(focused.id)} className={btn.secondary}>
            Details
          </button>
        </div>
      </div>

      <section className="pb-5">
        <div className="flex items-baseline justify-between px-8 lg:px-10">
          <h2 className="text-sm font-medium text-muted">Library</h2>
          <span className="text-xs tabular-nums text-subtle">
            {games.length === 1 ? "1 game" : `${games.length} games`} · {formatDuration(stats.total)}
          </span>
        </div>
        <div className="no-scrollbar mt-3 flex scroll-px-8 gap-4 overflow-x-auto px-8 pb-3 pt-3 lg:scroll-px-10 lg:px-10">
          {games.map((g) => {
            const r = running.find((x) => x.gameId === g.id);
            return (
              <button
                key={g.id}
                type="button"
                data-nav
                data-nav-default={g.id === focused.id || undefined}
                aria-label={g.name}
                onFocus={() => onFocusGame(g.id)}
                onClick={() => onLaunch(g.id)}
                className="relative aspect-[3/4] w-32 shrink-0 overflow-hidden rounded-lg shadow-sm ring-1 ring-inset ring-white/10 transition-transform focus:-translate-y-1 focus:outline-offset-[3px] xl:w-36"
              >
                <CoverArt game={g} showTitle />
                {r && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-x-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-green-400 backdrop-blur">
                    <LiveDot />
                    {r.detected ? formatClock(now - r.startedAt) : "Starting"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>
    </>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-fg">{value}</dd>
    </div>
  );
}

function EmptyLibrary({ adding, onAdd }: { adding: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <div className="max-w-md text-center">
        <Gamepad2 className="mx-auto size-12 text-subtle" strokeWidth={1.4} />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-fg">Your library is empty</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Add a game's <code className="rounded bg-fg/10 px-1">.exe</code>, a{" "}
          <code className="rounded bg-fg/10 px-1">.lnk</code> shortcut or a Steam{" "}
          <code className="rounded bg-fg/10 px-1">.url</code> shortcut. You can also drag files onto this window.
        </p>
        <button type="button" data-nav data-nav-default onClick={onAdd} disabled={adding} className={`${btn.primary} mt-6`}>
          {adding ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add game
        </button>
      </div>
    </div>
  );
}
