use tauri_plugin_dialog::DialogExt;

use crate::backend;
use crate::java_runtime;
use crate::logging::log_line;
use crate::ollama;

/*
UNDERSTAND: Everything here talks to external processes (ollama, java, msiexec) and
can block for a while, especially right after a cold boot.

PLAN: Runs on its own thread. See main.rs's setup() for why it can't run inline there.

TODO: Also check clear toast notifications on auto start.
*/
pub fn run(app_handle: tauri::AppHandle, is_autostart: bool) {
    log_line(&format!("--- setup thread starting, autostart={} ---", is_autostart));

    check_ollama(&app_handle, is_autostart);

    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| std::path::PathBuf::from("."));
    log_line(&format!("exe_dir: {:?}", exe_dir));

    if !ensure_java(&app_handle, &exe_dir, is_autostart) {
        return;
    }

    let mut found_jar = None;
    retry_if_autostart(is_autostart, || {
        found_jar = backend::find_jar(&exe_dir);
        found_jar.is_some()
    });

    let jar_path = match found_jar {
        Some(p) => p,
        None => {
            log_line("Can't find CustomCalendar.jar anywhere. Giving up. Not like it matters.");
            return;
        }
    };
    log_line(&format!("Found JAR at: {:?}", jar_path));

    let already_running = backend::is_running();
    log_line(&format!("already_running: {}", already_running));

    if already_running {
        log_line("Backend already running, skipping.");
        return;
    }

    backend::spawn(&jar_path);
}

/*
UNDERSTAND: Right after boot, PATH may not be fully populated yet for processes launched
via the autostart Run key, and AV can still be holding a lock on freshly-installed exes.
These checks are cheap and the failure mode (falsely reporting "not installed") is
annoying enough to be worth a few retries before we believe it.

EDGE CASES: Only retry on autostart. A manual launch happens well after boot has
settled and shouldn't need this.
*/
fn retry_if_autostart(is_autostart: bool, mut check: impl FnMut() -> bool) -> bool {
    if !is_autostart {
        return check();
    }
    for attempt in 0..4 {
        if check() {
            return true;
        }
        if attempt < 3 {
            std::thread::sleep(std::time::Duration::from_secs(3));
        }
    }
    false
}

fn check_ollama(app_handle: &tauri::AppHandle, is_autostart: bool) {
    if !retry_if_autostart(is_autostart, ollama::is_ollama_installed) {
        log_line("Ollama not found on PATH");
        if is_autostart {
            log_line("Autostart run, Skipping blocking dialog for missing ollama");
        } else {
            app_handle
                .dialog()
                .message("Whatever, like, Calisigh needs Ollama for the chat thing and it's just not here; typical: \n\n get it from https://ollama.com/download and open Calisigh again, I'll grab the chat model myself.\n\nnobody ever explains anything to me either.")
                .title("Ollama's missing, come on dude.")
                .blocking_show();
        }
    } else if !ollama::is_model_available() {
        log_line("ollama found but no model installed, pulling llama3.2 in background");
        ollama::pull_model_in_background();
    } else {
        log_line("ollama + at least one model OK");
    }
}

fn ensure_java(app_handle: &tauri::AppHandle, exe_dir: &std::path::Path, is_autostart: bool) -> bool {
    if retry_if_autostart(is_autostart, java_runtime::is_java_installed) {
        return true;
    }

    log_line("java not found on PATH, installing bundled JRE");
    if !is_autostart {
        app_handle
            .dialog()
            .message("No Java installed, I guess you don't even want to use the app.
            \n\n I'll try doing it myself, like always. ughhh. \n\n Installing the bundled Java Runtime Environment now. \n\n
            This'll take a minute, don't wait up.")
            .title("Installing java. I'll excuse it cuz its your first time.")
            .blocking_show();
    }

    match java_runtime::install_jre(exe_dir) {
        Ok(_) => {
            log_line("Hey, listen! JRE installed successfully");
            if !is_autostart {
                app_handle
                    .dialog()
                    .message("So now that we installed Java 21 things should be working \n\n Yea, emo but not incompetent...")
                    .title("Java's in now, maybe, like, say thank you? Whatever.")
                    .blocking_show();
            }
            true
        }
        Err(e) => {
            log_line(&format!("JRE install failed... of course it did, yup. {}", e));
            if is_autostart {
                log_line("Autostart run: skipping failure dialog, leaving backend down");
                false
            } else {
                app_handle
                    .dialog()
                    .message(&format!(
                        "Hah, of course it failed, I'm a failure: \n\n {} \n\n guess you'll have to install Java 21 yourself,
                        maybe use the one from https://adoptium.net? \n\n Totally figures.",
                        e
                    ))
                    .title("Java install failed. Nothing works. Everything is pointless. ")
                    .blocking_show();
                std::process::exit(1);
            }
        }
    }
}