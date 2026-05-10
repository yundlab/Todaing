import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src")
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Todaing",
        short_name: "Todaing",
        description: "Today in one page",
        theme_color: "#f8fafc",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      }
    })
  ],
  server: {
    // 5173은 다른 팀/프로젝트와 겹치기 쉬워 Todaing 전용 포트로 둠. 바꾸면 API `WEB_ORIGIN`·구글 JS 출처도 맞출 것.
    port: 5176,
    strictPort: false,
    /** 같은 Wi-Fi 폰에서 `http://<PC-IP>:5176` 으로 접속 가능 */
    host: true,
    /**
     * 개발 시 `VITE_API_BASE_URL` 비우면 웹은 상대 경로 `/api`·`/auth`만 쓰고,
     * 여기서 `apps/api`(기본 8787)로 넘겨 폰의 localhost 문제를 피함.
     */
    proxy: {
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: true },
      "/auth": { target: "http://127.0.0.1:8787", changeOrigin: true }
    }
  }
});
