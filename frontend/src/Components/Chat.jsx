import { useState, useEffect, useRef } from "react";
import { GUITARS, guitarStyle, nextGuitar } from "../lib/guitars.js";
import { getBackground } from "../lib/backgrounds.js";
import { isRangeSet, rangeLabel, readRange } from "../lib/alarmRange.js";
import { alarms as alarmsApi, chat } from "../lib/api.js";
import { loadAlarmContext } from "../lib/chatContext.js";
import { notifyAlarmsChanged } from "../lib/windows.js";
import EventCard from "./EventCard.jsx";
import ModelPicker from "./ModelPicker.jsx";
import "./Chat.css";

const FALLBACK_GREETING = "Hey... like, what do you want?";

function sessionDate(iso) {
  return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

async function saveMessage(sessionId, role, content) {
  try {
    await chat.sessions.addMessage(sessionId, role, content);
  } catch (_) {}
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
      setMessages(data.messages ?? []);
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
      const data = await chat.reply({ sessionId: id, alarmContext: await loadAlarmContext(range), messages: newMessages });
      const reply = data.reply ?? "...whatever, I got nothing. Try again I guess.";
      setMessages(prev => [...prev, { role: "assistant", content: reply, suggestion: data.suggestion }]);
      if (id !== null) saveMessage(id, "assistant", reply);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Great, something broke. not surprised honestly. Try again." }]);
    }
    setLoading(false);
  };

  /* An event the assistant proposed becomes a real alarm, its considerations saved as the description */
  async function addSuggestion(index) {
    const { suggestion } = messages[index];
    try {
      await alarmsApi.create({
        time: suggestion.time,
        title: suggestion.title,
        desc: (suggestion.notes ?? []).map(note => `- ${note}`).join("\n"),
      });
      await notifyAlarmsChanged();
      setMessages(prev => prev.map((m, i) => (i === index ? { ...m, added: true } : m)));
    } catch (_) {}
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
                {msg.suggestion && (
                  <EventCard proposal={msg.suggestion} added={msg.added} onAdd={() => addSuggestion(i)} />
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

        <div className="chat-input-row">
          <textarea
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
