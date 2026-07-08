import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxy API calls to the FastAPI backend so no CORS config is needed in dev.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/extract": "http://localhost:8000",
      "/health": "http://localhost:8000",
    },
  },
});
