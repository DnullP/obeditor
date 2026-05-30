import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const externalDependencies = [
  "react",
  "react-dom",
  "react/jsx-runtime",
  "@codemirror/autocomplete",
  "@codemirror/commands",
  "@codemirror/lang-markdown",
  "@codemirror/language",
  "@codemirror/lint",
  "@codemirror/search",
  "@codemirror/state",
  "@codemirror/view",
  "@lezer/highlight",
  "codemirror",
  "lucide-react",
  "react-markdown",
  "remark-breaks",
  "remark-gfm",
];

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4317,
    strictPort: true,
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Obeditor",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    rollupOptions: {
      external: externalDependencies,
      output: {
        assetFileNames: (assetInfo) => assetInfo.name === "style.css" ? "obeditor.css" : "[name][extname]",
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "React",
          "@codemirror/autocomplete": "CodeMirrorAutocomplete",
          "@codemirror/commands": "CodeMirrorCommands",
          "@codemirror/lang-markdown": "CodeMirrorMarkdown",
          "@codemirror/language": "CodeMirrorLanguage",
          "@codemirror/lint": "CodeMirrorLint",
          "@codemirror/search": "CodeMirrorSearch",
          "@codemirror/state": "CodeMirrorState",
          "@codemirror/view": "CodeMirrorView",
          "@lezer/highlight": "LezerHighlight",
          codemirror: "CodeMirror",
          "lucide-react": "LucideReact",
          "react-markdown": "ReactMarkdown",
          "remark-breaks": "remarkBreaks",
          "remark-gfm": "remarkGfm",
        },
      },
    },
  },
});
