import { useEffect, useState } from "react";
import HolidayKeyForm from "./HolidayKeyForm.jsx";
import { holidays } from "../lib/api.js";
import "./HolidayPrompt.css";

const KEY = "calisigh-holiday-prompt";

/* Shown on launch until the user adds a Calendarific key or says to stop asking. Settings keeps the same form. */
export default function HolidayPrompt({ ready }) {
  const [visible, setVisible] = useState(false);
  const [country, setCountry] = useState("US");

  useEffect(() => {
    if (!ready) return;
    let neverAsk = false;
    try { neverAsk = localStorage.getItem(KEY) === "never"; } catch (_) {}
    if (neverAsk) return;

    holidays.keyStatus().then(status => {
      if (!status.set) {
        setCountry(status.country);
        setVisible(true);
      }
    });
  }, [ready]);

  function never() {
    try { localStorage.setItem(KEY, "never"); } catch (_) {}
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="holiday-prompt" role="dialog" aria-label="Turn on holidays">
      <h2>Want holidays on your calendar?</h2>
      <p>
        Calisigh shows national holidays and observances, like Thanksgiving or Diwali, straight in the cells.
        They come from Calendarific, a free service, and you only need your own free key. It takes about two minutes.
      </p>
      <HolidayKeyForm country={country} onSaved={() => setTimeout(() => setVisible(false), 1200)} />
      <div className="holiday-prompt-actions">
        <button className="btn" onClick={() => setVisible(false)}>Not now</button>
        <button className="btn" onClick={never}>Do not ask again</button>
      </div>
      <p className="holiday-prompt-foot">You can add the key later in Settings.</p>
    </div>
  );
}
