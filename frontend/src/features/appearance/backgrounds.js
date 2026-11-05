import { convertFileSrc } from "@tauri-apps/api/core";
import { DefaultBackgrounds } from "./backgroundImages/index.js";

/*
The one list of built-in backgrounds. Settings shows a card for each, and getBackground looks the
saved value up here. Add a new built-in picture here (and in backgroundImages/index.js) and it
shows up everywhere. Values are what Settings saves to localStorage ("calisigh-bg").
*/
export const BACKGROUNDS = [
  { label: "Barn", value: "barn", src: DefaultBackgrounds.Barn },
  { label: "Lake", value: "lakeside", src: DefaultBackgrounds.Lake },
  { label: "Peace", value: "peace", src: DefaultBackgrounds.Peace },
  { label: "Silos", value: "silos", src: DefaultBackgrounds.Silo },
  { label: "Summer", value: "summer", src: DefaultBackgrounds.Summer },
  { label: "Tree", value: "tree", src: DefaultBackgrounds.Tree },
  { label: "Fall", value: "fall", src: DefaultBackgrounds.Fall },
  { label: "Winter", value: "winter", src: DefaultBackgrounds.Winter },
  { label: "Sandstone", value: "sandstone", src: DefaultBackgrounds.Sandstone },
  { label: "PaleStone", value: "palestone", src: DefaultBackgrounds.PaleStone },
  { label: "PlasterWall", value: "plasterwall", src: DefaultBackgrounds.PlasterWall },
  { label: "StaticSand", value: "staticsand", src: DefaultBackgrounds.StaticSand },
];

export const BG_MAP = Object.fromEntries(BACKGROUNDS.map(bg => [bg.value, bg.src]));

/* These used to be custom uploads saved under prefixed names */
const RENAMED = {
  day_Sandstone: "sandstone",
  day_PaleStone: "palestone",
  night_PlasterWall: "plasterwall",
  night_StaticSand: "staticsand",
};

export function saveBackground(key, customEntries) {
  localStorage.setItem("calisigh-bg", key);
  localStorage.setItem("calisigh-custom-bgs", JSON.stringify(customEntries));
}

export function savedBgKey() {
  const stored = localStorage.getItem("calisigh-bg") ?? "fall";
  return RENAMED[stored] ?? stored;
}

/*
  Shared by every window. Resolves the saved background, including custom
  uploads (stored by Settings as "name|&path" entries in calisigh-custom-bgs),
  and falls back to "fall".
*/
export function getBackground() {
  const saved = savedBgKey();
  if (BG_MAP[saved]) return BG_MAP[saved];
  try {
    const customs = JSON.parse(localStorage.getItem("calisigh-custom-bgs") ?? "[]");
    const entry = customs.find(e => e.split("|&")[0] === saved);
    if (entry) return convertFileSrc(entry.split("|&")[1]);
  } catch (_) {}
  return BG_MAP.fall;
}
