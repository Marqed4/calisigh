import { emit, listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

/* Windows tell each other that alarms changed through this one event */
const ALARMS_CHANGED = "alarm-saved";

/* ...and this one when the holiday key was saved, so the main window loads the holidays */
const HOLIDAYS_CHANGED = "holiday-key-saved";

export const notifyHolidaysChanged = () => emit(HOLIDAYS_CHANGED);
export const onHolidaysChanged = (callback) => listen(HOLIDAYS_CHANGED, callback);

export const notifyAlarmsChanged = () => emit(ALARMS_CHANGED);
export const onAlarmsChanged = (callback) => listen(ALARMS_CHANGED, callback);
export const closeThisWindow = () => getCurrentWindow().close();

/* Tell the main window to reload, then close this one */
export async function finishAlarmEdit() {
  await notifyAlarmsChanged();
  await closeThisWindow();
}

async function focusExisting(label) {
  const existing = await WebviewWindow.getByLabel(label);
  if (!existing) return false;
  await existing.show();
  await existing.setFocus();
  return true;
}

async function openWindow(label, url, options = {}) {
  try {
    if (await focusExisting(label)) return;
    const win = new WebviewWindow(label, { url, resizable: false, center: true, parent: "main", ...options });
    win.once("tauri://error", (e) => console.error(`${label} error:`, e));
  } catch (err) {
    console.error(`Failed to open ${label}:`, err);
  }
}

export function openAddAlarmWindow(date) {
  const query = new URLSearchParams({ day: date.getDate(), month: date.getMonth() + 1, year: date.getFullYear() });
  return openWindow("add-alarm", `/add-alarm?${query}`);
}

/* Every field goes in the URL so the edit window can fill itself without asking the backend */
export function openEditAlarmWindow(alarm) {
  const dt = new Date(alarm.time);
  const query = new URLSearchParams({
    id: alarm.id ?? alarm.time,
    title: alarm.title,
    desc: alarm.desc ?? "",
    day: dt.getDate(),
    month: dt.getMonth() + 1,
    year: dt.getFullYear(),
    time: alarm.time.slice(11, 16),
    image: alarm.image ?? "",
    bookmarked: alarm.bookmarked ? "1" : "",
    preset: alarm.presetId ?? "",
  });
  return openWindow("view-edit-alarm", `/view-edit-alarm?${query}`);
}

export const openSettingsWindow = () => openWindow("view-settings", "/view-settings", { title: "Settings" });

export async function openChatWindow() {
  try {
    const existing = await WebviewWindow.getByLabel("view-chat-assistant");
    if (existing) {
      await existing.center();
      await existing.show();
      await existing.setFocus();
      return;
    }
    const win = new WebviewWindow("view-chat-assistant", {
      url: "/view-chat-assistant",
      title: "Chat",
      width: 420,
      height: 420,
      resizable: true,
      center: true,
    });
    win.once("tauri://error", (e) => console.error("chat error:", e));
  } catch (err) {
    console.error("openChatWindow failed:", err);
  }
}

/* Opens the alarm popup unless it is already up; onClosed fires when the user dismisses it */
export async function openFiringWindow({ title, desc }, onClosed) {
  if (await focusExisting("alarm-firing")) return;
  const query = new URLSearchParams({ title: title || "", desc: desc || "" });
  const win = new WebviewWindow("alarm-firing", {
    url: `/alarm-firing?${query}`,
    resizable: false,
    center: true,
    width: 320,
    height: 320,
    title: "Alarm",
    alwaysOnTop: true,
    skipTaskbar: false,
  });
  win.once("tauri://destroyed", onClosed);
}
