import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: process.env.VITE_BASE_PATH || "./",
  server: {
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
  },
  preview: {
    proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } },
  },
  build: {
    manifest: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        onlyExplicitManualChunks: true,
        manualChunks(id) {
          if (id.includes("commonjsHelpers")) return "react-runtime";
          if (id.includes("/node_modules/three/")) return "three-core";
          if (
            id.includes("/node_modules/@react-three/") ||
            id.includes("/node_modules/three-stdlib/") ||
            id.includes("/node_modules/react-reconciler/")
          )
            return "three-react";
          if (/\/node_modules\/(react|react-dom|scheduler)\//.test(id))
            return "react-runtime";
        },
      },
    },
  },
});
