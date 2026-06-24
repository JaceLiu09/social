/**
 * 切换 Capacitor 远程 URL 或内置 dist 包。
 *
 * 用法：
 *   node scripts/cap-server-url.mjs remote https://test.manghe.click
 *   node scripts/cap-server-url.mjs bundled   # iOS 真机推荐：JS/CSS/头像走 App 本地包
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configPath = path.join(__dirname, "..", "capacitor.config.json");

const mode = process.argv[2] || "remote";
const url = (process.argv[3] || "https://test.manghe.click").replace(/\/$/, "");

const base = {
  appId: "com.manghe.social",
  appName: "盲盒星球",
  webDir: "dist",
  ios: {
    contentInset: "never",
    allowsLinkPreview: false,
    scrollEnabled: false
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#f4f6fb",
      showSpinner: false
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#ffffff"
    },
    Keyboard: {
      resize: "none"
    }
  }
};

const config =
  mode === "bundled"
    ? {
        ...base,
        server: {
          androidScheme: "https"
        }
      }
    : {
        ...base,
        server: {
          url,
          cleartext: url.startsWith("http://"),
          androidScheme: "https"
        }
      };

fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(`capacitor.config.json -> ${mode === "bundled" ? "bundled dist" : url}`);
