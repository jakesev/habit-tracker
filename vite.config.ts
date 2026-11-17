import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  // Shown in You, so you can tell which version is on your phone.
  define: { __BUILD__: JSON.stringify(process.env.BUILD_NUMBER ?? "dev") },
  plugins: [react(), tailwindcss()],
  test: { environment: "node" },
} as any);
