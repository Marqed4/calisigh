import { useState, useEffect, useRef } from "react";
import { GUITARS, guitarStyle, nextGuitar } from "./guitars.js";
import { getBackground } from "../appearance/backgrounds.js";
import { isRangeSet, rangeLabel, readRange } from "../calendar/alarmRange.js";
import { alarms as alarmsApi, chat } from "../../shared/lib/api.js";
import { loadAlarmContext } from "./chatContext.js";
import { notifyAlarmsChanged } from "../../shared/lib/windows.js";
import { Close, Paperclip } from "../../shared/components/Icons.jsx";
import HighlightInput from "../../shared/text/HighlightInput.jsx";
import EventCard from "./EventCard.jsx";
import ModelPicker from "./ModelPicker.jsx";
import "./Chat.css";

const FALLBACK_GREETING = "Hey... like, what do you want?";

/* Text is read by whichever model is chosen (the backend trims each to 20000 characters).
   Pictures go to Ollama as images, so the model has to be a vision model. */
const DOCUMENT_TYPES = ".txt,.md,.csv,.json,.ics,.log,.html,.xml,.tsv,.png,.jpg,.jpeg";
const MAX_DOCUMENTS = 3;
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function readBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function sessionDate(iso) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/* Returns the id the backend gave the message (needed later to save its card), or null */
async function saveMessage(sessionId, role, content, card) {
  try {
    const res = await chat.sessions.addMessage(sessionId, role, content, card ? JSON.stringify(card) : "");
    const data = await res.json();
    return data.messageId ?? null;
  } catch (_) {
    return null;
  }
}

/* The card a reply carries: a new event, or a change to one that exists */
function cardFrom(data) {
  if (data.suggestion) return { kind: "add", proposal: data.suggestion, done: false };
  if (data.change) return { kind: data.change.kind, change: data.change, done: false };
  return null;
}

function parseCard(text) {
  if (!text) return null;
  try {
    const card = JSON.parse(text);
    return card && card.kind ? card : null;
  } catch (_) {
    return null;
  }
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  /* null until the first user message, so empty chats are never saved */
  const [sessionId, setSessionId] = useState(null);
  /* last session, offered for resuming */
  const [resumeOffer, setResumeOffer] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [guitar, setGuitar] = useState(() => Math.floor(Math.random() * GUITARS.length));
  const [sessions, setSessions] = useState([]);
  /* Documents the assistant can read, kept for this conversation only */
  const [documents, setDocuments] = useState([]);
  const [attachError, setAttachError] = useState("");
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const bg = getBackground();

  async function loadSessions() {
    try {
      const data = await chat.sessions.list();
      setSessions(data);
      return data;
    } catch (_) {
      return [];
    }
  }

  async function startNewConversation() {
    setMessages([]);
    setSessionId(null);
    setResumeOffer(null);
    setShowHistory(false);
    setDocuments([]);
    setAttachError("");
    setLoading(true);
    const range = readRange();
    let reply = FALLBACK_GREETING;
    try {
      const data = await chat.greeting(await loadAlarmContext(range));
      reply = data.reply ?? FALLBACK_GREETING;
    } catch (_) {}
    setMessages([{ role: "assistant", content: reply }]);
    setLoading(false);
  }

  async function openChat() {
    const past = await loadSessions();
    if (past.length > 0) {
      setMessages([]);
      setResumeOffer(past[0]);
    } else {
      startNewConversation();
    }
  }

  async function resumeSession(id) {
    setLoading(true);
    setShowHistory(false);
    setResumeOffer(null);
    try {
      const data = await chat.sessions.get(id);
      setMessages((data.messages ?? []).map(m => ({
        role: m.role, content: m.content, dbId: m.id, card: parseCard(m.card),
      })));
      setSessionId(id);
    } catch (_) {
      startNewConversation();
      return;
    }
    setLoading(false);
  }

  async function removeSession(id) {
    try {
      await chat.sessions.remove(id);
    } catch (_) {}
    const left = await loadSessions();
    if (id === sessionId) startNewConversation();
    else if (resumeOffer?.id === id) setResumeOffer(left[0] ?? null);
  }

  async function toggleHistory() {
    if (!showHistory) await loadSessions();
    setShowHistory(s => !s);
  }

  useEffect(() => { openChat(); }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, resumeOffer]);

  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setResumeOffer(null);
    setLoading(true);

    /* First message creates the session and saves what is on screen */
    let id = sessionId;
    try {
      if (id === null) {
        id = (await chat.sessions.create()).id;
        setSessionId(id);
        for (const m of messages) await saveMessage(id, m.role, m.content);
      }
      await saveMessage(id, userMsg.role, userMsg.content);
    } catch (_) {}

    try {
      /* Read fresh so main-window changes apply right away */
      const range = readRange();
      const data = await chat.reply({ sessionId: id, alarmContext: await loadAlarmContext(range), messages: newMessages, documents });
      const reply = data.reply ?? "...whatever, I got nothing. Try again I guess.";
      const card = cardFrom(data);
      /* Saved with its card first, so the card can be marked used later and survives a resume */
      const dbId = id !== null ? await saveMessage(id, "assistant", reply, card) : null;
      setMessages(prev => [...prev, { role: "assistant", content: reply, card, dbId }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Great, something broke. not surprised honestly. Try again." }]);
    }
    setLoading(false);
  };

  /*
  Runs a card the user pressed: adds an event, saves a change or deletes one. This is the only
  place the assistant's proposals touch the calendar, and only after a press.
  */
  async function runCard(index) {
    const { card, busy, dbId } = messages[index];
    if (!card || card.done || busy) return;
    const mark = (changes) => setMessages(prev => prev.map((m, i) => (i === index ? { ...m, ...changes } : m)));
    mark({ busy: true, error: "" });
    try {
      await applyCard(card);
      await notifyAlarmsChanged();
      const used = { ...card, done: true };
      mark({ card: used, busy: false });
      if (dbId) chat.sessions.setCard(dbId, JSON.stringify(used)).catch(() => {});
    } catch (err) {
      console.error("Could not apply the card:", err);
      mark({ busy: false, error: err.userMessage ?? "Could not do that. Is the server running? Try again." });
    }
  }

  /* The alarm routes hand back the fetch response, so a 4xx or 5xx must not count as success */
  async function applyCard(card) {
    if (card.kind === "add") {
      const { proposal } = card;
      const res = await alarmsApi.create({
        time: proposal.time,
        title: proposal.title,
        desc: (proposal.notes ?? []).map(note => `- ${note}`).join("\n"),
      });
      if (res && res.ok === false) throw new Error(`Server answered ${res.status}`);
      return;
    }

    const { change } = card;
    if (card.kind === "delete") {
      const res = await alarmsApi.remove(change.id);
      /* already gone counts as deleted */
      if (res && res.ok === false && res.status !== 404) throw new Error(`Server answered ${res.status}`);
      return;
    }

    /* Edit: start from the event as it is now, so its notes are kept and a later change is not undone */
    const current = (await alarmsApi.list()).find(a => a.id === change.id);
    if (!current) {
      const gone = new Error("event gone");
      gone.userMessage = "That event is not on your calendar anymore, so there is nothing to change.";
      throw gone;
    }
    const res = await alarmsApi.update(change.id, {
      time: change.newTime ?? current.time,
      title: change.newTitle ?? current.title,
      desc: current.desc ?? "",
    });
    if (res && res.ok === false) throw new Error(`Server answered ${res.status}`);
  }

  async function attachFiles(e) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    setAttachError("");
    for (const file of files) {
      if (documents.length + 1 > MAX_DOCUMENTS) {
        setAttachError(`Up to ${MAX_DOCUMENTS} documents at a time.`);
        break;
      }
      const isImage = file.type.startsWith("image/");
      if (file.size > (isImage ? MAX_IMAGE_BYTES : MAX_TEXT_BYTES)) {
        setAttachError(`${file.name} is over ${isImage ? 8 : 2} MB.`);
        continue;
      }
      try {
        if (isImage) {
          const image = await readBase64(file);
          setDocuments(prev => [...prev, { name: file.name, image }]);
          continue;
        }
        const text = await file.text();
        if (text.includes("\u0000")) throw new Error("binary");
        setDocuments(prev => [...prev, { name: file.name, text }]);
      } catch (_) {
        setAttachError(`${file.name} is not a plain text file.`);
      }
    }
  }

  /* Every click on the button swaps the guitar */
  function handleSendClick() {
    setGuitar(g => nextGuitar(g));
    sendMessage();
  }

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const range = readRange();

  return (
    <div style={{ position: "relative", height: "100vh" }}>
      <div className="window-bg" style={{ backgroundImage: bg ? `url(${bg})` : undefined }} />
      <div className="chat-wrapper">
        <div className="chat-header">
          <span>Calisigh Helper</span>
          <span className="chat-header-actions">
            <button
              className="chat-close"
              onClick={toggleHistory}
              disabled={loading}
              title="See past conversations"
            >
              {showHistory ? "Back" : "History"}
            </button>
            <button
              className="chat-close"
              onClick={startNewConversation}
              disabled={loading}
              title="Start a new conversation (this one stays in History)"
            >
              New chat
            </button>
          </span>
        </div>
        {isRangeSet(range) && (
          <div className="chat-range" title="Change this in the main window sidebar">
            Looking at: {rangeLabel(range)}
          </div>
        )}

        <ModelPicker />

        {showHistory ? (
          <div className="chat-messages">
            {sessions.length === 0 && <div className="chat-bubble assistant">Nothing here yet. Typical.</div>}
            {sessions.map(s => (
              <div key={s.id} className="chat-session">
                <button className="chat-session-open" onClick={() => resumeSession(s.id)}>
                  <span className="chat-session-title">{s.title || "Untitled"}</span>
                  <span className="chat-session-meta">{sessionDate(s.startedAt)} · {s.messageCount} messages</span>
                </button>
                <button
                  className="chat-session-delete"
                  onClick={() => removeSession(s.id)}
                  aria-label={`Delete conversation ${s.title}`}
                  title="Delete"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="chat-messages">
            {resumeOffer && (
              <>
                <div className="chat-bubble assistant">
                  Hey... so last time we were on "{resumeOffer.title || "something"}" ({sessionDate(resumeOffer.startedAt)}).
                  Wanna pick up where we left off, or start over?
                </div>
                <div className="chat-offer">
                  <button className="btn" onClick={() => resumeSession(resumeOffer.id)}>Pick up where we left off</button>
                  <button className="btn" onClick={startNewConversation}>Start fresh</button>
                </div>
              </>
            )}
            {messages.map((msg, i) => (
              <div key={i} className="chat-turn">
                <div className={`chat-bubble ${msg.role}`}>
                  {msg.content}
                </div>
                {msg.card && (
                  <EventCard card={msg.card} busy={msg.busy} error={msg.error} onRun={() => runCard(i)} />
                )}
              </div>
            ))}
            {loading && (
              <div className="chat-bubble assistant loading">
                <span className="dot" /><span className="dot" /><span className="dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {(documents.length > 0 || attachError) && (
          <div className="chat-attachments">
            {documents.map((d, i) => (
              <span key={i} className="chat-attachment" title={d.name}>
                <span className="chat-attachment-name">{d.name}</span>
                <button
                  aria-label={`Remove ${d.name}`}
                  onClick={() => setDocuments(prev => prev.filter((_, j) => j !== i))}
                >
                  <Close size={12} />
                </button>
              </span>
            ))}
            {attachError && <span className="chat-attach-error">{attachError}</span>}
            {documents.some(d => d.image) && (
              <span className="chat-attach-note">Pictures only work if your chosen model can see images.</span>
            )}
          </div>
        )}

        <div className="chat-input-row">
          <input
            ref={fileInputRef}
            type="file"
            accept={DOCUMENT_TYPES}
            multiple
            hidden
            onChange={attachFiles}
          />
          <button
            className="icon-btn chat-attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            aria-label="Attach a document"
            title="Attach a text file (txt, md, csv, json, ics) or a picture (png, jpg). What the assistant can read depends on the model you picked: pictures need a vision model like llama3.2-vision, gemma3 or llava."
          >
            <Paperclip size={18} />
          </button>
          <HighlightInput
            multiline
            wrapClassName="chat-input-wrap"
            ref={inputRef}
            className="input chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pour your heart out... or whatever."
            rows={2}
          />
          <button className="icon-btn btn-primary chat-send" onClick={handleSendClick} disabled={loading} aria-label="Send">
            <span key={guitar} className="guitar-icon" style={guitarStyle(GUITARS[guitar])}>🎸</span>
          </button>
        </div>
      </div>
    </div>
  );
}
