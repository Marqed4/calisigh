import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./Components/Home.jsx";
import AlarmFiring from "./Components/AlarmFiring.jsx";
import AddAlarm from "./Components/AddAlarm.jsx";
import Settings from "./Components/Settings.jsx";
import ViewChatAssistant from "./Components/Chat.jsx";
import ViewEditAlarm from "./Components/ViewEditAlarm.jsx";
import { keepFontApplied } from "./lib/fonts.js";
import "./App.css";

export default function App() {
  useEffect(keepFontApplied, []);

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