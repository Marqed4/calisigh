import { useEffect, useState } from "react";
import { getBackground } from "../appearance/backgrounds.js";
import { appearance, holidayToggles } from "./settings.js";

/* Background, holiday toggles and cell look, re-read whenever the window regains focus (the Settings window may have changed them) */
export function useAppSettings() {
  const read = () => ({ bg: getBackground(), toggles: holidayToggles.read(), look: appearance.read() });
  const [settings, setSettings] = useState(read);

  useEffect(() => {
    const refresh = () => setSettings(read());
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);

  return settings;
}
