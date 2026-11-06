import type { Session, Snapshot } from "./api";

export type GameStat = {
  total: number;
  lastPlayed: number | null;
  sessions: number;
};

export type Stats = {
  byGame: Record<string, GameStat>;
  total: number;
  week: number;
  sessions: number;
  /** Most recent sessions first, with live durations for the ones in progress. */
  recent: (Session & { duration: number; live: boolean })[];
};

const WEEK = 7 * 24 * 3600;

export function computeStats(snap: Snapshot, now: number): Stats {
  const live = new Map(snap.running.filter((r) => r.detected).map((r) => [r.gameId, r.startedAt]));
  const byGame: Record<string, GameStat> = {};
  for (const g of snap.games) byGame[g.id] = { total: 0, lastPlayed: null, sessions: 0 };

  let total = 0;
  let week = 0;
  const recent: Stats["recent"] = [];

  for (const s of snap.sessions) {
    const isLive = live.get(s.gameId) === s.start;
    const end = isLive ? Math.max(now, s.end) : s.end;
    const duration = Math.max(0, end - s.start);
    const stat = byGame[s.gameId];
    if (!stat) continue;
    stat.total += duration;
    stat.sessions += 1;
    stat.lastPlayed = Math.max(stat.lastPlayed ?? 0, end);
    total += duration;
    if (end > now - WEEK) week += end - Math.max(s.start, now - WEEK);
    recent.push({ ...s, end, duration, live: isLive });
  }

  recent.sort((a, b) => b.start - a.start);
  return { byGame, total, week, sessions: snap.sessions.length, recent };
}
