/* Everything the frontend asks the Java backend for lives here, so no component knows the address or the routes */
export const API_BASE = "http://localhost:4567";

async function send(path, method = "GET", body) {
  const options = body === undefined
    ? { method }
    : { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
  return fetch(API_BASE + path, options);
}

async function getJson(path) {
  return (await send(path)).json();
}

/* Poll until the backend answers; reload the window to retry if it never does (see is_autostart in main.rs) */
export async function waitForBackend(retries = 20, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      if ((await send("/api/alarms")).ok) return true;
    } catch (_) {}
    await new Promise(r => setTimeout(r, delayMs));
  }
  window.location.reload();
  return false;
}

export const alarms = {
  list: (query = "") => getJson(`/api/alarms${query}`),
  create: (alarm) => send("/api/alarms", "POST", alarm),
  update: (id, alarm) => send(`/api/alarms/${id}`, "PUT", alarm),
  remove: (id) => send(`/api/alarms/${id}`, "DELETE"),
  removeByRef: (ref) => send("/api/alarms", "DELETE", ref),
  /* null when the backend has nothing to report */
  firing: async () => {
    const res = await send("/api/alarms/firing");
    return res.ok ? res.json() : null;
  },
  clearFiring: () => send("/api/alarms/firing", "DELETE"),
};

/* Bookmarks and presets: {marks: {alarmId: {bookmarked, preset}}, presets: [...]} */
export const marks = {
  get: async () => {
    try {
      const data = await getJson("/api/marks");
      return { marks: data.marks ?? {}, presets: data.presets ?? [] };
    } catch (_) {
      return { marks: {}, presets: [] };
    }
  },
  set: (id, mark) => send(`/api/marks/${id}`, "PUT", mark),
  savePresets: (presets) => send("/api/presets", "PUT", presets),
};

/* Pictures pasted into an event's description. Paths are absolute, as the backend hands them out. */
export const pastedImages = {
  upload: async (data, type) => {
    const res = await send("/api/images", "POST", { data, type });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Could not save the picture.");
    return body.path;
  },
  /* null when the backend could not be asked, so a save never wipes pictures it never loaded */
  forAlarm: async (id) => {
    try {
      const res = await send(`/api/alarms/${id}/images`);
      return res.ok ? res.json() : null;
    } catch (_) {
      return null;
    }
  },
  setForAlarm: (id, paths) => send(`/api/alarms/${id}/images`, "PUT", paths),
};

export const holidays = {
  forYear: (year, categories) => getJson(`/api/holidays?year=${year}&categories=${categories.join(",")}`),
  /* {set, country}; the key itself never comes back */
  keyStatus: async () => {
    try {
      return await getJson("/api/holidays/key");
    } catch (_) {
      return { set: true, country: "US" };   // unknown, so do not nag
    }
  },
  /* The backend checks the key with Calendarific; throws with its message when it is rejected */
  saveKey: async (key, country) => {
    const res = await send("/api/holidays/key", "PUT", { key, country });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.message || "Could not save the key.");
  },
};

export const sounds = {
  list: () => getJson("/api/sounds"),
  selected: () => getJson("/api/sounds/selected"),
  volume: () => getJson("/api/sounds/volume"),
  setVolume: (volume) => send("/api/sounds/volume", "POST", { volume }),
  add: (sourcePath) => send("/api/sounds", "POST", { sourcePath }),
  remove: (name) => send("/api/sounds", "DELETE", { name }),
  select: (name) => send("/api/sounds/select", "POST", { name }),
  play: (name) => send("/api/sounds/play", "POST", { name }),
  stop: () => send("/api/sounds/stop", "POST"),
};

export const backgrounds = {
  list: () => getJson("/api/backgrounds"),
  add: (sourcePath) => send("/api/backgrounds", "POST", { sourcePath }),
  remove: (name) => send("/api/backgrounds", "DELETE", { name }),
};

export const chat = {
  greeting: (alarmContext) => send("/api/chat/greeting", "POST", { alarmContext }).then(r => r.json()),
  reply: (body) => send("/api/chat", "POST", body).then(r => r.json()),
  sessions: {
    list: async () => {
      const res = await send("/api/chat/sessions");
      return res.ok ? res.json() : [];
    },
    create: async () => (await send("/api/chat/sessions", "POST")).json(),
    get: (id) => getJson(`/api/chat/sessions/${id}`),
    remove: (id) => send(`/api/chat/sessions/${id}`, "DELETE"),
    /* card is the JSON text of an event card, or "" when the message has none; the response holds messageId */
    addMessage: (id, role, content, card = "") => send(`/api/chat/sessions/${id}/messages`, "POST", { role, content, card }),
    /* Stores the new state of a card once it is used, so a resumed session shows it as done */
    setCard: (messageId, card) => send(`/api/chat/messages/${messageId}/card`, "PUT", { card }),
  },
  models: {
    list: async () => {
      const res = await send("/api/chat/models");
      return res.ok ? res.json() : null;
    },
    choose: (name) => send("/api/chat/model", "POST", { name }),
    pull: (name) => send("/api/chat/models/pull", "POST", { name }),
  },
};