//! Everything about game files: inspecting them (.exe/.lnk/.url), extracting
//! icons, launching the game and deciding which processes belong to it.

use crate::store::Game;
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Deserialize;
use std::{
    ffi::OsStr,
    fs,
    os::windows::{ffi::OsStrExt, process::CommandExt},
    path::{Path, PathBuf},
    process::{Command, Stdio},
};

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const ERROR_ELEVATION_REQUIRED: i32 = 740;

pub fn ext_lower(path: &Path) -> String {
    path.extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default()
}

fn non_empty(s: Option<String>) -> Option<String> {
    s.map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
}

// ---------------------------------------------------------------------------
// Inspection
// ---------------------------------------------------------------------------

pub struct Inspected {
    pub target: Option<String>,
    pub args: Option<String>,
    pub working_dir: Option<String>,
    pub icon: bool,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct PsInspect {
    target: Option<String>,
    args: Option<String>,
    working_dir: Option<String>,
    icon: bool,
}

/// Reads .lnk shortcuts (via WScript.Shell) and extracts the icon to `icon_out` (PNG).
const INSPECT_SCRIPT: &str = r#"
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$p = $env:NEXON_PATH
$out = $env:NEXON_ICON_OUT
$src = $env:NEXON_ICON_SRC
$r = [ordered]@{ target = $null; args = $null; workingDir = $null; icon = $false }
if ($p.ToLower().EndsWith('.lnk')) {
  $s = (New-Object -ComObject WScript.Shell).CreateShortcut($p)
  $r.target = $s.TargetPath
  $r.args = $s.Arguments
  $r.workingDir = $s.WorkingDirectory
  if (-not $src -and $s.IconLocation) {
    $il = $s.IconLocation.Split(',')[0]
    if ($il -and $il.ToLower().EndsWith('.ico') -and (Test-Path -LiteralPath $il)) { $src = $il }
  }
}
if (-not $src) {
  if ($r.target -and (Test-Path -LiteralPath $r.target)) { $src = $r.target } else { $src = $p }
}
Add-Type -AssemblyName System.Drawing
try {
  if ($src.ToLower().EndsWith('.ico')) { $ico = New-Object System.Drawing.Icon($src, 256, 256) }
  else { $ico = [System.Drawing.Icon]::ExtractAssociatedIcon($src) }
  if ($ico) {
    $ico.ToBitmap().Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
    $r.icon = $true
  }
} catch {}
$r | ConvertTo-Json -Compress
"#;

fn run_powershell(script: &str, envs: &[(&str, &OsStr)]) -> Option<String> {
    let utf16: Vec<u8> = script
        .encode_utf16()
        .flat_map(|u| u.to_le_bytes())
        .collect();
    let mut cmd = Command::new("powershell.exe");
    cmd.args([
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-EncodedCommand",
        &STANDARD.encode(utf16),
    ])
    .stdin(Stdio::null())
    .creation_flags(CREATE_NO_WINDOW);
    for (k, v) in envs {
        cmd.env(k, v);
    }
    let out = cmd.output().ok()?;
    Some(String::from_utf8_lossy(&out.stdout).into_owned())
}

pub fn inspect(path: &Path, icon_out: &Path) -> Inspected {
    let mut url_target = None;
    let mut icon_src = String::new();

    // .url files (e.g. Steam shortcuts) are a simple INI: URL=... and IconFile=...
    if ext_lower(path) == "url" {
        if let Ok(bytes) = fs::read(path) {
            for line in String::from_utf8_lossy(&bytes).lines() {
                let line = line.trim();
                if let Some(v) = line.strip_prefix("URL=") {
                    url_target = Some(v.to_string());
                } else if let Some(v) = line.strip_prefix("IconFile=") {
                    if Path::new(v).exists() {
                        icon_src = v.to_string();
                    }
                }
            }
        }
    }

    let ps = run_powershell(
        INSPECT_SCRIPT,
        &[
            ("NEXON_PATH", path.as_os_str()),
            ("NEXON_ICON_OUT", icon_out.as_os_str()),
            ("NEXON_ICON_SRC", OsStr::new(&icon_src)),
        ],
    )
    .and_then(|out| {
        let start = out.find('{')?;
        let end = out.rfind('}')?;
        serde_json::from_str::<PsInspect>(&out[start..=end]).ok()
    })
    .unwrap_or_default();

    Inspected {
        target: non_empty(ps.target).or(url_target),
        args: non_empty(ps.args),
        working_dir: non_empty(ps.working_dir),
        icon: ps.icon && icon_out.exists(),
    }
}

// ---------------------------------------------------------------------------
// Launching
// ---------------------------------------------------------------------------

/// The executable Nexon can start directly (and follow by PID).
pub fn resolve_exe(game: &Game) -> Option<PathBuf> {
    if let Some(t) = &game.target {
        let p = PathBuf::from(t);
        if ext_lower(&p) == "exe" && p.exists() {
            return Some(p);
        }
    }
    let p = PathBuf::from(&game.path);
    (ext_lower(&p) == "exe" && p.exists()).then_some(p)
}

/// Starts the game. Returns the PID when Nexon created the process directly.
pub fn launch(game: &Game) -> Result<Option<u32>, String> {
    let args = game.args.as_deref().filter(|a| !a.trim().is_empty());

    if let Some(exe) = resolve_exe(game) {
        let wd = game
            .working_dir
            .as_deref()
            .map(PathBuf::from)
            .filter(|d| d.is_dir())
            .or_else(|| exe.parent().map(Path::to_path_buf))
            .unwrap_or_else(|| PathBuf::from("."));

        let mut cmd = Command::new(&exe);
        cmd.current_dir(&wd)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        if let Some(a) = args {
            cmd.raw_arg(a);
        }
        return match cmd.spawn() {
            Ok(child) => Ok(Some(child.id())),
            // The game requires administrator rights: let Windows show the UAC prompt.
            Err(e) if e.raw_os_error() == Some(ERROR_ELEVATION_REQUIRED) => {
                shell_execute(exe.as_os_str(), args, Some(&wd))?;
                Ok(None)
            }
            Err(e) => Err(format!("Couldn't open \"{}\": {e}", game.name)),
        };
    }

    let path = Path::new(&game.path);
    if !path.exists() {
        return Err(format!(
            "The file for \"{}\" wasn't found:\n{}",
            game.name, game.path
        ));
    }
    shell_execute(path.as_os_str(), None, None)?;
    Ok(None)
}

fn wide(s: &OsStr) -> Vec<u16> {
    s.encode_wide().chain(Some(0)).collect()
}

/// Opens a file/URL with the default Windows handler (ShellExecuteW).
pub fn shell_execute(file: &OsStr, params: Option<&str>, dir: Option<&Path>) -> Result<(), String> {
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    use windows_sys::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let verb = wide(OsStr::new("open"));
    let file_w = wide(file);
    let params_w = params.map(|p| wide(OsStr::new(p)));
    let dir_w = dir.map(|d| wide(d.as_os_str()));

    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            file_w.as_ptr(),
            params_w.as_ref().map_or(std::ptr::null(), |p| p.as_ptr()),
            dir_w.as_ref().map_or(std::ptr::null(), |d| d.as_ptr()),
            SW_SHOWNORMAL,
        )
    };
    if result as isize > 32 {
        Ok(())
    } else {
        Err(format!("Windows couldn't open the file (code {}).", result as isize))
    }
}

pub fn reveal_in_explorer(path: &str) -> Result<(), String> {
    Command::new("explorer.exe")
        .raw_arg(format!("/select,\"{path}\""))
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Which processes belong to the game
// ---------------------------------------------------------------------------

fn norm(p: &Path) -> String {
    p.to_string_lossy().to_lowercase().replace('/', "\\")
}

fn norm_dir(p: &Path) -> String {
    let mut s = norm(p);
    if !s.ends_with('\\') {
        s.push('\\');
    }
    s
}

/// Avoids counting processes from generic folders (drive root, Windows, Program Files...).
fn dir_is_specific(dir: &Path) -> bool {
    if dir.components().count() <= 2 {
        return false;
    }
    let d = norm_dir(dir);
    let env_dir = |k: &str| std::env::var_os(k).map(|v| norm_dir(Path::new(&v)));
    if let Some(win) = env_dir("WINDIR") {
        if d.starts_with(&win) {
            return false;
        }
    }
    let generic: Vec<String> = ["ProgramFiles", "ProgramFiles(x86)", "USERPROFILE", "PUBLIC"]
        .iter()
        .filter_map(|k| env_dir(k))
        .collect();
    if generic.iter().any(|g| *g == d) {
        return false;
    }
    if let Some(home) = env_dir("USERPROFILE") {
        for sub in ["desktop\\", "downloads\\", "documents\\"] {
            if d == format!("{home}{sub}") {
                return false;
            }
        }
    }
    true
}

pub struct TrackSpec {
    pub root_pid: Option<u32>,
    dir: Option<String>,
    exe_name: Option<String>,
    explicit: bool,
}

impl TrackSpec {
    pub fn for_game(game: &Game, root_pid: Option<u32>) -> Self {
        let explicit = game.monitor_exe.is_some();
        let exe = game
            .monitor_exe
            .as_deref()
            .map(PathBuf::from)
            .or_else(|| resolve_exe(game));
        let dir = exe
            .as_deref()
            .and_then(Path::parent)
            .filter(|d| dir_is_specific(d))
            .map(norm_dir);
        let exe_name = exe
            .as_deref()
            .and_then(Path::file_name)
            .map(|n| n.to_string_lossy().to_lowercase());
        Self { root_pid, dir, exe_name, explicit }
    }

    /// A process belongs to the game if its executable lives in the game's
    /// folder (covers launchers and games that restart through Steam) or, when
    /// the path can't be read (elevated process), by executable name.
    pub fn matches(&self, exe: Option<&Path>, name: &str) -> bool {
        let name_hit = self
            .exe_name
            .as_deref()
            .is_some_and(|n| n.eq_ignore_ascii_case(name));
        if self.explicit && name_hit {
            return true;
        }
        match exe {
            Some(e) if !e.as_os_str().is_empty() => self
                .dir
                .as_deref()
                .is_some_and(|d| norm(e).starts_with(d)),
            _ => name_hit,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tmp_png(name: &str) -> PathBuf {
        let p = std::env::temp_dir().join(format!("nexon-test-{name}.png"));
        let _ = fs::remove_file(&p);
        p
    }

    #[test]
    fn inspects_exe_and_extracts_icon() {
        let windir = std::env::var("WINDIR").unwrap();
        let exe = Path::new(&windir).join("notepad.exe");
        let out = tmp_png("exe");
        let info = inspect(&exe, &out);
        assert!(info.icon, "icon was not extracted");
        assert!(fs::metadata(&out).unwrap().len() > 100);
    }

    #[test]
    fn resolves_lnk_target() {
        // Creates a test shortcut pointing at notepad (non-ASCII name on purpose).
        let lnk = std::env::temp_dir().join("Nexon Test Á.lnk");
        let script = r#"
$s = (New-Object -ComObject WScript.Shell).CreateShortcut($env:NEXON_LNK)
$s.TargetPath = "$env:WINDIR\notepad.exe"
$s.Arguments = '/A "file with spaces ç.txt"'
$s.WorkingDirectory = $env:TEMP
$s.Save()
"#;
        run_powershell(script, &[("NEXON_LNK", lnk.as_os_str())]).unwrap();
        let out = tmp_png("lnk");
        let info = inspect(&lnk, &out);
        let _ = fs::remove_file(&lnk);
        assert!(info.target.unwrap().to_lowercase().ends_with("notepad.exe"));
        assert_eq!(info.args.as_deref(), Some("/A \"file with spaces ç.txt\""));
        assert!(info.working_dir.is_some());
        assert!(info.icon);
    }

    #[test]
    fn track_spec_matching() {
        let game = Game {
            path: r"D:\Games\MyGame\bin\game.exe".into(),
            ..Default::default()
        };
        // resolve_exe requires the file to exist; simulate it via monitor_exe.
        let game = Game { monitor_exe: Some(game.path.clone()), ..game };
        let spec = TrackSpec::for_game(&game, None);
        assert!(spec.matches(Some(Path::new(r"D:\Games\MyGame\bin\game.exe")), "game.exe"));
        assert!(spec.matches(Some(Path::new(r"d:\games\mygame\bin\crash.exe")), "crash.exe"));
        assert!(!spec.matches(Some(Path::new(r"D:\Games\Other\game2.exe")), "game2.exe"));
        // Elevated process (unreadable path): falls back to the name.
        assert!(spec.matches(None, "GAME.EXE"));
        assert!(!spec.matches(None, "explorer.exe"));
    }

    #[test]
    fn generic_dirs_are_not_used_for_matching() {
        let windir = std::env::var("WINDIR").unwrap();
        assert!(!dir_is_specific(Path::new(&windir).join("System32").as_path()));
        assert!(!dir_is_specific(Path::new(r"C:\")));
        assert!(dir_is_specific(Path::new(r"D:\Games\MyGame")));
    }
}
