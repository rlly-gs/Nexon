import { Glyph } from "./ui";

/** Controller button legend; only shown while a controller is connected. */
export function HintsBar({ pad, inLayer }: { pad: string; inLayer: boolean }) {
  return (
    <footer className="relative z-20 flex flex-wrap items-center gap-x-5 gap-y-2 px-8 py-3 text-xs text-muted lg:px-10">
      <Hint glyph="A" label="Select" />
      <Hint glyph="B" label="Back" />
      {!inLayer && (
        <>
          <Hint glyph="X" label="Details" />
          <Hint glyph="Y" label="Profile" />
          <Hint glyph="LB RB" label="Tabs" wide />
          <Hint glyph="☰" label="Full screen" />
          <Hint glyph="⧉" label="Appearance" />
        </>
      )}
      <span className="ml-auto truncate">{pad}</span>
    </footer>
  );
}

function Hint({ glyph, label, wide }: { glyph: string; label: string; wide?: boolean }) {
  return (
    <span className="inline-flex items-center gap-x-1.5">
      <Glyph round={!wide}>{glyph}</Glyph>
      {label}
    </span>
  );
}
