import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  createDefaultEditorCapabilities,
  createDefaultMarkdownPlugins,
  createEditorService,
  UniversalMarkdownEditor,
  type CodeMirrorLineNumbersMode,
  type EditorHostAdapter,
  type EditorMode,
} from "./index";
import "./styles/editor.css";
import "./app.css";

interface DemoRuntimeStats {
  documentChangedCount: number;
  lastContentLength: number;
  lastDocumentId: string;
}

declare global {
  interface Window {
    __OBEDITOR_DEMO_STATS?: DemoRuntimeStats;
  }
}

const demoContent = `---
title: Plugin System
tags:
  - demo
  - obeditor
---

# Plugin System

obeditor owns the generic Markdown editor surface. Hosts inject business abilities through capabilities.

$$
plugin = (API, CMD, C, P_{platform})
$$

| 插件                               | 作用      | 关键能力             |
| -------------------------------- | ------- | ---------------- |
| \`tauri-plugin-fs\`                | 文件系统访问  | 读写文件、监听目录、解析路径   |
| \`tauri-plugin-dialog\`            | 对话框     | 打开/保存文件、消息框      |
| \`tauri-plugin-notification\`      | 系统通知    | 桌面与系统托盘通知、权限请求   |
| \`tauri-plugin-shell\`             | 外部命令    | 执行子进程、打开 URL     |
| \`tauri-plugin-http\`              | HTTP 请求 | 受沙箱约束的 fetch 替代  |
| \`tauri-plugin-store\`             | 键值存储    | 持久化 JSON 配置      |
| \`tauri-plugin-clipboard-manager\` | 剪贴板     | 读写文本与图片          |
| \`tauri-plugin-os\`                | 系统信息    | 平台、内核版本、locale   |
| \`tauri-plugin-window-state\`      | 窗口状态    | 记忆位置/尺寸/最大化      |
| \`tauri-plugin-updater\`           | 自动更新    | 检查/下载/安装新版本      |
| \`tauri-plugin-log\`               | 日志      | 集中收集前端与 Rust 日志  |
| \`tauri-plugin-deep-link\`         | 深链      | 处理自定义协议 URL      |
| \`tauri-plugin-single-instance\`   | 单实例     | 限制应用仅运行一次        |
| \`tauri-plugin-sql\`               | 数据库     | 封装 SQLite 等本地数据库 |
| \`tauri-plugin-authenticator\`     | 身份认证    | TOTP/WebAuthn 等  |
<!-- obeditor-table-layout: {"columns":[226,164,208],"rows":[38,38,38,38,38,38,38,38,38,38,38,38,38,38,38]} -->

> 优先使用官方插件；社区插件可结合活跃度与权限要求评估，必要时配合 [[Capability System]] 进行最小授权。

## Editing Checklist

- [ ] Select this sentence and verify the highlight is visible.
- [ ] Toggle relative line numbers.
- [ ] Try Vim mode if you like modal editing.
`;

type DemoDocumentId = "plugin-system" | "large-table" | "large-article";
type DemoSelectionId = DemoDocumentId | "quad-large-articles";

interface DemoDocumentDefinition {
  id: string;
  path: string;
  title: string;
  content: string;
  referenceCount: number;
}

function createLargeTableDemoContent() {
  const headers = [
    "Row",
    "Area",
    "Owner",
    "Status",
    "Score",
    "Updated",
    "Latency",
    "Volume",
    "Risk",
    "Next step",
  ];
  const separator = headers.map(() => "---");
  const areas = ["Editor", "Preview", "Sync", "Index", "Search", "Vim"];
  const statuses = ["Queued", "Running", "Stable", "Review", "Blocked"];
  const risks = ["Low", "Medium", "Watch"];
  const rows = Array.from({ length: 720 }, (_, index) => {
    const rowNumber = index + 1;
    return [
      `R-${String(rowNumber).padStart(4, "0")}`,
      areas[index % areas.length],
      `team-${(index % 9) + 1}`,
      statuses[index % statuses.length],
      String((rowNumber * 17) % 100),
      `2026-06-${String((index % 28) + 1).padStart(2, "0")}`,
      `${24 + (index % 80)} ms`,
      `${1_000 + index * 13}`,
      risks[index % risks.length],
      `Checkpoint ${rowNumber} keeps canvas rendering measurable`,
    ];
  });

  return [
    "---",
    "title: Large Table Canvas",
    "tags:",
    "  - demo",
    "  - table",
    "  - performance",
    "---",
    "",
    "# Large Table Canvas",
    "",
    "This note exercises the visual table editor with hundreds of rows while keeping editing and Vim handoff active.",
    "",
    `| ${headers.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "> The large table above should stay responsive, keep a small DOM footprint, and still allow cell editing.",
  ].join("\n");
}

const largeTableDemoContent = createLargeTableDemoContent();

function createLargeArticleDemoContent(
  title = "Large Article Performance",
  seed = 0,
) {
  const sections = Array.from({ length: 420 }, (_, index) => {
    const sectionNumber = index + 1;
    const padded = String(sectionNumber).padStart(3, "0");
    const topics = ["state sync", "responsive layout", "index freshness", "plugin injection", "read mode"];
    const topic = topics[(index + seed) % topics.length];
    const checklist = sectionNumber % 7 === 0
      ? [
        "",
        `- [ ] Verify checkpoint ${padded} keeps editing state local until the host needs a flush.`,
        `- [ ] Confirm resize sampling for ${topic} does not blank the active viewport.`,
      ]
      : [];
    const table = sectionNumber % 20 === 0
      ? [
        "",
        "| Metric | Target | Observation |",
        "| --- | --- | --- |",
        `| Sync batch | <= 1 idle flush | Section ${padded} |`,
        `| Resize frame | stable focus | ${topic} |`,
      ]
      : [];

    return [
      `## Section ${padded}: ${topic}`,
      "",
      `This large article paragraph keeps CodeMirror virtualization, markdown widgets, and host synchronization busy without requiring the demo host to reload the editor on every keystroke. It references [[Capability System]] and uses inline math $x_${sectionNumber}^2 + y_${sectionNumber}^2 = z_${sectionNumber}^2$ so syntax plugins still participate.`,
      "",
      `A second paragraph adds enough natural prose for wrapping while the editor width changes continuously. The important behavior is that the active document remains editable, selection and focus stay connected, and only explicit flush boundaries publish the full document to the host service.`,
      ...checklist,
      ...table,
    ].join("\n");
  });

  return [
    "---",
    `title: ${title}`,
    "tags:",
    "  - demo",
    "  - performance",
    "  - large-article",
    "---",
    "",
    `# ${title}`,
    "",
    "This document is intentionally long enough to exercise large-document editing, split/read rendering, and continuous responsive layout changes.",
    "",
    ...sections,
    "",
    "Final paragraph for end-of-document navigation and save flush checks.",
  ].join("\n");
}

const largeArticleDemoContent = createLargeArticleDemoContent();

const quadLargeArticleDocuments: DemoDocumentDefinition[] = Array.from({ length: 4 }, (_, index) => {
  const number = index + 1;
  const title = `Large Article Quadrant ${number}`;
  return {
    id: `quad-large-article-${number}`,
    path: `${title}.md`,
    title: `${title}.md`,
    content: createLargeArticleDemoContent(title, index),
    referenceCount: 21 + index,
  };
});

const demoDocuments: Record<DemoDocumentId, DemoDocumentDefinition> = {
  "plugin-system": {
    id: "plugin-system",
    path: "Plugin System.md",
    title: "Plugin System.md",
    content: demoContent,
    referenceCount: 12,
  },
  "large-table": {
    id: "large-table",
    path: "Large Table Canvas.md",
    title: "Large Table Canvas.md",
    content: largeTableDemoContent,
    referenceCount: 3,
  },
  "large-article": {
    id: "large-article",
    path: "Large Article Performance.md",
    title: "Large Article Performance.md",
    content: largeArticleDemoContent,
    referenceCount: 21,
  },
};

const demoDocumentOptions: Array<{ value: DemoSelectionId; label: string }> = [
  { value: "plugin-system", label: "Plugin System" },
  { value: "large-table", label: "Large Table" },
  { value: "large-article", label: "Large Article" },
  { value: "quad-large-articles", label: "Quad Large Articles" },
];

const demoShortcutOptions: Array<{ value: DemoSelectionId; label: string }> = [
  { value: "plugin-system", label: "Baseline" },
  { value: "large-table", label: "Large Table" },
  { value: "large-article", label: "Large Article" },
  { value: "quad-large-articles", label: "Quad Editors" },
];

function isDemoDocumentId(value: DemoSelectionId): value is DemoDocumentId {
  return value === "plugin-system" || value === "large-table" || value === "large-article";
}

function resolveInitialDemoSelectionId(): DemoSelectionId {
  if (typeof window === "undefined") {
    return "plugin-system";
  }

  const requestedDemoId = new URLSearchParams(window.location.search).get("demo");
  return requestedDemoId === "large-table"
    || requestedDemoId === "large-article"
    || requestedDemoId === "quad-large-articles"
    ? requestedDemoId
    : "plugin-system";
}

function createDemoEditorDocument(document: DemoDocumentDefinition) {
  return {
    id: document.id,
    path: document.path,
    title: document.title,
    content: document.content,
  };
}

function resolveDemoDocumentReferenceCount(pathOrId: string | undefined) {
  return [...Object.values(demoDocuments), ...quadLargeArticleDocuments]
    .find((document) => document.path === pathOrId || document.id === pathOrId)
    ?.referenceCount ?? 0;
}

function recordDemoDocumentChange(document: { id: string; content: string }) {
  if (typeof window === "undefined") {
    return;
  }

  const stats = window.__OBEDITOR_DEMO_STATS ?? {
    documentChangedCount: 0,
    lastContentLength: document.content.length,
    lastDocumentId: document.id,
  };
  stats.documentChangedCount += 1;
  stats.lastContentLength = document.content.length;
  stats.lastDocumentId = document.id;
  window.__OBEDITOR_DEMO_STATS = stats;
}

type DemoLineNumbersMode = CodeMirrorLineNumbersMode;

const lineNumberOptions: Array<{ value: DemoLineNumbersMode; label: string }> = [
  { value: "absolute", label: "Absolute" },
  { value: "relative", label: "Relative" },
  { value: "off", label: "Off" },
];

export function App() {
  const initialSelectionId = useMemo(() => resolveInitialDemoSelectionId(), []);
  const initialSingleDemoId = isDemoDocumentId(initialSelectionId) ? initialSelectionId : "large-article";
  const [selectedDemoId, setSelectedDemoId] = useState<DemoSelectionId>(initialSelectionId);
  const activeDemoDocument = isDemoDocumentId(selectedDemoId) ? demoDocuments[selectedDemoId] : null;
  const [lineNumbers, setLineNumbers] = useState<DemoLineNumbersMode>("absolute");
  const [vimMode, setVimMode] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [savedContent, setSavedContent] = useState(demoDocuments[initialSingleDemoId].content);
  const [lastOpenedPath, setLastOpenedPath] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<EditorMode>("edit");
  const [editorWidthPercent, setEditorWidthPercent] = useState(100);
  const [quadColumnPercent, setQuadColumnPercent] = useState(50);
  const [quadRowPercent, setQuadRowPercent] = useState(50);
  const runtimeSavedLength = selectedDemoId === "quad-large-articles"
    ? quadLargeArticleDocuments.reduce((total, document) => total + document.content.length, 0)
    : savedContent.length;

  const capabilities = useMemo(() => createDefaultEditorCapabilities({
    documents: [
      {
        path: "Capability System.md",
        title: "Capability System",
        content: "# Capability System\n\nCapabilities are the dependency injection surface for host-specific behavior.",
        referenceCount: 7,
      },
      {
        path: "Plugin System.md",
        title: "Plugin System",
        content: demoContent,
        referenceCount: 12,
      },
      {
        path: "Large Table Canvas.md",
        title: "Large Table Canvas",
        content: largeTableDemoContent,
        referenceCount: 3,
      },
      {
        path: "Large Article Performance.md",
        title: "Large Article Performance",
        content: largeArticleDemoContent,
        referenceCount: 21,
      },
      ...quadLargeArticleDocuments.map((document) => ({
        path: document.path,
        title: document.title,
        content: document.content,
        referenceCount: document.referenceCount,
      })),
    ],
    translations: {
      "editorPlugins.noMatchingNote": "No matching demo note",
    },
    onOpenWikiLink: (target) => {
      setLastOpenedPath(target.relativePath);
    },
  }), []);

  const adapter = useMemo<EditorHostAdapter>(() => ({
    capabilities,
    saveDocument: async (document) => {
      setSavedContent(document.content);
      capabilities.memory.upsertDocument({
        path: document.path ?? document.id,
        title: document.title,
        content: document.content,
        referenceCount: resolveDemoDocumentReferenceCount(document.path ?? document.id),
      });
      return {
        savedVersion: document.version,
      };
    },
    onDocumentChanged(document) {
      recordDemoDocumentChange(document);
      capabilities.memory.upsertDocument({
        path: document.path ?? document.id,
        title: document.title,
        content: document.content,
        referenceCount: resolveDemoDocumentReferenceCount(document.path ?? document.id),
      });
    },
    onModeChanged: (mode) => {
      setActiveMode(mode);
    },
    log: (level, message, context) => {
      console[level === "debug" ? "info" : level]("[obeditor-demo]", message, context ?? {});
    },
  }), [capabilities]);

  const service = useMemo(() => createEditorService({
    document: createDemoEditorDocument(demoDocuments[initialSingleDemoId]),
    adapter,
    plugins: createDefaultMarkdownPlugins(),
  }), [adapter, initialSingleDemoId]);

  useEffect(() => {
    if (!activeDemoDocument) {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("demo", selectedDemoId);
        window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      }
      return;
    }

    const nextDocument = createDemoEditorDocument(activeDemoDocument);
    const currentDocument = service.getSnapshot().document;
    if (
      currentDocument.id !== nextDocument.id
      || currentDocument.path !== nextDocument.path
      || currentDocument.content !== nextDocument.content
    ) {
      service.setDocument(nextDocument);
    }
    setSavedContent(activeDemoDocument.content);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (selectedDemoId === "plugin-system") {
        url.searchParams.delete("demo");
      } else {
        url.searchParams.set("demo", selectedDemoId);
      }
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }, [activeDemoDocument, selectedDemoId, service]);

  return (
    <main className="demo-shell">
      <aside className="demo-sidebar" aria-label="Editor settings">
        <div className="demo-brand">
          <span className="demo-brand-mark">OE</span>
          <div>
            <h1>obeditor</h1>
            <p>Standalone Markdown editor core with host capability injection.</p>
          </div>
        </div>

        <section className="demo-panel" aria-label="Editor configuration">
          <h2>Editor</h2>
          <label className="demo-field">
            <span>Demo note</span>
            <select
              aria-label="Demo note"
              value={selectedDemoId}
              onChange={(event) => setSelectedDemoId(event.target.value as DemoSelectionId)}
            >
              {demoDocumentOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <nav className="demo-shortcuts" aria-label="Demo shortcuts">
            {demoShortcutOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="demo-shortcut-button"
                aria-current={selectedDemoId === option.value ? "page" : undefined}
                onClick={() => setSelectedDemoId(option.value)}
              >
                {option.label}
              </button>
            ))}
          </nav>
          <label className="demo-field">
            <span>Line numbers</span>
            <select
              value={lineNumbers}
              onChange={(event) => setLineNumbers(event.target.value as DemoLineNumbersMode)}
            >
              {lineNumberOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          {selectedDemoId === "quad-large-articles" ? (
            <>
              <label className="demo-field demo-field-range">
                <span>Column split</span>
                <input
                  aria-label="Quad column split"
                  min="34"
                  max="66"
                  step="1"
                  type="range"
                  value={quadColumnPercent}
                  onChange={(event) => setQuadColumnPercent(Number(event.target.value))}
                />
                <output>{quadColumnPercent}%</output>
              </label>
              <label className="demo-field demo-field-range">
                <span>Row split</span>
                <input
                  aria-label="Quad row split"
                  min="34"
                  max="66"
                  step="1"
                  type="range"
                  value={quadRowPercent}
                  onChange={(event) => setQuadRowPercent(Number(event.target.value))}
                />
                <output>{quadRowPercent}%</output>
              </label>
            </>
          ) : (
            <label className="demo-field demo-field-range">
              <span>Editor width</span>
              <input
                aria-label="Editor width"
                min="46"
                max="100"
                step="1"
                type="range"
                value={editorWidthPercent}
                onChange={(event) => setEditorWidthPercent(Number(event.target.value))}
              />
              <output>{editorWidthPercent}%</output>
            </label>
          )}
          <label className="demo-toggle">
            <input
              checked={vimMode}
              type="checkbox"
              onChange={(event) => setVimMode(event.target.checked)}
            />
            <span>Vim mode</span>
          </label>
          <label className="demo-toggle">
            <input
              checked={readOnly}
              type="checkbox"
              onChange={(event) => setReadOnly(event.target.checked)}
            />
            <span>Read only</span>
          </label>
        </section>

        <section className="demo-panel" aria-label="Runtime state">
          <h2>Runtime</h2>
          <div className="demo-meter">
            <span>Mode</span>
            <strong>{activeMode}</strong>
          </div>
          <div className="demo-meter">
            <span>Saved</span>
            <strong>{runtimeSavedLength} chars</strong>
          </div>
          <div className="demo-meter">
            <span>Opened link</span>
            <strong>{lastOpenedPath ?? "none"}</strong>
          </div>
        </section>
      </aside>

      <section className="demo-editor-frame" aria-label="obeditor demo">
        {selectedDemoId === "quad-large-articles" ? (
          <QuadLargeArticlesDemo
            adapter={adapter}
            columnPercent={quadColumnPercent}
            lineNumbers={lineNumbers}
            readOnly={readOnly}
            rowPercent={quadRowPercent}
            vimMode={vimMode}
          />
        ) : (
          <div
            className="demo-editor-stage"
            data-editor-width-percent={editorWidthPercent}
            style={{ "--demo-editor-width": `${editorWidthPercent}%` } as CSSProperties}
          >
            <UniversalMarkdownEditor
              lineNumbers={lineNumbers}
              readOnly={readOnly}
              service={service}
              vimMode={vimMode}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function QuadLargeArticlesDemo({
  adapter,
  columnPercent,
  lineNumbers,
  readOnly,
  rowPercent,
  vimMode,
}: {
  adapter: EditorHostAdapter;
  columnPercent: number;
  lineNumbers: DemoLineNumbersMode;
  readOnly: boolean;
  rowPercent: number;
  vimMode: boolean;
}) {
  const services = useMemo(() => quadLargeArticleDocuments.map((document) =>
    createEditorService({
      document: createDemoEditorDocument(document),
      adapter,
      plugins: createDefaultMarkdownPlugins(),
    })), [adapter]);

  useEffect(() => () => {
    services.forEach((service) => service.dispose());
  }, [services]);

  return (
    <div
      className="demo-quad-editor-stage"
      data-quad-column-percent={columnPercent}
      data-quad-row-percent={rowPercent}
      style={{
        "--demo-quad-column": `${columnPercent}%`,
        "--demo-quad-row": `${rowPercent}%`,
      } as CSSProperties}
    >
      {quadLargeArticleDocuments.map((document, index) => (
        <section
          key={document.id}
          className="demo-quad-editor-cell"
          aria-label={`Quad editor ${index + 1}`}
          data-quad-editor-index={index}
        >
          <UniversalMarkdownEditor
            lineNumbers={lineNumbers}
            readOnly={readOnly}
            service={services[index]!}
            vimMode={vimMode}
          />
        </section>
      ))}
    </div>
  );
}
