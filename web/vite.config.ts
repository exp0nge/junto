import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://exp0nge.github.io/junto/ on GitHub Pages, but from root in local dev.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/junto/" : "/",
  plugins: [react()],
  server: { port: 5183 },
}));
