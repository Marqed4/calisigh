import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./features/calendar/Home.jsx";
import AlarmFiring from "./features/alarms/AlarmFiring.jsx";
import AddAlarm from "./features/alarms/AddAlarm.jsx";
import Settings from "./features/settings/Settings.jsx";
import ViewChatAssistant from "./features/chat/Chat.jsx";
import ViewEditAlarm from "./features/alarms/ViewEditAlarm.jsx";
import { keepFontApplied } from "./features/appearance/fonts.js";
import { keepTrimApplied } from "./features/appearance/trim.js";
import "./App.css";

export default function App() {
  useEffect(keepFontApplied, []);
  useEffect(keepTrimApplied, []);

  useEffect(() => {
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      let unlisten;
      win.onResized(async () => {
        if (await win.isFullscreen()) {
          await win.setFullscreen(false);
        }
      }).then(f => { unlisten = f; });
      return () => { if (unlisten) unlisten(); };
    });
  }, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/add-alarm" element={<AddAlarm />} />
        <Route path="/view-settings" element={<Settings />} />
        <Route path="/alarm-firing" element={<AlarmFiring />} />
        <Route path="/view-edit-alarm" element={<ViewEditAlarm />} />
        <Route path="/view-chat-assistant" element={<ViewChatAssistant />} />
      </Routes>
    </Router>
  );
}