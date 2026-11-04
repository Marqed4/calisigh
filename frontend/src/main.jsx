import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { initZoom } from "./shared/lib/zoom.js";

initZoom();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>
);