import { useEffect, useRef } from "react";
import { alarms } from "../../shared/lib/api.js";
import { openFiringWindow, openMissedWindow } from "../../shared/lib/windows.js";

/* Once the backend is up, show alarms missed while the app was closed (once), then poll for a firing alarm and show the popup for it */
export function useFiringAlarm(enabled) {
  const popupOpen = useRef(false);
  const checkedMissed = useRef(false);

  useEffect(() => {
    if (!enabled || checkedMissed.current) return;
    checkedMissed.current = true;
    alarms.missed().then(list => { if (list.length > 0) openMissedWindow(); });
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(async () => {
      try {
        const firing = await alarms.firing();
        if (!firing) return;
        if (firing.firing && !popupOpen.current) {
          popupOpen.current = true;
          await openFiringWindow(firing, () => { popupOpen.current = false; });
        } else if (!firing.firing) {
          popupOpen.current = false;
        }
      } catch (_) {}
    }, 1000);
    return () => clearInterval(timer);
  }, [enabled]);
}
