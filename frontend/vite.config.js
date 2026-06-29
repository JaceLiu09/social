import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const BACKEND_TARGET = process.env.VITE_DEV_PROXY_TARGET || "http://127.0.0.1:4000";

/** 前端与后端同端口展示时，把这些路径反代到本机 4000 */
const API_PROXY_PREFIXES = [
  "/auth",
  "/square",
  "/match",
  "/game",
  "/membership",
  "/wallet",
  "/points",
  "/gifts",
  "/coins",
  "/chat",
  "/friends",
  "/users",
  "/werewolf",
  "/tacit",
  "/planet",
  "/public",
  "/uploads",
  "/oss-media",
  "/health"
];

function createApiProxy() {
  const proxy = {};
  for (const prefix of API_PROXY_PREFIXES) {
    proxy[prefix] = { target: BACKEND_TARGET, changeOrigin: true };
  }
  proxy["/socket.io"] = { target: BACKEND_TARGET, changeOrigin: true, ws: true };
  return proxy;
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: "localhost",
    proxy: createApiProxy()
  },
  preview: {
    host: "0.0.0.0",
    port: Number(process.env.FRONTEND_PREVIEW_PORT || 4175),
    proxy: createApiProxy()
  }
});
