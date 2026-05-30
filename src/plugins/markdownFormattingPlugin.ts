import type { EditorCommand, EditorPlugin } from "../core/types";

interface MarkdownCommandView {
  state: {
    doc: {
      lineAt(position: number): { from: number };
    };
    selection: {
      main: {
        from: number;
        to: number;
      };
    };
    sliceDoc(from: number, to: number): string;
  };
  dispatch(transaction: {
    changes: { from: number; to?: number; insert: string };
    selection?: { anchor: number; head?: number };
    scrollIntoView?: boolean;
  }): void;
  focus(): void;
}

function toMarkdownCommandView(view: unknown): MarkdownCommandView | null {
  const candidate = view as MarkdownCommandView | null;
  if (
    typeof candidate?.state?.sliceDoc === "function"
    && typeof candidate.state.doc?.lineAt === "function"
    && typeof candidate.dispatch === "function"
    && typeof candidate.focus === "function"
  ) {
    return candidate;
  }
  return null;
}

function replaceSelection(command: {
  label: string;
  left: string;
  right?: string;
  placeholder?: string;
}): EditorCommand["run"] {
  return ({ view }) => {
    const editorView = toMarkdownCommandView(view);
    if (!editorView) {
      return;
    }

    const right = command.right ?? command.left;
    const selection = editorView.state.selection.main;
    const selectedText = editorView.state.sliceDoc(selection.from, selection.to);
    const content = selectedText || command.placeholder || command.label.toLowerCase();
    const insert = `${command.left}${content}${right}`;
    const cursorFrom = selection.from + command.left.length;
    const cursorTo = cursorFrom + content.length;

    editorView.dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert,
      },
      selection: {
        anchor: cursorFrom,
        head: cursorTo,
      },
      scrollIntoView: true,
    });
    editorView.focus();
  };
}

const commands: EditorCommand[] = [
  {
    id: "markdown.bold",
    label: "Bold",
    group: "format",
    icon: "bold",
    run: replaceSelection({ label: "Bold", left: "**", placeholder: "bold" }),
  },
  {
    id: "markdown.italic",
    label: "Italic",
    group: "format",
    icon: "italic",
    run: replaceSelection({ label: "Italic", left: "*", placeholder: "italic" }),
  },
  {
    id: "markdown.inlineCode",
    label: "Inline code",
    group: "format",
    icon: "code",
    run: replaceSelection({ label: "Code", left: "`", placeholder: "code" }),
  },
  {
    id: "markdown.link",
    label: "Link",
    group: "insert",
    icon: "link",
    run: replaceSelection({ label: "Link", left: "[", right: "](https://example.com)", placeholder: "link" }),
  },
  {
    id: "markdown.task",
    label: "Task",
    group: "insert",
    icon: "check-square",
    run: ({ view }) => {
      const editorView = toMarkdownCommandView(view);
      if (!editorView) {
        return;
      }
      const line = editorView.state.doc.lineAt(editorView.state.selection.main.from);
      editorView.dispatch({
        changes: {
          from: line.from,
          insert: "- [ ] ",
        },
        selection: {
          anchor: line.from + 6,
        },
      });
      editorView.focus();
    },
  },
  {
    id: "markdown.table",
    label: "Table",
    group: "insert",
    icon: "table",
    run: ({ view }) => {
      const editorView = toMarkdownCommandView(view);
      if (!editorView) {
        return;
      }
      const insert = "\n| Column A | Column B |\n| --- | --- |\n| value | value |\n";
      const at = editorView.state.selection.main.from;
      editorView.dispatch({
        changes: { from: at, insert },
        selection: { anchor: at + insert.length },
        scrollIntoView: true,
      });
      editorView.focus();
    },
  },
];

export function createMarkdownFormattingPlugin(): EditorPlugin {
  return {
    id: "markdown-formatting",
    setup() {
      return { commands };
    },
  };
}
