use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};

use crate::CREATE_NO_WINDOW;

/*
UNDERSTAND: Command inherits the parent's stdin handle by default, and on autostart
(launched via the Run key at logon) there's no valid handle to inherit yet. CreateProcess
can then hang indefinitely spawning a console-subsystem child (ollama.exe) waiting on
that. Launched interactively this isn't an issue since a real handle exists to inherit.
Without Stdio::null() here, this whole setup thread can block forever on the very first
call, which also stops java/the backend from ever getting checked or started, so this
one fix covers both symptoms.

EDGE CASES: None when launched interactively, a real stdin handle exists to inherit.

PLAN: Every Command below explicitly nulls stdin.
*/

/*
A per-user Ollama install is not on PATH for processes started before it finished, which
includes Calisigh when the installer launches it. Look in Ollama's own folder first.
*/
fn ollama_exe() -> std::path::PathBuf {
    if let Some(dir) = std::env::var_os("LOCALAPPDATA") {
        let exe = std::path::Path::new(&dir).join("Programs").join("Ollama").join("ollama.exe");
        if exe.exists() {
            return exe;
        }
    }
    "ollama".into()
}

fn server_is_up() -> bool {
    use std::net::{SocketAddr, TcpStream};
    use std::time::Duration;
    let addr: SocketAddr = "127.0.0.1:11434".parse().unwrap();
    TcpStream::connect_timeout(&addr, Duration::from_millis(500)).is_ok()
}

/* Start `ollama serve` if nothing is listening yet, and wait a little for it. */
pub fn ensure_server_running() {
    if server_is_up() {
        return;
    }
    let _ = Command::new(ollama_exe())
        .arg("serve")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .spawn();
    for _ in 0..30 {
        if server_is_up() {
            return;
        }
        std::thread::sleep(std::time::Duration::from_millis(500));
    }
}

pub fn is_ollama_installed() -> bool {
    Command::new(ollama_exe())
        .arg("--version")
        .stdin(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .is_ok()
}

/* True when any model is installed. Which one the chat uses is the user's choice. */
pub fn is_model_available() -> bool {
    ensure_server_running();
    Command::new(ollama_exe())
        .args(["list"])
        .stdin(Stdio::null())
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).lines().skip(1).any(|l| !l.trim().is_empty()))
        .unwrap_or(false)
}

pub fn pull_model_in_background() {
    std::thread::spawn(|| {
        ensure_server_running();
        let _ = Command::new(ollama_exe())
            .args(["pull", "llama3.2"])
            .stdin(Stdio::null())
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    });
}
