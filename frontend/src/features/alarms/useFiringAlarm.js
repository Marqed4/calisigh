import { useEffect, useRef } from "react";
import { alarms } from "../../shared/lib/api.js";
import { openFiringWindow } from "../../shared/lib/windows.js";

/* Once the backend is up, poll for a firing alarm and show the popup for it */
export function useFiringAlarm(enabled) {
  const popupOpen = useRef(false);

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
