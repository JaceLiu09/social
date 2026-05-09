import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: {
    port: 5274,
    host: true,
    proxy: {
      "/admin/api": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true
      },
      "/uploads": {
        target: "http://127.0.0.1:4000",
        changeOrigin: true
      }
    }
  }
});
