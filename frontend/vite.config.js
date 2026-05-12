import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 使用明确主机名，避免在部分环境（沙箱、受限 Node）下调用 os.networkInterfaces() 报错导致 dev 起不来
    host: "localhost"
  }
});
