/* The user's saved preferences. localStorage keys live here and nowhere else. */
const KEYS = {
  holidayFederal: "calisigh-holidays-federal",
  holidayObservance: "calisigh-holidays-observance",
  holidayReligious: "calisigh-holidays-religious",
  cellBlur: "calisigh-cell-blur",
  sharpCells: "calisigh-cell-sharp",
  view: "calisigh-view",
  mondayStart: "calisigh-week-monday",
};

function readFlag(key, fallback) {
  const value = localStorage.getItem(key);
  return value === null ? fallback : value !== "false";
}

export const holidayToggles = {
  read: () => ({
    federal: readFlag(KEYS.holidayFederal, true),
    observance: readFlag(KEYS.holidayObservance, true),
    religious: readFlag(KEYS.holidayReligious, true),
  }),
  write: ({ federal, observance, religious }) => {
    localStorage.setItem(KEYS.holidayFederal, String(federal));
    localStorage.setItem(KEYS.holidayObservance, String(observance));
    localStorage.setItem(KEYS.holidayReligious, String(religious));
  },
};

export const appearance = {
  read: () => ({
    cellBlur: readFlag(KEYS.cellBlur, true),
    sharpCells: readFlag(KEYS.sharpCells, false),
    mondayStart: readFlag(KEYS.mondayStart, false),
  }),
  write: ({ cellBlur, sharpCells, mondayStart }) => {
    localStorage.setItem(KEYS.cellBlur, String(cellBlur));
    localStorage.setItem(KEYS.sharpCells, String(sharpCells));
    localStorage.setItem(KEYS.mondayStart, String(Boolean(mondayStart)));
  },
};

export const savedView = {
  read: (allowed) => {
    const value = localStorage.getItem(KEYS.view);
    return allowed.includes(value) ? value : allowed[0];
  },
  write: (view) => localStorage.setItem(KEYS.view, view),
};