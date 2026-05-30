export type EditorMode = "edit" | "read" | "split";
export type EditorStatus = "idle" | "loading" | "saving" | "error";
export type EditorSurfaceHandle = unknown;
export type EditorRuntimeExtension = unknown;

export interface EditorDocument {
  id: string;
  content: string;
  path?: string;
  title?: string;
  language: "markdown" | string;
  version: number;
  savedVersion: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
}

export interface EditorDocumentRef {
  id?: string;
  path?: string;
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface EditorCommandDescriptor {
  id: string;
  label: string;
  group?: string;
  icon?: string;
  enabled: boolean;
}

export interface EditorSnapshot {
  document: EditorDocument;
  mode: EditorMode;
  status: EditorStatus;
  dirty: boolean;
  error: string | null;
  pluginIds: string[];
  commands: EditorCommandDescriptor[];
}

export interface EditorViewAttachOptions {
  notifyFocus?: boolean;
}

export interface EditorHostAdapter {
  loadDocument?: (ref: EditorDocumentRef) => Promise<Partial<EditorDocument> & { content: string }>;
  saveDocument?: (document: EditorDocument, snapshot: EditorSnapshot) => Promise<Partial<EditorDocument> | void>;
  onDocumentChanged?: (document: EditorDocument, snapshot: EditorSnapshot) => void;
  onDocumentFocused?: (document: EditorDocument, snapshot: EditorSnapshot) => void;
  onModeChanged?: (mode: EditorMode, snapshot: EditorSnapshot) => void;
  resolveLink?: (target: string, sourceDocument: EditorDocument) => Promise<void> | void;
  log?: (level: "debug" | "info" | "warn" | "error", message: string, context?: Record<string, unknown>) => void;
  now?: () => number;
}

export interface EditorCommandContext<
  TView = EditorSurfaceHandle,
  TExtension = EditorRuntimeExtension,
> {
  service: EditorService<TView, TExtension>;
  document: EditorDocument;
  snapshot: EditorSnapshot;
  host: EditorHostAdapter;
  view: TView | null;
  updateContent: (content: string, reason?: string) => void;
}

export interface EditorCommand<
  TView = EditorSurfaceHandle,
  TExtension = EditorRuntimeExtension,
> {
  id: string;
  label: string;
  group?: string;
  icon?: string;
  run: (context: EditorCommandContext<TView, TExtension>) => void | Promise<void>;
  isEnabled?: (context: Omit<EditorCommandContext<TView, TExtension>, "updateContent">) => boolean;
}

export interface EditorPluginContext<
  TView = EditorSurfaceHandle,
  TExtension = EditorRuntimeExtension,
> {
  host: EditorHostAdapter;
  getSnapshot: () => EditorSnapshot;
  updateContent: (content: string, reason?: string) => void;
  setMode: (mode: EditorMode) => void;
  registerCommand: (command: EditorCommand<TView, TExtension>) => () => void;
  registerCodeMirrorExtension: (extension: TExtension) => () => void;
}

export interface EditorPluginContribution<
  TView = EditorSurfaceHandle,
  TExtension = EditorRuntimeExtension,
> {
  commands?: Array<EditorCommand<TView, TExtension>>;
  codeMirrorExtensions?: TExtension[];
  dispose?: () => void;
}

export interface EditorPlugin<
  TView = EditorSurfaceHandle,
  TExtension = EditorRuntimeExtension,
> {
  id: string;
  setup: (
    context: EditorPluginContext<TView, TExtension>,
  ) => EditorPluginContribution<TView, TExtension> | (() => void) | void;
}

export interface EditorServiceOptions<
  TView = EditorSurfaceHandle,
  TExtension = EditorRuntimeExtension,
> {
  document?: Partial<EditorDocument> & Pick<EditorDocument, "content">;
  mode?: EditorMode;
  adapter?: EditorHostAdapter;
  plugins?: Array<EditorPlugin<TView, TExtension>>;
}

export interface EditorService<
  TView = EditorSurfaceHandle,
  TExtension = EditorRuntimeExtension,
> {
  getSnapshot: () => EditorSnapshot;
  subscribe: (listener: () => void) => () => void;
  loadDocument: (ref: EditorDocumentRef) => Promise<void>;
  setDocument: (document: Partial<EditorDocument> & Pick<EditorDocument, "content">) => void;
  updateContent: (content: string, reason?: string) => void;
  save: () => Promise<void>;
  setMode: (mode: EditorMode) => void;
  executeCommand: (commandId: string) => Promise<void>;
  getCodeMirrorExtensions: () => TExtension[];
  attachView: (view: TView | null, options?: EditorViewAttachOptions) => void;
  dispose: () => void;
}
