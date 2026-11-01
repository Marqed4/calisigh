import { createContext, useContext, useState } from "react";
import { MingLiUMonths }   from "../resources/assets/images/MingLiU_Months/index.js";
import { MingLiUNumbers }  from "../resources/assets/images/MingLiU_Numbers/index.js";
import { MingLiUDays }     from "../resources/assets/images/MingLiU_Days/index.js";
import { MingLiULetters }  from "../resources/assets/images/MingLiU_Letters/index.js";
import { MingLiUSettings } from "../resources/assets/images/MingLiU_Settings/index.js";
import MingLiUYears        from "../resources/assets/images/MingLiU_Years/Years.gif";

/*
  To add a font pack: import its assets above and add an entry here.
  It shows up in the Settings dropdown automatically (the dropdown is hidden
  while only one pack exists).
*/
export const FONT_THEMES = {
  mingliu: {
    label:    "MingLiU",
    Months:   MingLiUMonths,
    Numbers:  MingLiUNumbers,
    Days:     MingLiUDays,
    Letters:  MingLiULetters,
    Settings: MingLiUSettings,
    Years:    MingLiUYears,
  },
};

export const DEFAULT_FONT = "mingliu";

const FontPackage = createContext(null);

/* Old saved values (e.g. the removed "graffiti") fall back to the default */
function readSavedFont() {
  const saved = localStorage.getItem("calisigh-font");
  return FONT_THEMES[saved] ? saved : DEFAULT_FONT;
}

export function FontProvider({ children }) {
  const [fontKey, setFontKey] = useState(readSavedFont);

  function setFontTheme(key) {
    const safe = FONT_THEMES[key] ? key : DEFAULT_FONT;
    setFontKey(safe);
    localStorage.setItem("calisigh-font", safe);
  }

  return (
    <FontPackage.Provider value={{ fontKey, fontTheme: FONT_THEMES[fontKey], setFontTheme }}>
      {children}
    </FontPackage.Provider>
  );
}

export function useFontTheme() {
  return useContext(FontPackage);
}
