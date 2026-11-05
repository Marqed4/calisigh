import { useEffect, useState } from "react";
import { chat } from "../../shared/lib/api.js";
import { canSeeImages, pullName, pullPercent } from "./modelCaps.js";

const SUGGESTIONS = [
  "llama3.2", "llama3.2:1b", "llama3.1:8b", "mistral", "gemma2:2b", "gemma2:9b",
  "qwen2.5:7b", "phi3", "deepseek-r1:8b",
];

/* "llama3.2" and "llama3.2:latest" are the same model */
const sameModel = (a, b) => a.replace(/:latest$/, "") === b.replace(/:latest$/, "");

/*
Pick which Ollama model the chat uses, or download another one by name.
onLoaded(list) tells the parent the latest model list, so it can tell what the model can do.
*/
export default function ModelPicker({ onLoaded }) {
  const [models, setModels] = useState({ selected: "", installed: [], pulling: [], errors: {} });
  const [showGet, setShowGet] = useState(false);
  const [newModel, setNewModel] = useState("");

  async function load() {
    try {
      const list = await chat.models.list();
      if (list) {
        setModels(list);
        onLoaded?.(list);
      }
    } catch (_) {}
  }

  useEffect(() => { load(); }, []);

  /* Poll while a download is running */
  useEffect(() => {
    if (models.pulling.length === 0) return;
    const timer = setInterval(load, 4000);
    return () => clearInterval(timer);
  }, [models.pulling.length]);

  async function choose(name) {
    try { await chat.models.choose(name); } catch (_) {}
    load();
  }

  async function download() {
    const name = newModel.trim();
    if (!name) return;
    try { await chat.models.pull(name); } catch (_) {}
    setNewModel("");
    setShowGet(false);
    load();
  }

  const current = models.installed.find(n => sameModel(n, models.selected)) ?? models.selected;
  const missing = models.installed.length > 0 && !models.installed.some(n => sameModel(n, models.selected));

  return (
    <>
      <div className="chat-models">
        <label>
          Model
          <select className="input chat-model-select" value={current} onChange={e => choose(e.target.value)}>
            {models.installed.length === 0 && <option value={models.selected}>{models.selected || "Ollama is not running"}</option>}
            {models.installed.map(n => (
              <option key={n} value={n}>{canSeeImages(models, n) === true ? `${n} (sees images)` : n}</option>
            ))}
            {missing && <option value={models.selected}>{models.selected} (not downloaded)</option>}
          </select>
        </label>
        <button className="chat-close" onClick={() => setShowGet(v => !v)}>
          {showGet ? "Cancel" : "Get another"}
        </button>
      </div>

      {showGet && (
        <div className="chat-get-model">
          <input
            className="input"
            list="chat-model-suggestions"
            placeholder="Model name, like mistral or gemma2:9b"
            value={newModel}
            onChange={e => setNewModel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && download()}
          />
          <datalist id="chat-model-suggestions">
            {SUGGESTIONS.map(n => <option key={n} value={n} />)}
          </datalist>
          <button className="btn btn-primary" onClick={download}>Download</button>
        </div>
      )}

      {models.pulling.map(p => {
        const name = pullName(p);
        const percent = pullPercent(p);
        return (
          <div key={name} className="chat-range" role="status">
            {percent === null ? `Downloading ${name}... big models take a while` : `Downloading ${name}... ${percent}%`}
            {percent !== null && <progress className="chat-pull-bar" max="100" value={percent} aria-label={`Download of ${name}`} />}
          </div>
        );
      })}
      {Object.entries(models.errors).filter(([n]) => !models.pulling.some(p => pullName(p) === n)).map(([n, msg]) => (
        <div key={n} className="chat-range chat-model-error" role="alert">Could not get {n}: {msg}</div>
      ))}
    </>
  );
}
