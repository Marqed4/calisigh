/* Ctrl + plus, Ctrl + minus and Ctrl + 0 scale every window. The scale is saved and shared through localStorage. */
import { getCurrentWebview } from "@tauri-apps/api/webview";

const KEY = "calisigh-zoom";
const MIN = 0.6;
const MAX = 2;
const STEP = 0.1;

function clamp(value) {
  return Math.min(MAX, Math.max(MIN, Math.round(value * 10) / 10));
}

function savedZoom() {
  const value = parseFloat(localStorage.getItem(KEY));
  return Number.isFinite(value) ? clamp(value) : 1;
}

function applyZoom(value) {
  getCurrentWebview().setZoom(value).catch(() => {});
}

function setZoom(value) {
  const next = clamp(value);
  try {
    localStorage.setItem(KEY, String(next));
  } catch (_) {}
  applyZoom(next);
}

export function initZoom() {
  applyZoom(savedZoom());

  window.addEventListener("keydown", (e) => {
    if (!e.ctrlKey) return;
    if (e.key === "+" || e.key === "=") setZoom(savedZoom() + STEP);
    else if (e.key === "-" || e.key === "_") setZoom(savedZoom() - STEP);
    else if (e.key === "0") setZoom(1);
    else return;
    e.preventDefault();
  });

  /* Other windows follow when one changes the scale */
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) applyZoom(savedZoom());
  });
}
