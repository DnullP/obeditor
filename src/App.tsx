import { useEffect, useMemo, useState } from "react";
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

type DemoDocumentId = "plugin-system" | "large-table";

interface DemoDocumentDefinition {
  id: DemoDocumentId;
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
};

const demoDocumentOptions: Array<{ value: DemoDocumentId; label: string }> = [
  { value: "plugin-system", label: "Plugin System" },
  { value: "large-table", label: "Large Table" },
];

function resolveInitialDemoDocumentId(): DemoDocumentId {
  if (typeof window === "undefined") {
    return "plugin-system";
  }

  return new URLSearchParams(window.location.search).get("demo") === "large-table"
    ? "large-table"
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
  return Object.values(demoDocuments)
    .find((document) => document.path === pathOrId || document.id === pathOrId)
    ?.referenceCount ?? 0;
}

type DemoLineNumbersMode = CodeMirrorLineNumbersMode;

const lineNumberOptions: Array<{ value: DemoLineNumbersMode; label: string }> = [
  { value: "absolute", label: "Absolute" },
  { value: "relative", label: "Relative" },
  { value: "off", label: "Off" },
];

export function App() {
  const initialDemoId = useMemo(() => resolveInitialDemoDocumentId(), []);
  const [selectedDemoId, setSelectedDemoId] = useState<DemoDocumentId>(initialDemoId);
  const activeDemoDocument = demoDocuments[selectedDemoId];
  const [lineNumbers, setLineNumbers] = useState<DemoLineNumbersMode>("absolute");
  const [vimMode, setVimMode] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [savedContent, setSavedContent] = useState(demoDocuments[initialDemoId].content);
  const [lastOpenedPath, setLastOpenedPath] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<EditorMode>("edit");

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
    document: createDemoEditorDocument(demoDocuments[initialDemoId]),
    adapter,
    plugins: createDefaultMarkdownPlugins(),
  }), [adapter, initialDemoId]);

  useEffect(() => {
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
      if (selectedDemoId === "large-table") {
        url.searchParams.set("demo", "large-table");
      } else {
        url.searchParams.delete("demo");
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
              onChange={(event) => setSelectedDemoId(event.target.value as DemoDocumentId)}
            >
              {demoDocumentOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
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
            <strong>{savedContent.length} chars</strong>
          </div>
          <div className="demo-meter">
            <span>Opened link</span>
            <strong>{lastOpenedPath ?? "none"}</strong>
          </div>
        </section>
      </aside>

      <section className="demo-editor-frame" aria-label="obeditor demo">
        <UniversalMarkdownEditor
          lineNumbers={lineNumbers}
          readOnly={readOnly}
          service={service}
          vimMode={vimMode}
        />
      </section>
    </main>
  );
}
