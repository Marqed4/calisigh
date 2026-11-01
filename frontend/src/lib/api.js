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

export const holidays = {
  forYear: (year, categories) => getJson(`/api/holidays?year=${year}&categories=${categories.join(",")}`),
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
    addMessage: (id, role, content) => send(`/api/chat/sessions/${id}/messages`, "POST", { role, content }),
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
