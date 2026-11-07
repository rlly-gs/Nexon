mod launcher;
mod store;
mod tracker;

use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::Mutex,
};
use store::{now, now_millis, Game, Profile, Session, Settings, Store};
use tauri::{AppHandle, Emitter, Manager, State};

type CmdResult<T> = Result<T, String>;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningGame {
    pub game_id: String,
    pub started_at: i64,
    /// `false` while Nexon is still waiting for the game's process to show up.
    pub detected: bool,
}

/// Lock order, when both are needed: `store` before `running`.
pub struct AppState {
    pub store: Mutex<Store>,
    pub running: Mutex<HashMap<String, RunningGame>>,
    pub data_dir: PathBuf,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    profile: Profile,
    settings: Settings,
    games: Vec<Game>,
    sessions: Vec<Session>,
    running: Vec<RunningGame>,
}

/// Tells the frontend something changed (it fetches the snapshot again).
pub fn notify(app: &AppHandle) {
    let _ = app.emit("nexon://changed", ());
}

fn clean(s: Option<String>) -> Option<String> {
    s.map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

/// Copies an image picked by the user into the app data folder.
fn import_image(data_dir: &Path, sub: &str, prefix: &str, src: &str) -> CmdResult<String> {
    let src = Path::new(src);
    let ext = launcher::ext_lower(src);
    if !matches!(ext.as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp") {
        return Err("Unsupported image format.".into());
    }
    let dir = data_dir.join(sub);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let dest = dir.join(format!("{prefix}-{}.{ext}", now_millis()));
    fs::copy(src, &dest).map_err(|e| format!("Couldn't copy the image: {e}"))?;
    Ok(dest.to_string_lossy().into_owned())
}

/// Deletes a file we own (only inside the data folder).
fn remove_owned_file(data_dir: &Path, path: Option<&str>) {
    if let Some(p) = path {
        let p = Path::new(p);
        if p.starts_with(data_dir) {
            let _ = fs::remove_file(p);
        }
    }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn get_snapshot(state: State<'_, AppState>) -> Snapshot {
    let store = state.store.lock().unwrap();
    let running = state.running.lock().unwrap();
    Snapshot {
        profile: store.data.profile.clone(),
        settings: store.data.settings.clone(),
        games: store.data.games.clone(),
        sessions: store.data.sessions.clone(),
        running: running.values().cloned().collect(),
    }
}

#[tauri::command]
async fn add_games(
    app: AppHandle,
    state: State<'_, AppState>,
    paths: Vec<String>,
) -> CmdResult<Vec<Game>> {
    let icons_dir = state.data_dir.join("icons");
    fs::create_dir_all(&icons_dir).map_err(|e| e.to_string())?;

    let mut added: Vec<Game> = Vec::new();
    let mut errors = Vec::new();

    for raw in paths {
        let path = PathBuf::from(&raw);
        let file_name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| raw.clone());

        if !matches!(launcher::ext_lower(&path).as_str(), "exe" | "lnk" | "url") {
            errors.push(format!("{file_name}: use an .exe, .lnk or .url file"));
            continue;
        }
        if !path.is_file() {
            errors.push(format!("{file_name}: file not found"));
            continue;
        }
        let duplicate = state
            .store
            .lock()
            .unwrap()
            .data
            .games
            .iter()
            .chain(added.iter())
            .any(|g| g.path.eq_ignore_ascii_case(&raw));
        if duplicate {
            errors.push(format!("{file_name}: already in your library"));
            continue;
        }

        let id = uuid::Uuid::new_v4().to_string();
        let icon_out = icons_dir.join(format!("{id}.png"));
        let info = launcher::inspect(&path, &icon_out);
        let name = path
            .file_stem()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| file_name.clone());

        added.push(Game {
            id,
            name,
            path: raw,
            target: info.target,
            args: info.args,
            working_dir: info.working_dir,
            monitor_exe: None,
            icon: info.icon.then(|| icon_out.to_string_lossy().into_owned()),
            cover: None,
            background: None,
            recompiled: false,
            added_at: now(),
        });
    }

    if !added.is_empty() {
        let mut store = state.store.lock().unwrap();
        store.data.games.extend(added.iter().cloned());
        store.save()?;
        drop(store);
        notify(&app);
    }
    if added.is_empty() && !errors.is_empty() {
        return Err(errors.join("\n"));
    }
    Ok(added)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GameEdit {
    name: String,
    args: Option<String>,
    monitor_exe: Option<String>,
}

#[tauri::command]
fn update_game(app: AppHandle, state: State<'_, AppState>, id: String, edit: GameEdit) -> CmdResult<()> {
    let mut store = state.store.lock().unwrap();
    let game = store
        .data
        .games
        .iter_mut()
        .find(|g| g.id == id)
        .ok_or("Game not found.")?;
    if let Some(name) = clean(Some(edit.name)) {
        game.name = name;
    }
    game.args = clean(edit.args);
    game.monitor_exe = clean(edit.monitor_exe);
    store.save()?;
    drop(store);
    notify(&app);
    Ok(())
}

#[tauri::command]
fn set_recompiled(app: AppHandle, state: State<'_, AppState>, id: String, recompiled: bool) -> CmdResult<()> {
    let mut store = state.store.lock().unwrap();
    let game = store
        .data
        .games
        .iter_mut()
        .find(|g| g.id == id)
        .ok_or("Game not found.")?;
    game.recompiled = recompiled;
    store.save()?;
    drop(store);
    notify(&app);
    Ok(())
}

/// `kind`: "cover" (portrait cover) or "background" (background art).
#[tauri::command]
fn set_game_image(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    kind: String,
    image: Option<String>,
) -> CmdResult<()> {
    let sub = match kind.as_str() {
        "cover" => "covers",
        "background" => "backgrounds",
        _ => return Err("Invalid image kind.".into()),
    };
    let new_image = match image {
        Some(src) => Some(import_image(&state.data_dir, sub, &id, &src)?),
        None => None,
    };
    let mut store = state.store.lock().unwrap();
    let game = store
        .data
        .games
        .iter_mut()
        .find(|g| g.id == id)
        .ok_or("Game not found.")?;
    let slot = if kind == "cover" { &mut game.cover } else { &mut game.background };
    let old = std::mem::replace(slot, new_image);
    store.save()?;
    drop(store);
    remove_owned_file(&state.data_dir, old.as_deref());
    notify(&app);
    Ok(())
}

#[tauri::command]
fn remove_game(app: AppHandle, state: State<'_, AppState>, id: String) -> CmdResult<()> {
    let mut store = state.store.lock().unwrap();
    if state.running.lock().unwrap().contains_key(&id) {
        return Err("Close the game before removing it.".into());
    }
    let pos = store
        .data
        .games
        .iter()
        .position(|g| g.id == id)
        .ok_or("Game not found.")?;
    let game = store.data.games.remove(pos);
    store.data.sessions.retain(|s| s.game_id != id);
    store.save()?;
    drop(store);
    remove_owned_file(&state.data_dir, game.icon.as_deref());
    remove_owned_file(&state.data_dir, game.cover.as_deref());
    remove_owned_file(&state.data_dir, game.background.as_deref());
    notify(&app);
    Ok(())
}

#[tauri::command]
fn update_settings(app: AppHandle, state: State<'_, AppState>, settings: Settings) -> CmdResult<()> {
    let mut store = state.store.lock().unwrap();
    store.data.settings = settings;
    store.save()?;
    drop(store);
    notify(&app);
    Ok(())
}

#[tauri::command]
async fn launch_game(app: AppHandle, state: State<'_, AppState>, id: String) -> CmdResult<()> {
    let game = state
        .store
        .lock()
        .unwrap()
        .data
        .games
        .iter()
        .find(|g| g.id == id)
        .cloned()
        .ok_or("Game not found.")?;

    let launched_at = now();
    {
        // Reserve the slot before launching, so two clicks don't open the game twice.
        let mut running = state.running.lock().unwrap();
        if running.contains_key(&id) {
            return Err(format!("\"{}\" is already running.", game.name));
        }
        running.insert(
            id.clone(),
            RunningGame { game_id: id.clone(), started_at: launched_at, detected: false },
        );
    }

    let pid = match launcher::launch(&game) {
        Ok(pid) => pid,
        Err(e) => {
            state.running.lock().unwrap().remove(&id);
            return Err(e);
        }
    };
    notify(&app);

    let spec = launcher::TrackSpec::for_game(&game, pid);
    let app2 = app.clone();
    std::thread::spawn(move || tracker::track(app2, id, spec, launched_at));
    Ok(())
}

#[tauri::command]
fn reveal_game(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    let path = state
        .store
        .lock()
        .unwrap()
        .data
        .games
        .iter()
        .find(|g| g.id == id)
        .map(|g| launcher::resolve_exe(g).map_or(g.path.clone(), |p| p.to_string_lossy().into_owned()))
        .ok_or("Game not found.")?;
    launcher::reveal_in_explorer(&path)
}

#[tauri::command]
fn update_profile(app: AppHandle, state: State<'_, AppState>, name: String) -> CmdResult<()> {
    let name = clean(Some(name)).ok_or("The name can't be empty.")?;
    let mut store = state.store.lock().unwrap();
    store.data.profile.name = name;
    store.save()?;
    drop(store);
    notify(&app);
    Ok(())
}

#[tauri::command]
fn set_avatar(app: AppHandle, state: State<'_, AppState>, image: Option<String>) -> CmdResult<()> {
    let new_avatar = match image {
        Some(src) => Some(import_image(&state.data_dir, "profile", "avatar", &src)?),
        None => None,
    };
    let mut store = state.store.lock().unwrap();
    let old = std::mem::replace(&mut store.data.profile.avatar, new_avatar);
    store.save()?;
    drop(store);
    remove_owned_file(&state.data_dir, old.as_deref());
    notify(&app);
    Ok(())
}

// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            let store = Store::open(&data_dir);
            app.manage(AppState {
                store: Mutex::new(store),
                running: Mutex::new(HashMap::new()),
                data_dir,
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_snapshot,
            add_games,
            update_game,
            set_recompiled,
            set_game_image,
            remove_game,
            update_settings,
            launch_game,
            reveal_game,
            update_profile,
            set_avatar,
        ])
        .run(tauri::generate_context!())
        .expect("failed to start Nexon");
}
