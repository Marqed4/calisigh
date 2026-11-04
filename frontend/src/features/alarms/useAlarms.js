import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { alarms as alarmsApi, marks as marksApi, waitForBackend } from "../../shared/lib/api.js";
import { alarmKey, dedupeAlarms } from "./alarmUtils.js";
import { findPreset } from "../presets/presets.js";
import { notifyAlarmsChanged, onAlarmsChanged } from "../../shared/lib/windows.js";

const UNDO_MS = 6000;

/* All alarms with their bookmark and preset, kept fresh, plus delete with a short undo window */
export function useAlarms() {
  const [all, setAll] = useState([]);
  const [markData, setMarkData] = useState({ marks: {}, presets: [] });
  const [ready, setReady] = useState(false);
  const [lastDeleted, setLastDeleted] = useState(null);
  const undoTimer = useRef(null);

  const alarms = useMemo(() => dedupeAlarms(all).map(a => {
    const mark = markData.marks[a.id];
    return {
      ...a,
      bookmarked: Boolean(mark?.bookmarked),
      presetId: mark?.preset ?? "",
      preset: findPreset(markData.presets, mark?.preset),
    };
  }), [all, markData]);

  const reload = useCallback(async () => {
    try {
      const [list, marksAndPresets] = await Promise.all([alarmsApi.list(), marksApi.get()]);
      setAll(list);
      setMarkData(marksAndPresets);
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
      const res = await alarmsApi.create({ time: alarm.time, title: alarm.title, desc: alarm.desc ?? "", imageSource: alarm.image ?? "" });
      const { id } = await res.json();
      if (id && (alarm.bookmarked || alarm.presetId)) {
        await marksApi.set(id, { bookmarked: alarm.bookmarked, preset: alarm.presetId });
      }
      reload();
    } catch (err) {
      console.error("Failed to restore alarm:", err);
    }
  }

  async function toggleBookmark(alarm) {
    try {
      await marksApi.set(alarm.id, { bookmarked: !alarm.bookmarked, preset: alarm.presetId });
      await reload();
      notifyAlarmsChanged();
    } catch (err) {
      console.error("Failed to change bookmark:", err);
    }
  }

  return { alarms, ready, lastDeleted, remove, undo, toggleBookmark };
}
