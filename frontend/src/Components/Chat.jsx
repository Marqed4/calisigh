import { useState, useEffect, useRef } from "react";
import Send from "../resources/assets/images/Signs/Semi Reflective Guitar.gif";
import { getBackground } from "./backgrounds.js";
import "./Chat.css";

const FALLBACK_GREETING = "Hey... like, what do you want?";

function buildAlarmContext(alarms) {
  return alarms.length > 0
    ? `The user's calendar events are: ${alarms.map(a =>
        `"${a.title}" at ${new Date(a.time).toLocaleString()}${a.desc ? ` (${a.desc})` : ""}`
      ).join("; ")}.`
    : "The user has no calendar events.";
}

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [alarms, setAlarms] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  /* Same resolver as every other window, so custom backgrounds work here too */
  const bg = getBackground();

  /* Fetch alarms and ask the backend for a fresh greeting. Also used by "New chat". */
  async function startConversation() {
    setMessages([]);
    let loadedAlarms = [];
    try {
      const res = await fetch("http://localhost:4567/api/alarms");
      loadedAlarms = await res.json();
      setAlarms(loadedAlarms);
    } catch (_) {}

    setLoading(true);
    try {
      const res = await fetch("http://localhost:4567/api/chat/greeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alarmContext: buildAlarmContext(loadedAlarms) }),
      });
      const data = await res.json();
      setMessages([{ role: "assistant", content: data.reply ?? FALLBACK_GREETING }]);
    } catch (_) {
      setMessages([{ role: "assistant", content: FALLBACK_GREETING }]);
    }
    setLoading(false);
  }

  useEffect(() => { startConversation(); }, []);

  /* Keep the newest message in view */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  /* Put the cursor back in the box whenever a reply finishes */
  useEffect(() => {
    if (!loading) inputRef.current?.focus();
  }, [loading]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const response = await fetch("http://localhost:4567/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alarmContext: buildAlarmContext(alarms), messages: newMessages }),
      });
      const data = await response.json();
      const reply = data.reply ?? "...whatever, I got nothing. Try again I guess.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: "Great, something broke. not surprised honestly. Try again." }]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div style={{ position: "relative", height: "100vh" }}>
      <div className="chat-background" style={{ backgroundImage: bg ? `url(${bg})` : undefined }} />
      <div className="chat-wrapper">
        <div className="chat-header">
          <span>Calisigh Helper</span>
          <button
            className="chat-close"
            onClick={startConversation}
            disabled={loading}
            title="Clear this conversation and start over"
          >
            New chat
          </button>
        </div>
        <div className="chat-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`chat-bubble ${msg.role}`}>
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="chat-bubble assistant loading">
              <span className="dot" /><span className="dot" /><span className="dot" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-row">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pour your heart out... or whatever."
            rows={2}
          />
          <button className="chat-send" onClick={sendMessage} disabled={loading}>
            <img src={Send}
            alt="Send"
            className="chat-send"
            />
          </button>
        </div>
      </div>
    </div>
  );
}
