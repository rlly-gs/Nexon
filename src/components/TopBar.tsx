import { LoaderCircle, Maximize2, Palette, Plus } from "lucide-react";
import { fileUrl, type Profile } from "../api";
import type { View } from "../App";
import { initials } from "../format";
import { btn, Logo } from "./ui";

type Props = {
  view: View;
  onView: (v: View) => void;
  profile: Profile;
  now: number;
  adding: boolean;
  onAdd: () => void;
  onAppearance: () => void;
  onFullscreen: () => void;
};

const TABS: { id: View; label: string }[] = [
  { id: "library", label: "Library" },
  { id: "profile", label: "Profile" },
];

export function TopBar({ view, onView, profile, now, adding, onAdd, onAppearance, onFullscreen }: Props) {
  const avatar = fileUrl(profile.avatar);
  const clock = new Date(now * 1000).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <header className="relative z-20 flex items-center gap-x-8 px-8 py-5 lg:px-10">
      <div className="flex items-center gap-x-2.5">
        <Logo />
        <span className="text-sm font-semibold text-fg">Nexon</span>
      </div>

      <nav className="flex items-center gap-x-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            data-nav
            onClick={() => onView(t.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium ${
              view === t.id ? "bg-fg/10 text-fg" : "text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-x-2">
        <button type="button" data-nav onClick={onAdd} disabled={adding} className={btn.small}>
          {adding ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Add game
        </button>
        <button type="button" data-nav onClick={onAppearance} title="Appearance" className={btn.icon}>
          <Palette className="size-[18px]" />
        </button>
        <button type="button" data-nav onClick={onFullscreen} title="Full screen (F11)" className={btn.icon}>
          <Maximize2 className="size-[18px]" />
        </button>
        <span className="ml-2 text-sm tabular-nums text-muted">{clock}</span>
        <button
          type="button"
          data-nav
          onClick={() => onView("profile")}
          title="Profile"
          className="ml-2 grid size-8 place-items-center overflow-hidden rounded-full bg-panel-2 text-xs font-semibold text-fg ring-1 ring-line"
        >
          {avatar ? <img src={avatar} alt="" className="size-full object-cover" /> : initials(profile.name)}
        </button>
      </div>
    </header>
  );
}
