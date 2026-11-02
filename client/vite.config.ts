import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// En desarrollo, Vite reenvía la API y el WebSocket al servidor de Node.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:3000",
      "/socket.io": { target: "http://localhost:3000", ws: true },
    },
  },
});
