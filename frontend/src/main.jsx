import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import App from "./App.jsx";
import "./styles.css";

if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("capacitor-native");
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
  if (Capacitor.getPlatform() === "ios") {
    StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
  }
}

if (/miniprogram/i.test(navigator.userAgent || "")) {
  document.documentElement.classList.add("wechat-miniprogram");
} else {
  try {
    if (new URLSearchParams(window.location.search).get("mp") === "1") {
      document.documentElement.classList.add("wechat-miniprogram");
    }
  } catch (_error) {
    /* ignore */
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
