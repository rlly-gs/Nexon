import { useEffect, useState, type CSSProperties } from "react";
import { fileUrl, type Game } from "../api";
import { hueFor, initials } from "../format";

/** Subtle gradient for games without a cover, with a stable color derived from the name. */
export function artStyle(name: string): CSSProperties {
  const h = hueFor(name);
  return {
    background: `radial-gradient(80% 60% at 70% 30%, hsl(${h} 30% 46% / .55), transparent 70%), linear-gradient(160deg, hsl(${h} 20% 30%), hsl(${(h + 25) % 360} 22% 11%))`,
  };
}

/**
 * Game cover filling its parent (which must be `relative`).
 * Without a cover: gradient + the executable's icon (or initials) and, optionally, the name.
 */
export function CoverArt({ game, showTitle = false }: { game: Game; showTitle?: boolean }) {
  const cover = fileUrl(game.cover);
  if (cover) {
    return <img src={cover} alt="" draggable={false} className="absolute inset-0 size-full object-cover" />;
  }
  const icon = fileUrl(game.icon);
  return (
    <div className="absolute inset-0 grid place-items-center" style={artStyle(game.name)}>
      {icon ? (
        <img src={icon} alt="" draggable={false} className="w-1/3 max-w-16 drop-shadow-lg" />
      ) : (
        <span className="text-lg font-semibold text-white/80">{initials(game.name)}</span>
      )}
      {showTitle && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-10 text-left text-xs font-semibold text-white">
          {game.name}
        </span>
      )}
    </div>
  );
}

const imageKey = (g: Game) => `${g.id}|${g.background ?? ""}|${g.cover ?? ""}`;

/** Carousel background that cross-fades when the focused game changes. */
export function Backdrop({ game }: { game: Game }) {
  const key = imageKey(game);
  const [layers, setLayers] = useState([{ key, game }]);

  useEffect(() => {
    setLayers((ls) => {
      const top = ls[ls.length - 1];
      if (top?.key === key) return ls.slice(0, -1).concat({ key, game });
      return [...ls.slice(-1), { key, game }];
    });
  }, [key, game]);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {layers.map((l) => (
        <BackdropImage key={l.key} game={l.game} />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-canvas from-25% via-canvas/80 via-50% to-canvas/10" />
      <div className="absolute inset-0 bg-gradient-to-t from-canvas from-20% via-canvas/40 via-50% to-transparent" />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-canvas/70 to-transparent" />
    </div>
  );
}

function BackdropImage({ game }: { game: Game }) {
  const bg = fileUrl(game.background);
  const cover = fileUrl(game.cover);
  return (
    <div className="absolute inset-y-0 right-0 w-full animate-bg-in overflow-hidden lg:w-[72%]">
      {bg ? (
        <img src={bg} alt="" draggable={false} className="size-full object-cover" />
      ) : cover ? (
        // Portrait cover stretched as a background: a slight blur hides the upscaling.
        <img src={cover} alt="" draggable={false} className="size-full scale-110 object-cover blur-md" />
      ) : (
        <div className="size-full" style={artStyle(game.name)} />
      )}
    </div>
  );
}
