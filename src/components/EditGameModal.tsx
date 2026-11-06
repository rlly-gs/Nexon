import { useState, type ReactNode } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { ImagePlus, Trash2, X } from "lucide-react";
import { api, fileUrl, type Game, type ImageKind } from "../api";
import { CoverArt } from "./GameArt";
import { btn, input, Layer } from "./ui";

type Props = {
  game: Game;
  running: boolean;
  onClose: () => void;
  onError: (e: unknown) => void;
};

const IMAGE_FILTER = [{ name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif", "bmp"] }];

export function EditGameModal({ game, running, onClose, onError }: Props) {
  const [name, setName] = useState(game.name);
  const [args, setArgs] = useState(game.args ?? "");
  const [monitorExe, setMonitorExe] = useState(game.monitorExe ?? "");
  const [saving, setSaving] = useState(false);

  const isShellLaunch = !/\.exe$/i.test(game.target ?? game.path);

  const pickImage = async (kind: ImageKind) => {
    const img = await open({
      title: kind === "cover" ? "Choose a cover (portrait, e.g. 600×900)" : "Choose background art (landscape, e.g. 1920×1080)",
      filters: IMAGE_FILTER,
    });
    if (typeof img === "string") api.setImage(game.id, kind, img).catch(onError);
  };

  const pickMonitor = async () => {
    const exe = await open({ title: "Choose the game's executable", filters: [{ name: "Executable", extensions: ["exe"] }] });
    if (typeof exe === "string") setMonitorExe(exe);
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.updateGame(game.id, { name, args: args.trim() || null, monitorExe: monitorExe.trim() || null });
      onClose();
    } catch (e) {
      onError(e);
    } finally {
      setSaving(false);
    }
  };

  const background = fileUrl(game.background);

  return (
    <Layer onClose={onClose} className="absolute inset-0 z-40 grid place-items-center overflow-y-auto bg-canvas/60 p-6 backdrop-blur-sm">
      <div role="dialog" aria-label={`Edit ${game.name}`} className="w-full max-w-3xl animate-fade-in rounded-xl bg-panel shadow-xl ring-1 ring-line/60">
        <div className="flex items-center justify-between border-b border-line/60 px-6 py-4">
          <h2 className="text-base font-semibold text-fg">Edit game</h2>
          <button type="button" data-nav onClick={onClose} aria-label="Close" className={`${btn.icon} -mr-2`}>
            <X className="size-5" />
          </button>
        </div>

        <div className="grid gap-6 px-6 py-5 md:grid-cols-[180px_1fr]">
          {/* Images */}
          <div className="flex flex-col gap-y-4">
            <div>
              <p className="text-sm font-medium text-fg">Cover</p>
              <div className="relative mt-2 aspect-[3/4] overflow-hidden rounded-lg ring-1 ring-inset ring-white/10">
                <CoverArt game={game} />
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" data-nav onClick={() => pickImage("cover")} className={`${btn.small} flex-1`}>
                  <ImagePlus className="size-4" /> {game.cover ? "Change" : "Choose"}
                </button>
                {game.cover && (
                  <button type="button" data-nav onClick={() => api.setImage(game.id, "cover", null).catch(onError)} title="Remove cover" className={btn.icon}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-fg">Background</p>
              <div className="relative mt-2 aspect-video overflow-hidden rounded-lg bg-canvas ring-1 ring-inset ring-line">
                {background ? (
                  <img src={background} alt="" className="absolute inset-0 size-full object-cover" />
                ) : (
                  <span className="absolute inset-0 grid place-items-center px-2 text-center text-xs text-subtle">Uses the cover</span>
                )}
              </div>
              <div className="mt-2 flex gap-2">
                <button type="button" data-nav onClick={() => pickImage("background")} className={`${btn.small} flex-1`}>
                  <ImagePlus className="size-4" /> {game.background ? "Change" : "Choose"}
                </button>
                {game.background && (
                  <button type="button" data-nav onClick={() => api.setImage(game.id, "background", null).catch(onError)} title="Remove background" className={btn.icon}>
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Fields */}
          <div className="flex min-w-0 flex-col gap-y-5">
            <Field label="Name" htmlFor="edit-name">
              <input id="edit-name" data-nav data-autofocus value={name} onChange={(e) => setName(e.target.value)} className={input} />
            </Field>

            <Field label="Linked file" htmlFor="edit-path" hint={game.target && game.target !== game.path ? `Points to: ${game.target}` : undefined}>
              <input id="edit-path" value={game.path} readOnly className={`${input} text-muted`} />
            </Field>

            {!isShellLaunch && (
              <Field label="Launch arguments" htmlFor="edit-args">
                <input id="edit-args" data-nav value={args} onChange={(e) => setArgs(e.target.value)} placeholder="e.g. -windowed -novid" className={input} />
              </Field>
            )}

            <Field
              label="Executable to track"
              htmlFor="edit-monitor"
              hint={
                isShellLaunch
                  ? "This game starts through a shortcut or launcher. Choose the game's real .exe so Nexon can track your playtime."
                  : "Only fill this in if playtime isn't being tracked (e.g. the game starts another executable outside its folder)."
              }
            >
              <div className="flex gap-2">
                <input
                  id="edit-monitor"
                  data-nav
                  value={monitorExe}
                  onChange={(e) => setMonitorExe(e.target.value)}
                  placeholder={isShellLaunch ? "Recommended for Steam shortcuts" : "Automatic"}
                  className={input}
                />
                <button type="button" data-nav onClick={pickMonitor} className={btn.small}>
                  Browse
                </button>
              </div>
            </Field>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-line/60 px-6 py-4">
          {running && <p className="text-sm text-muted">The game is running. Changes apply next time.</p>}
          <div className="ml-auto flex gap-3">
            <button type="button" data-nav onClick={onClose} className={btn.secondary}>
              Cancel
            </button>
            <button type="button" data-nav onClick={save} disabled={saving || !name.trim()} className={btn.primary}>
              Save
            </button>
          </div>
        </div>
      </div>
    </Layer>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-fg">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-2 break-words text-xs leading-5 text-muted">{hint}</p>}
    </div>
  );
}
