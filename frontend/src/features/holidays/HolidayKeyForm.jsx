import { useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { holidays } from "../../shared/lib/api.js";
import { notifyHolidaysChanged } from "../../shared/lib/windows.js";
import "./HolidayKeyForm.css";

const SIGNUP_URL = "https://calendarific.com/signup";

/* Holidays come from Calendarific, which needs a free key of the user's own. This form walks them through getting it. */
export default function HolidayKeyForm({ onSaved, country: initialCountry = "US" }) {
  const [key, setKey] = useState("");
  const [country, setCountry] = useState(initialCountry);
  const [status, setStatus] = useState({ state: "idle", message: "" });

  async function save() {
    setStatus({ state: "saving", message: "Checking your key..." });
    try {
      await holidays.saveKey(key, country);
      await notifyHolidaysChanged();
      setStatus({ state: "done", message: "Holidays are on." });
      onSaved?.();
    } catch (err) {
      setStatus({ state: "error", message: err.message });
    }
  }

  return (
    <div className="holiday-key">
      <ol className="holiday-key-steps">
        <li>
          Make a free Calendarific account.
          <button className="holiday-key-link" onClick={() => openUrl(SIGNUP_URL).catch(() => {})}>
            Open the sign-up page
          </button>
        </li>
        <li>Copy the API key from your account page.</li>
        <li>Paste it here.</li>
      </ol>

      <div className="holiday-key-row">
        <input
          className="input"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder="Calendarific API key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && key.trim()) save(); }}
        />
        <input
          className="input holiday-key-country"
          maxLength={2}
          value={country}
          title="Two letter country code, like US or GB"
          aria-label="Country code"
          onChange={(e) => setCountry(e.target.value.toUpperCase())}
        />
        <button
          className="btn btn-primary"
          onClick={save}
          disabled={!key.trim() || status.state === "saving"}
        >
          Save
        </button>
      </div>

      {status.message && (
        <p className={`holiday-key-status holiday-key-status--${status.state}`}>{status.message}</p>
      )}
    </div>
  );
}
