import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { alarms as alarmsApi, waitForBackend } from "../lib/api.js";
import { alarmKey, dedupeAlarms } from "../lib/alarmUtils.js";
import { onAlarmsChanged } from "../lib/windows.js";

const UNDO_MS = 6000;

/* All alarms, kept fresh, plus delete with a short undo window */
export function useAlarms() {
  const [all, setAll] = useState([]);
  const alarms = useMemo(() => dedupeAlarms(all), [all]);
  const [ready, setReady] = useState(false);
  const [lastDeleted, setLastDeleted] = useState(null);
  const undoTimer = useRef(null);

  const reload = useCallback(async () => {
    try {
      setAll(await alarmsApi.list());
    } catch (err) {
      console.error("Failed to load alarms:", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    waitForBackend().then(up => {
      if (up && !cancelled) {
        setReady(true);
        reload();
      }
    });
    const unlisten = onAlarmsChanged(reload);
    return () => {
      cancelled = true;
      clearTimeout(undoTimer.current);
      unlisten.then(stop => stop());
    };
  }, [reload]);

  async function remove(alarm) {
    try {
      // delete every identical copy, otherwise a twin would just show up in its place
      for (const copy of all.filter(a => alarmKey(a) === alarmKey(alarm))) {
        await alarmsApi.removeByRef({ id: copy.id, time: copy.time });
      }
      reload();
      clearTimeout(undoTimer.current);
      setLastDeleted(alarm);
      undoTimer.current = setTimeout(() => setLastDeleted(null), UNDO_MS);
    } catch (err) {
      console.error("Failed to delete alarm:", err);
    }
  }

  async function undo() {
    const alarm = lastDeleted;
    if (!alarm) return;
    clearTimeout(undoTimer.current);
    setLastDeleted(null);
    try {
      await alarmsApi.create({ time: alarm.time, title: alarm.title, desc: alarm.desc ?? "", imageSource: alarm.image ?? "" });
      reload();
    } catch (err) {
      console.error("Failed to restore alarm:", err);
    }
  }

  return { alarms, ready, lastDeleted, remove, undo };
}
