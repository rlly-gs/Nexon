//! Nexon's local persistence: a single JSON file in the app data folder
//! (%APPDATA%\com.nexon.app\nexon.json).

use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

/// Seconds since the Unix epoch.
pub fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Profile {
    pub name: String,
    pub avatar: Option<String>,
    pub created_at: i64,
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Game {
    pub id: String,
    pub name: String,
    /// File the user linked (.exe, .lnk or .url).
    pub path: String,
    /// Resolved shortcut target (.lnk → exe, .url → URL).
    pub target: Option<String>,
    /// Launch arguments.
    pub args: Option<String>,
    pub working_dir: Option<String>,
    /// The game's real executable, used to track playtime when Nexon can't
    /// follow the process on its own (e.g. Steam games launched via .url).
    pub monitor_exe: Option<String>,
    pub icon: Option<String>,
    /// Portrait cover (3:4), used on the cards.
    pub cover: Option<String>,
    /// Landscape art used as the carousel background (falls back to the cover).
    pub background: Option<String>,
    /// Marked by the user as a recompiled (native PC port) version of the game.
    pub recompiled: bool,
    /// Dominant hues (0-360) of the cover, used to tint the holographic foil.
    /// `None` = not analyzed yet; empty = the cover has no strong colors.
    pub palette: Option<Vec<f32>>,
    pub added_at: i64,
}

/// Appearance chosen by the user.
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    /// "zinc" | "slate" | "stone"
    pub base: String,
    /// "indigo" | "sky" | "emerald" | "amber" | "mono"
    pub accent: String,
    /// "system" | "dark" | "light"
    pub mode: String,
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            base: "zinc".into(),
            accent: "indigo".into(),
            mode: "system".into(),
        }
    }
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Session {
    pub id: String,
    pub game_id: String,
    pub start: i64,
    pub end: i64,
}

#[derive(Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct Data {
    pub version: u32,
    pub profile: Profile,
    pub settings: Settings,
    pub games: Vec<Game>,
    pub sessions: Vec<Session>,
}

pub struct Store {
    path: PathBuf,
    pub data: Data,
}

impl Store {
    pub fn open(dir: &Path) -> Self {
        let path = dir.join("nexon.json");
        let data = match fs::read_to_string(&path) {
            Ok(text) => match serde_json::from_str::<Data>(&text) {
                Ok(data) => data,
                Err(_) => {
                    // Never overwrite a file we couldn't read: keep a copy
                    // before starting from scratch.
                    let backup = dir.join(format!("nexon.corrupt-{}.json", now()));
                    let _ = fs::rename(&path, backup);
                    Data::fresh()
                }
            },
            Err(_) => Data::fresh(),
        };
        Self { path, data }
    }

    /// Writes atomically (temporary file + rename).
    pub fn save(&self) -> Result<(), String> {
        let json = serde_json::to_string_pretty(&self.data).map_err(|e| e.to_string())?;
        let tmp = self.path.with_extension("json.tmp");
        fs::write(&tmp, json).map_err(|e| format!("Couldn't save data: {e}"))?;
        fs::rename(&tmp, &self.path).map_err(|e| format!("Couldn't save data: {e}"))
    }
}

impl Data {
    fn fresh() -> Self {
        Data {
            version: 1,
            profile: Profile {
                name: "Player".into(),
                avatar: None,
                created_at: now(),
            },
            settings: Settings::default(),
            games: Vec::new(),
            sessions: Vec::new(),
        }
    }
}
