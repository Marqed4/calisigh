import { convertFileSrc } from "@tauri-apps/api/core";
import { DefaultBackgrounds } from "../resources/assets/images/Backgrounds/index.js";

/* Keys match what Settings saves to localStorage ("calisigh-bg") */
export const BG_MAP = {
  barn: DefaultBackgrounds.Barn,
  lakeside: DefaultBackgrounds.Lake,
  peace: DefaultBackgrounds.Peace,
  silos: DefaultBackgrounds.Silo,
  summer: DefaultBackgrounds.Summer,
  tree: DefaultBackgrounds.Tree,
  fall: DefaultBackgrounds.Fall,
  winter: DefaultBackgrounds.Winter,
};

/*
  Shared by every window. Resolves the saved background, including custom
  uploads (stored by Settings as "name|&path" entries in calisigh-custom-bgs),
  and falls back to "fall".
*/
export function getBackground() {
  const saved = localStorage.getItem("calisigh-bg") ?? "fall";
  if (BG_MAP[saved]) return BG_MAP[saved];
  try {
    const customs = JSON.parse(localStorage.getItem("calisigh-custom-bgs") ?? "[]");
    const entry = customs.find(e => e.split("|&")[0] === saved);
    if (entry) return convertFileSrc(entry.split("|&")[1]);
  } catch (_) {}
  return BG_MAP.fall;
}
