import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  build: {
    rollupOptions: {
      input: "keyboards.html",
    },
    outDir: "dist",
    emptyOutDir: false,
  },
});
