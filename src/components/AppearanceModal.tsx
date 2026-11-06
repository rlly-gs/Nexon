import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import type { Settings } from "../api";
import { ACCENTS, BASES } from "../theme";
import { btn, Layer } from "./ui";

type Props = {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
};

const MODES: { id: Settings["mode"]; label: string }[] = [
  { id: "system", label: "System" },
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
];

export function AppearanceModal({ settings, onChange, onClose }: Props) {
  const set = (patch: Partial<Settings>) => onChange({ ...settings, ...patch });

  return (
    <Layer onClose={onClose} className="absolute inset-0 z-40 grid place-items-center bg-canvas/60 p-6 backdrop-blur-sm">
      <div role="dialog" aria-label="Appearance" className="w-full max-w-md animate-fade-in rounded-xl bg-panel shadow-xl ring-1 ring-line/60">
        <div className="flex items-center justify-between border-b border-line/60 px-6 py-4">
          <h2 className="text-base font-semibold text-fg">Appearance</h2>
          <button type="button" data-nav onClick={onClose} aria-label="Close" className={`${btn.icon} -mr-2`}>
            <X className="size-5" />
          </button>
        </div>

        <div className="flex flex-col gap-y-6 px-6 py-5">
          <Section title="Mode">
            <Segmented options={MODES} value={settings.mode} onSelect={(mode) => set({ mode })} autofocus />
          </Section>

          <Section title="Base">
            <Segmented
              options={Object.entries(BASES).map(([id, b]) => ({ id, label: b.name }))}
              value={settings.base}
              onSelect={(base) => set({ base })}
            />
          </Section>

          <Section title="Accent color">
            <div className="flex flex-wrap gap-3">
              {Object.entries(ACCENTS).map(([id, a]) => {
                const on = id === settings.accent;
                return (
                  <button
                    key={id}
                    type="button"
                    data-nav
                    onClick={() => set({ accent: id })}
                    aria-pressed={on}
                    title={a.name}
                    aria-label={a.name}
                    className={`grid size-8 place-items-center rounded-full ring-2 ring-offset-2 ring-offset-panel ${
                      on ? "ring-fg" : "ring-transparent hover:ring-line"
                    }`}
                    style={{ background: a.swatch }}
                  >
                    {on && <Check className="size-4 text-white mix-blend-difference" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </Section>
        </div>
      </div>
    </Layer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-fg">{title}</h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Segmented<T extends string>({
  options,
  value,
  onSelect,
  autofocus,
}: {
  options: { id: T; label: string }[];
  value: T;
  onSelect: (id: T) => void;
  autofocus?: boolean;
}) {
  return (
    <span className="isolate inline-flex rounded-md shadow-sm">
      {options.map((o, i) => {
        const on = o.id === value;
        const edge = i === 0 ? "rounded-l-md" : i === options.length - 1 ? "-ml-px rounded-r-md" : "-ml-px";
        return (
          <button
            key={o.id}
            type="button"
            data-nav
            data-autofocus={(autofocus && on) || undefined}
            aria-pressed={on}
            onClick={() => onSelect(o.id)}
            className={`relative inline-flex items-center px-3.5 py-2 text-sm font-semibold ring-1 ring-inset ring-line focus:z-10 ${edge} ${
              on ? "bg-panel-2 text-fg" : "bg-panel text-muted hover:bg-panel-2/60 hover:text-fg"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </span>
  );
}
