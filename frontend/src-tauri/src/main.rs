#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod backend;
mod commands;
mod java_runtime;
mod logging;
mod ollama;
mod startup;
mod tray;

use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};

use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;

use logging::log_line;

pub(crate) const CREATE_NO_WINDOW: u32 = 0x08000000;

/*
UNDERSTAND: Right after boot the JRE install can still be settling (fresh MSI install,
AV scanning the new files, PATH not fully populated yet) and the startup checks in
startup.rs end up believing java isn't there when it actually just isn't ready yet.

EDGE CASES: Only do this once per boot (the "restarted" flag), otherwise every
autostart launch would just restart itself forever. Also: spawning the new instance
before this one is dead loses the single-instance race, the new process just forwards
to this one over IPC and exits immediately, leaving nothing running once this one is
killed. So a detached helper watches this exact PID and only starts the new instance
once it's actually gone, no window where both or neither are alive. Tried doing this
with `cmd /C ... & start "" "<path>"` first: cmd's own quote-stripping for `/C` on top
of Rust's arg quoting mangled the path and threw a "Windows cannot find '\\'" dialog.
PowerShell's Start-Process takes a plain argument list instead of a hand-quoted string,
so there's nothing left to mangle.

PLAN: Give the whole app a kick, kill it and auto-launch it again a little later.
Reliably fixes it since by the second launch everything's had time to settle.
*/
fn schedule_autostart_restart() {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(7));
        log_line("autostart restart: relaunching so the JRE has time to settle");

        backend::kill();

        if let Ok(exe) = std::env::current_exe() {
            let pid = std::process::id();
            let exe_str = exe.to_string_lossy().replace('\'', "''");
            let ps_script = format!(
                "Wait-Process -Id {pid} -ErrorAction SilentlyContinue; Start-Process -FilePath '{exe_str}' -ArgumentList '--autostart','--restarted'"
            );
            let _ = Command::new("powershell")
                .args(["-NoProfile", "-WindowStyle", "Hidden", "-Command", &ps_script])
                .stdin(Stdio::null())
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }

        std::process::exit(0);
    });
}

fn main() {
    tauri::Builder::default()
        // keep this first, it needs to grab the lock before anything else has a chance to stall
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            tray::show_main_window(app);
        }))
        .plugin(tauri_plugin_autostart::Builder::new().args(vec!["--autostart"]).build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            tray::build(app)?;

            let autolaunch = app.autolaunch();
            let _ = autolaunch.enable();

            let is_autostart = std::env::args().any(|a| a == "--autostart");
            if let Some(win) = app.get_webview_window("main") {
                if is_autostart {
                    let _ = win.set_skip_taskbar(true);
                    let _ = win.hide();
                } else {
                    let _ = win.set_skip_taskbar(false);
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }

            /*
            UNDERSTAND: The backend environment checks (Ollama, Java, and other startup
            probes) can take a long time or even hang right after system boot.
            Previously, `setup()` waited for all of these checks to finish before
            returning. Tauri does not begin processing window events until `setup()`
            completes, so the single-instance handler never received the relaunch
            message sent by a second app invocation. The second launch would then
            block forever waiting for a reply that never arrived, and each retry
            created an additional zombie process.

            PLAN: Move all slow initialization work (see `startup.rs`) into a separate
            thread so `setup()` returns immediately. This allows Tauri to start pumping
            window messages right away, ensuring the single-instance lock and relaunch
            behavior work correctly.
            */

            let is_restarted = std::env::args().any(|a| a == "--restarted");
            if is_autostart && !is_restarted {
                schedule_autostart_restart();
            }

            let app_handle = app.handle().clone();
            std::thread::spawn(move || startup::run(app_handle, is_autostart));

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                tauri::WindowEvent::CloseRequested { api, .. } => {
                    if window.label() == "main" {
                        api.prevent_close();
                        let _ = window.set_skip_taskbar(true);
                        let _ = window.hide();
                    }
                }
                tauri::WindowEvent::Destroyed => {
                    if window.label() == "main" {
                        backend::kill();
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![commands::list_system_fonts])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
