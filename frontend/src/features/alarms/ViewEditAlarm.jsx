import { useState, useEffect, useRef } from "react";
import HighlightInput from "../../shared/text/HighlightInput.jsx";
import PicturePicker from "./PicturePicker.jsx";
import Linkified from "../../shared/text/Linkified.jsx";
import PresetSelect, { usePresets } from "../presets/PresetSelect.jsx";
import DescriptionImages from "./DescriptionImages.jsx";
import { alarms, marks, pastedImages } from "../../shared/lib/api.js";
import { pastedPictureFiles, savePastedFiles } from "./pastedImages.js";
import { closeThisWindow, finishAlarmEdit } from "../../shared/lib/windows.js";
import { getBackground } from "../appearance/backgrounds.js";
import { repeatIsos } from "./alarmUtils.js";
import "./AlarmWindow.css";

export default function ViewEditAlarm() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const day = params.get("day");
  const month = params.get("month");
  const year  = params.get("year");

  const [title, setTitle] = useState(params.get("title") || "");
  const [desc,  setDesc] = useState(params.get("desc")  || "");
  const [time,  setTime] = useState(params.get("time")  || "");
  const [error, setError] = useState("");
  const [imagePath, setImagePath] = useState(params.get("image") || "");
  /* untouched keeps the stored picture, a pick replaces it, a removal clears it */
  const [imageChange, setImageChange] = useState("keep");
  const [presetId, setPresetId] = useState(params.get("preset") || "");
  const [bookmarked, setBookmarked] = useState(params.get("bookmarked") === "1");
  const presets = usePresets();

  /* Pictures pasted into the description. imagesLoaded stops a failed load from wiping what is stored. */
  const [descImages, setDescImages] = useState([]);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  /* The cell picture was the first description picture, not one picked with the Picture button */
  const [wasFromDesc, setWasFromDesc] = useState(false);

  const [showDuplicate, setShowDuplicate] = useState(false);
  const [futureDate, setFutureDate] = useState("");
  const [repeatMode, setRepeatMode] = useState("weekly");
  const titleRef = useRef(null);

  const bg = getBackground();

  useEffect(() => { titleRef.current?.focus(); }, []);

  useEffect(() => {
    if (!/^\d+$/.test(id)) return;
    pastedImages.forAlarm(id).then(list => {
      if (!list) return;
      setDescImages(list);
      setImagesLoaded(true);
      const cell = params.get("image");
      setWasFromDesc(Boolean(cell) && list[0] === cell);
    });
  }, []);

  /* Ctrl+V with a picture on the clipboard adds it to the description; pasting text works as before */
  async function handlePaste(e) {
    const files = pastedPictureFiles(e);
    if (files.length === 0) return;
    e.preventDefault();
    try {
      const paths = await savePastedFiles(files, descImages.length);
      setDescImages(prev => [...prev, ...paths]);
    } catch (err) {
      setError(err.message);
    }
  }

  /*
  The cell picture: one picked with the Picture button wins. Otherwise it is the first description picture,
  and when that picture is gone the cell picture it made goes too.
  */
  function imageFields() {
    if (imageChange === "set") return { imageSource: imagePath };
    if (imageChange === "keep" && imagePath && !wasFromDesc) return {};
    if (imagesLoaded && descImages[0]) return { imageSource: descImages[0] };
    if (imageChange === "clear" || (imagesLoaded && wasFromDesc)) return { clearImage: true };
    return {};
  }

  async function saveImages(forId) {
    if (imagesLoaded) await pastedImages.setForAlarm(forId, descImages);
  }

  /* A preset hands over its title, description and time, replacing what is in those boxes */
  function choosePreset(next, preset) {
    setPresetId(next);
    if (!preset) return;
    if (preset.title) setTitle(preset.title);
    if (preset.desc) setDesc(preset.desc);
    if (preset.time) setTime(preset.time);
  }

  async function saveAlarm() {
    if (!title || !time) { setError("Title and time are required."); return; }
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${time}:00`;
    try {
      await alarms.update(id, { time: iso, title, desc, ...imageFields() });
      /* old-style alarms are identified by their time, and only numeric ids can carry marks and pictures */
      if (/^\d+$/.test(id)) {
        await marks.set(id, { bookmarked, preset: presetId });
        await saveImages(id);
      }
      await finishAlarmEdit();
    } catch { setError("Failed to save. Is the server running?"); }
  }

  /* Repeats come after this alarm, which already exists */
  async function duplicateAlarm() {
    if (!futureDate) { setError("End date is required."); return; }
    try {
      for (const iso of repeatIsos({ year, month, day, time, endDate: futureDate, mode: repeatMode })) {
        const res = await alarms.create({ time: iso, title, desc, imageSource: imagePath || descImages[0] || "" });
        if (descImages.length > 0) {
          const { id: newId } = await res.json();
          if (newId) await pastedImages.setForAlarm(newId, descImages);
        }
      }
      await finishAlarmEdit();
    } catch { setError("Failed to duplicate. Is the server running?"); }
  }

  async function deleteAlarm() {
    try {
      await alarms.remove(id);
      await finishAlarmEdit();
    } catch { setError("Failed to delete. Is the server running?"); }
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") closeThisWindow();
    else if (e.key === "Enter" && e.target.tagName !== "TEXTAREA" && e.target.tagName !== "BUTTON") {
      e.preventDefault();
      if (showDuplicate) duplicateAlarm(); else saveAlarm();
    }
  }

  return (
    <>
      <div className="window-bg" style={{ backgroundImage: `url(${bg})` }} />
      <div className="alarm-window" onKeyDown={handleKeyDown}>
        <h2>Edit Alarm</h2>
        <p className="alarm-window-date">{`${month}/${day}/${year}`}</p>
        {error && <p className="form-error">{error}</p>}

        <HighlightInput ref={titleRef} className="input" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <HighlightInput multiline wrapClassName="alarm-desc-wrap" className="input" placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} onPaste={handlePaste} />
        <DescriptionImages paths={descImages} onRemove={(path) => setDescImages(prev => prev.filter(p => p !== path))} />
        {/https?:\/\//.test(desc) && (
          <div className="alarm-links"><Linkified text={desc} /></div>
        )}
        <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />

        <PresetSelect presets={presets} value={presetId} onChange={choosePreset} />

        <label className="alarm-check">
          <input type="checkbox" checked={bookmarked} onChange={(e) => setBookmarked(e.target.checked)} />
          Bookmark this event
        </label>

        <PicturePicker path={imagePath} onChange={(path) => { setImagePath(path); setImageChange(path ? "set" : "clear"); }} />

        {showDuplicate && (
          <div className="alarm-repeat-panel">
            <p className="alarm-repeat-label">Repeat until</p>

            <div className="segmented" role="tablist" aria-label="Repeat">
              {[["weekly", "Weekly"], ["yearly", "Yearly"]].map(([mode, label]) => (
                <button
                  key={mode}
                  role="tab"
                  aria-selected={repeatMode === mode}
                  className={`segmented-btn${repeatMode === mode ? " segmented-active" : ""}`}
                  onClick={() => setRepeatMode(mode)}
                >{label}</button>
              ))}
            </div>

            <input className="input" type="date" value={futureDate} onChange={(e) => setFutureDate(e.target.value)} />
            <div className="alarm-buttons">
              <button className="btn btn-primary" onClick={duplicateAlarm}>Confirm</button>
              <button className="btn" onClick={() => { setShowDuplicate(false); setFutureDate(""); setError(""); }}>Cancel</button>
            </div>
          </div>
        )}

        <div className="alarm-buttons">
          <button className="btn btn-primary" onClick={saveAlarm}>Save</button>
          <button className="btn" onClick={() => setShowDuplicate(v => !v)}>Repeat</button>
          <button className="btn btn-danger" onClick={deleteAlarm}>Delete</button>
          <button className="btn" onClick={() => closeThisWindow()}>Cancel</button>
        </div>
      </div>
    </>
  );
}