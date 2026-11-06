# Nexon

A hub for launching your games and tracking how long you play them. Built with Tauri 2, React, TypeScript and Tailwind CSS 3.

## Running

```bash
npm install
npm run tauri dev      # development (hot reload)
npm run tauri build    # builds the installer into src-tauri/target/release/bundle/nsis
```

Requirements on Windows: Node.js, Rust (rustup) and Visual Studio Build Tools with the C++ workload.

## How it works

- **Library**: add an `.exe`, a `.lnk` shortcut or a Steam `.url` shortcut with the button or by dragging it onto the window.
- **Playtime tracking**: when a game is launched from Nexon, it follows the game's process, its child processes and any executable inside the game's folder (this covers launchers and games that restart through Steam). The session is saved every 30 s and ends 15 s after the last process exits.
- **Steam games via `.url`**: Nexon can't know which `.exe` Steam will start. Under *Details → Edit → Executable to track*, pick the game's real `.exe`.
- **Carousel**: the background and details follow the focused game. Each game can have a portrait cover (3:4) and a landscape background (*Details → Edit*).
- **Controller**: D-pad/left stick move focus; A selects, B goes back, X opens details, Y opens the profile, LB/RB switch tabs, Start toggles full screen and View opens Appearance. Keyboard: arrows, Enter, Esc and F11.
- **Appearance**: mode (system/dark/light), neutral base (Zinc, Slate, Stone) and accent color. Colors are CSS variables (`src/theme.ts`) wired into Tailwind in `tailwind.config.js`.
- **Data**: `%APPDATA%\com.nexon.app\nexon.json` (plus the `icons`, `covers`, `backgrounds` and `profile` folders).

## Project layout

| Path | Contents |
| --- | --- |
| `src-tauri/src/lib.rs` | Commands called by the UI |
| `src-tauri/src/store.rs` | Data model and JSON persistence |
| `src-tauri/src/launcher.rs` | Reading shortcuts, extracting icons, launching games, deciding which processes count |
| `src-tauri/src/tracker.rs` | Thread that tracks each play session |
| `src/nav.ts` | Spatial navigation (directional focus) and modal layers |
| `src/hooks.ts` | `useGamepad` (controller input) and `useNow` |
| `src/theme.ts` | Palettes and theme application |
| `src/components/` | Top bar, Carousel, Details, Profile, Edit game, Appearance |
