import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const packageJson = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

const externalPackages = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.peerDependencies ?? {}),
  "react/jsx-runtime",
  "react/jsx-dev-runtime",
]);

function isExternalDependency(id: string): boolean {
  return [...externalPackages].some((packageName) =>
    id === packageName || id.startsWith(`${packageName}/`),
  );
}

const isDemoBuild = process.env.OBEDITOR_BUILD_TARGET === "demo";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 4317,
    strictPort: true,
  },
  build: {
    emptyOutDir: false,
    assetsInlineLimit: 0,
    ...(!isDemoBuild
      ? {
        lib: {
          entry: resolve(__dirname, "src/index.ts"),
          name: "Obeditor",
          formats: ["es", "cjs"] as const,
          fileName: (format: string) => (format === "es" ? "index.js" : "index.cjs"),
        },
        rollupOptions: {
          external: isExternalDependency,
          output: {
            assetFileNames: (assetInfo: { name?: string }) => assetInfo.name === "style.css" ? "obeditor.css" : "[name][extname]",
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
      }
      : {}),
  },
});
