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
  createDefaultMarkdownPlugins,
  createEditorService,
} from "obeditor";
import "obeditor/styles.css";
```

## Scripts

```bash
npm run build
bun run test
npm run test:e2e
npm run dev
```
