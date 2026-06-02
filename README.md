# obeditor

`obeditor` is the standalone editor core extracted from ofive. It owns generic editor state, host synchronization contracts, Markdown editing surfaces, and plugin interfaces. It does not depend on ofive, Tauri, vault filesystems, workbench panels, or backend indexes.

## Architecture

1. `EditorService`
   - Owns the canonical document snapshot, dirty state, mode, status, commands, plugin lifecycle, CodeMirror extensions, and subscribers.
   - Keeps save completion version-aware, so edits made while a save is in flight stay dirty until they are saved.

2. `EditorHostAdapter`
   - Lets host applications provide `loadDocument`, `saveDocument`, `resolveLink`, logging, and lifecycle callbacks.
   - Hosts are responsible for mapping these callbacks to their own file, sync, active editor, or display-mode services.

3. `EditorPlugin`
   - Lets plugins contribute editor commands and CodeMirror extensions without reaching into host state.
   - The default Markdown plugins contribute formatting, insertion, and link-open commands.

4. React surfaces
   - `UniversalMarkdownEditor` renders toolbar, CodeMirror edit mode, read mode, and split mode.
   - Components consume an `EditorService`; they do not own shared document facts.

## Package

```ts
import {
  UniversalMarkdownEditor,
  createDefaultEditorCapabilities,
  createDefaultMarkdownPlugins,
  createEditorService,
} from "obeditor";
import "obeditor/styles.css";
```

## Host Integration

`obeditor` keeps generic editing concerns inside the package and lets host applications inject product-specific behavior through capabilities and adapters.

```ts
const capabilities = createDefaultEditorCapabilities({
  documents: [
    {
      path: "notes/demo.md",
      title: "Demo",
      content: "# Demo",
      referenceCount: 3,
    },
  ],
});

const service = createEditorService({
  document: {
    id: "notes/demo.md",
    path: "notes/demo.md",
    title: "Demo",
    content: "# Demo",
  },
  capabilities,
  plugins: createDefaultMarkdownPlugins(),
  adapter: {
    async saveDocument(snapshot) {
      // Persist through the host's state service or backend sync layer.
      return {
        content: snapshot.content,
        savedAt: Date.now(),
      };
    },
  },
});
```

`createDefaultEditorCapabilities` provides in-memory documents, assets, wiki-link suggestion/preview/open handlers, localization, context menu fallback, media reads, media creation, and external-link opening. It is intended for demos, tests, mocks, and host bootstrapping. Product hosts such as ofive can replace or extend those capabilities with vault, index, AI, or workspace services without coupling editor plugins to the host.

## Editor Surface

`UniversalMarkdownEditor` can either create its own service from `initialContent` or consume a host-owned `EditorService`.

```tsx
<UniversalMarkdownEditor
  service={service}
  lineNumbers="relative"
  vimMode
  readOnly={false}
/>
```

Supported editor-surface options:

- `lineNumbers`: `"absolute"`, `"relative"`, `"off"`, or `false`.
- `vimMode`: enables the CodeMirror Vim extension.
- `readOnly`: prevents editor mutation while preserving rendering.
- `defaultMarkdownExtensions`: disables the bundled Markdown presentation extensions when set to `false`.

The default Markdown extension set owns generic rendering and editing features such as frontmatter, LaTeX, tables, task widgets, media, and wiki-link UI. Host-specific behaviors should be injected through the capability registry.

## Demo Web

The repository includes a Vite demo that uses `createDefaultEditorCapabilities` and can be deployed directly to Vercel.

```bash
npm run dev
npm run build:demo
npm run preview:demo
```

Vercel uses `vercel.json`:

```json
{
  "buildCommand": "npm run build:demo",
  "outputDirectory": "demo-dist"
}
```

## Scripts

```bash
npm run build
bun run test
npm run test:e2e
npm run dev
```
