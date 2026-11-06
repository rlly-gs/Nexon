const LOCALE = "en-US";

/** "< 1 min", "45 min", "3h 20m", "128h" */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return m === 0 ? "< 1 min" : `${m} min`;
  if (h >= 100) return `${h.toLocaleString(LOCALE)}h`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** "12.5" (hours with one decimal place) */
export function formatHours(seconds: number): string {
  return (seconds / 3600).toLocaleString(LOCALE, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/** "01:23:45" */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** "Today", "Yesterday", "3 days ago", "Oct 12, 2026" */
export function formatRelativeDay(ts: number, now: number): string {
  const day = (t: number) => {
    const d = new Date(t * 1000);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  const diff = Math.round((day(now) - day(ts)) / 86_400_000);
  if (diff <= 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7) return `${diff} days ago`;
  return formatDate(ts);
}

/** "Oct 12, 2026" */
export function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric" });
}

/** "7:45 PM" */
export function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

/** Stable hue derived from the name, for covers without an image. */
export function hueFor(name: string): number {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}
