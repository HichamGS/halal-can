import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev proxy keeps the API origin server-side-configurable and avoids CORS
// friction during local development (Django runs on :8000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
});
