import { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Camera, Pencil } from "lucide-react";
import { api, fileUrl, type Snapshot } from "../api";
import type { Stats } from "../stats";
import { formatDate, formatDuration, formatHours, formatRelativeDay, formatTime, initials } from "../format";
import { focusDefault } from "../nav";
import { CoverArt } from "./GameArt";
import { input, LiveDot } from "./ui";

type Props = {
  snap: Snapshot;
  stats: Stats;
  now: number;
  onError: (e: unknown) => void;
  onOpenGame: (id: string) => void;
};

export function ProfileView({ snap, stats, now, onError, onOpenGame }: Props) {
  const { profile } = snap;
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(profile.name);
  useEffect(() => setName(profile.name), [profile.name]);
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body) focusDefault();
  }, []);

  const avatar = fileUrl(profile.avatar);
  const gameById = new Map(snap.games.map((g) => [g.id, g]));
  const ranking = snap.games
    .map((g) => ({ game: g, stat: stats.byGame[g.id] }))
    .filter((r) => r.stat.total > 0)
    .sort((a, b) => b.stat.total - a.stat.total)
    .slice(0, 8);
  const max = ranking[0]?.stat.total ?? 1;

  const saveName = () => {
    setEditingName(false);
    if (name.trim() && name.trim() !== profile.name) api.updateProfile(name).catch(onError);
    else setName(profile.name);
  };

  const pickAvatar = async () => {
    const img = await open({
      title: "Choose your profile picture",
      filters: [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }],
    });
    if (typeof img === "string") api.setAvatar(img).catch(onError);
  };

  return (
    <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-8 pb-10 pt-4 lg:px-10">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <button
            type="button"
            data-nav
            onClick={pickAvatar}
            title="Change picture"
            className="group relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-2xl font-semibold text-accent-on"
          >
            {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : initials(profile.name)}
            <span className="absolute inset-0 grid place-items-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100">
              <Camera className="size-5 text-white" />
            </span>
          </button>
          <div className="min-w-0 flex-1">
            {editingName ? (
              <input
                data-nav
                autoFocus
                value={name}
                maxLength={40}
                onChange={(e) => setName(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveName();
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setName(profile.name);
                    setEditingName(false);
                  }
                }}
                className={`${input} max-w-sm text-2xl font-semibold`}
              />
            ) : (
              <button
                type="button"
                data-nav
                onClick={() => setEditingName(true)}
                title="Edit name"
                className="group flex items-center gap-x-2 rounded-md text-left text-2xl font-semibold tracking-tight text-fg"
              >
                {profile.name}
                <Pencil className="size-4 text-subtle opacity-0 transition-opacity group-hover:opacity-100 group-focus:opacity-100" />
              </button>
            )}
            <p className="mt-1 text-sm text-muted">On Nexon since {formatDate(profile.createdAt)}</p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-semibold tracking-tight tabular-nums text-fg">{formatHours(stats.total)}</p>
            <p className="mt-1 text-sm text-muted">hours played</p>
          </div>
        </div>

        {/* Numbers */}
        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-line/60 ring-1 ring-line/60 md:grid-cols-4">
          <Stat label="Total playtime" value={formatDuration(stats.total)} />
          <Stat label="Last 7 days" value={formatDuration(stats.week)} />
          <Stat label="Games" value={String(snap.games.length)} />
          <Stat label="Sessions" value={String(stats.sessions)} />
        </dl>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          {/* Most played */}
          <section>
            <h2 className="text-sm font-medium text-fg">Most played</h2>
            {ranking.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Launch a game from Nexon to start tracking your hours.</p>
            ) : (
              <ol className="mt-3 space-y-1">
                {ranking.map(({ game, stat }, i) => (
                  <li key={game.id}>
                    <button
                      type="button"
                      data-nav
                      data-nav-default={i === 0 || undefined}
                      onClick={() => onOpenGame(game.id)}
                      className="grid w-full grid-cols-[1.25rem_2.5rem_1fr_auto] items-center gap-x-3 rounded-md px-2 py-2 text-left hover:bg-fg/5"
                    >
                      <span className="text-xs tabular-nums text-subtle">{i + 1}</span>
                      <span className="relative size-10 overflow-hidden rounded-md ring-1 ring-inset ring-white/10">
                        <CoverArt game={game} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-fg">{game.name}</span>
                        <span className="mt-1.5 block h-1.5 rounded-full bg-fg/10">
                          <span className="block h-1.5 rounded-full bg-accent" style={{ width: `${(stat.total / max) * 100}%` }} />
                        </span>
                      </span>
                      <span className="text-sm tabular-nums text-muted">{formatDuration(stat.total)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>

          {/* Recent activity */}
          <section>
            <h2 className="text-sm font-medium text-fg">Recent activity</h2>
            {stats.recent.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No sessions yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line/60">
                {stats.recent.slice(0, 10).map((s) => {
                  const game = gameById.get(s.gameId);
                  if (!game) return null;
                  return (
                    <li key={s.id} className="flex items-center gap-x-3 py-2.5">
                      <span className="relative size-9 shrink-0 overflow-hidden rounded-md ring-1 ring-inset ring-white/10">
                        <CoverArt game={game} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-fg">{game.name}</p>
                        <p className="text-xs text-muted">
                          {formatRelativeDay(s.start, now)}, {formatTime(s.start)}
                        </p>
                      </div>
                      <span
                        className={`flex items-center gap-x-1.5 text-sm tabular-nums ${
                          s.live ? "text-green-600 dark:text-green-400" : "text-muted"
                        }`}
                      >
                        {s.live && <LiveDot />}
                        {formatDuration(s.duration)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel px-6 py-5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums text-fg">{value}</dd>
    </div>
  );
}
