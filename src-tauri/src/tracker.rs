//! Playtime tracking: follows the game's processes on a dedicated thread
//! and saves the session to disk periodically.

use crate::{launcher::TrackSpec, notify, store::{now, Session}, AppState};
use std::{collections::HashSet, thread, time::Duration};
use sysinfo::{ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};
use tauri::{AppHandle, Manager};

const POLL: Duration = Duration::from_secs(2);
/// How long to wait for the game to show up (launchers/Steam can be slow).
const DETECT_TIMEOUT: i64 = 120;
/// Grace period after the last process exits (games that restart themselves).
const EXIT_GRACE: i64 = 15;
/// How often the running session is saved.
const CHECKPOINT: i64 = 30;

pub fn track(app: AppHandle, game_id: String, spec: TrackSpec, launched_at: i64) {
    let mut sys = System::new();
    let refresh = ProcessRefreshKind::nothing().with_exe(UpdateKind::OnlyIfNotSet);
    let mut tracked: HashSet<u32> = spec.root_pid.into_iter().collect();
    let mut session_id: Option<String> = None;
    let mut last_seen = launched_at;
    let mut last_checkpoint = launched_at;

    loop {
        thread::sleep(POLL);
        sys.refresh_processes_specifics(ProcessesToUpdate::All, true, refresh);

        let mut alive = HashSet::new();
        for (pid, p) in sys.processes() {
            let pid = pid.as_u32();
            let in_tree = tracked.contains(&pid)
                || p.parent().is_some_and(|pp| tracked.contains(&pp.as_u32()));
            if in_tree || spec.matches(p.exe(), &p.name().to_string_lossy()) {
                alive.insert(pid);
            }
        }
        tracked = alive;

        let t = now();
        if !tracked.is_empty() {
            last_seen = t;
            match &session_id {
                None => {
                    // Launched directly: count from the click. Via the shell: from detection.
                    let start = if spec.root_pid.is_some() { launched_at } else { t };
                    session_id = Some(begin_session(&app, &game_id, start, t));
                    last_checkpoint = t;
                }
                Some(sid) if t - last_checkpoint >= CHECKPOINT => {
                    save_session_end(&app, sid, t);
                    last_checkpoint = t;
                }
                _ => {}
            }
        } else if session_id.is_none() {
            if t - launched_at > DETECT_TIMEOUT {
                break;
            }
        } else if t - last_seen >= EXIT_GRACE {
            break;
        }
    }

    if let Some(sid) = &session_id {
        save_session_end(&app, sid, last_seen);
    }
    let state = app.state::<AppState>();
    state.running.lock().unwrap().remove(&game_id);
    notify(&app);
}

fn begin_session(app: &AppHandle, game_id: &str, start: i64, end: i64) -> String {
    let state = app.state::<AppState>();
    let id = uuid::Uuid::new_v4().to_string();
    {
        let mut store = state.store.lock().unwrap();
        store.data.sessions.push(Session {
            id: id.clone(),
            game_id: game_id.to_string(),
            start,
            end,
        });
        let _ = store.save();
    }
    if let Some(r) = state.running.lock().unwrap().get_mut(game_id) {
        r.detected = true;
        r.started_at = start;
    }
    notify(app);
    id
}

fn save_session_end(app: &AppHandle, session_id: &str, end: i64) {
    let state = app.state::<AppState>();
    let mut store = state.store.lock().unwrap();
    if let Some(s) = store.data.sessions.iter_mut().find(|s| s.id == session_id) {
        s.end = end.max(s.start);
    }
    let _ = store.save();
}
