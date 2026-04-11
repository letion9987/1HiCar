/// <reference types="node" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** GitHub Pages 项目站为子路径 `/<仓库名>/`，构建前设置 VITE_BASE_PATH=/仓库名/（末尾建议带 /） */
const base = (process.env.VITE_BASE_PATH ?? "/").replace(/\/?$/, "/");

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5174,
  },
});

