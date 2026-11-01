import { invoke } from "@tauri-apps/api/core";

const KEY = "calisigh-font";
const FALLBACK_STACK = '"Segoe UI Variable", "Segoe UI", system-ui, -apple-system, sans-serif';

/* Saved font family, "" for the default. Earlier versions saved pack names, which are ignored. */
export function savedFont() {
  const saved = localStorage.getItem(KEY) ?? "";
  return saved === "mingliu" || saved === "graffiti" ? "" : saved;
}

export function saveFont(name) {
  if (name) localStorage.setItem(KEY, name);
  else localStorage.removeItem(KEY);
}

/* Every window styles itself with var(--font-ui), so one property switches all text */
export function applyFont(name = savedFont()) {
  const family = name ? `"${name.replace(/"/g, "")}", ${FALLBACK_STACK}` : FALLBACK_STACK;
  document.documentElement.style.setProperty("--font-ui", family);
}

/* Applies the saved font now and again whenever another window changes it */
export function keepFontApplied() {
  applyFont();
  const onStorage = (e) => { if (e.key === KEY) applyFont(); };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export async function listFonts() {
  try {
    return await invoke("list_system_fonts");
  } catch (_) {
    return [];
  }
}
