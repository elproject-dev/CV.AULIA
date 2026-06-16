import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@workspace/api-client-react": path.resolve(__dirname, "src/mocks/api-client-react.ts"),
      "stream": path.resolve(__dirname, "src/mocks/stream-mock.js"),
    },
    dedupe: ["react", "react-dom"],
  },
  root: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist"),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      onwarn(warning, warn) {
        // Suppress sourcemap warnings dari UI components
        if (warning.code === 'SOURCEMAP_ERROR' || 
            (warning.message && warning.message.includes('sourcemap'))) {
          return;
        }
        warn(warning);
      }
    }
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    open: true,
    strictPort: true,
    allowedHosts: [
      "directed-zigzagged-haunt.ngrok-free.dev",
      ".ngrok-free.dev",
      ".ngrok.io",
      "localhost",
    ],
  },
});
