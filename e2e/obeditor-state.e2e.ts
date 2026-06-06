import { expect, test, type Page } from "@playwright/test";

const selectAllShortcut = process.platform === "darwin" ? "Meta+A" : "Control+A";

function collectPageFailures(page: Page) {
  const failures: string[] = [];
  page.on("pageerror", (error) => {
    failures.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      failures.push(message.text());
    }
  });
  return failures;
}

async function waitForAnimationFrame(page: Page) {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  }));
}

async function focusEditor(page: Page) {
  const editor = page.locator(".oe-code-editor .cm-content");
  await editor.evaluate((element) => (element as HTMLElement).focus());
  return editor;
}

async function replaceEditorContent(
  page: Page,
  content: string,
) {
  await focusEditor(page);
  await page.keyboard.press(selectAllShortcut);
  await page.keyboard.insertText(content);
}

async function expectSelectionHighlightVisible(page: Page) {
  const selectionBackground = page.locator(".cm-selectionBackground").first();
  await expect(selectionBackground).toBeVisible();
  const background = await selectionBackground.evaluate((element) =>
    getComputedStyle(element).backgroundColor,
  );
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  expect(background).not.toBe("transparent");
}

async function focusLastFrontmatterNavigationTarget(page: Page) {
  if (await page.locator("[data-obeditor-frontmatter-ready='true']").count() === 0) {
    await page.locator(".cm-line", { hasText: /^Plugin System$/ }).first().click();
  }

  await expect(page.locator("[data-obeditor-frontmatter-ready='true']")).toBeVisible();
  await expect.poll(async () => page.evaluate(() =>
    document.querySelectorAll("[data-frontmatter-vim-nav='true']").length,
  )).toBeGreaterThan(0);

  await page.evaluate(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>(
      "[data-frontmatter-vim-nav='true']",
    ));
    targets.at(-1)?.focus();
  });
}

async function expectEditorFocused(page: Page) {
  await expect.poll(async () => page.evaluate(() => {
    const activeElement = document.activeElement;
    const editorContent = document.querySelector(".oe-code-editor .cm-content");
    return Boolean(activeElement && editorContent && activeElement === editorContent);
  })).toBe(true);
}

async function getActiveLineText(page: Page) {
  return page.evaluate(() => document.querySelector(".cm-activeLine")?.textContent ?? "");
}

test("keeps editor state alive across mode switches and saves through the host adapter", async ({ page }) => {
  await page.goto("/");

  const editor = await focusEditor(page);
  await expect(editor).toBeVisible();
  await expect(page.locator(".oe-toolbar-title")).toContainText("Plugin System.md");

  await page.keyboard.press(selectAllShortcut);
  await page.keyboard.type("# Draft\n\nState survives UI mode switches.");

  await page.getByTitle("Read").click();
  await expect(page.locator(".oe-read-view")).toContainText("State survives UI mode switches.");

  await page.getByTitle("Edit").click();
  await expect(editor).toContainText("State survives UI mode switches.");

  await page.getByTitle("Save").click();
  await expect(page.locator(".demo-meter").filter({ hasText: "Saved" })).toContainText("41 chars");
});

test("lets the demo sidebar reconfigure line numbers and Vim mode", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".cm-gutters")).toBeVisible();
  await page.getByLabel("Line numbers").selectOption("off");
  await expect(page.locator(".cm-gutters")).toBeHidden();

  await page.getByLabel("Line numbers").selectOption("relative");
  await expect(page.locator(".cm-gutters")).toBeVisible();

  await page.getByLabel("Vim mode").check();
  await expect(page.locator(".cm-vimMode")).toBeVisible();
});

test("lets demo shortcuts jump directly to test surfaces without typing URLs", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Large Table" }).click();
  await expect(page.getByLabel("Demo note")).toHaveValue("large-table");
  await expect(page.locator(".oe-toolbar-title")).toContainText("Large Table Canvas.md");
  await expect(page).toHaveURL(/demo=large-table/);

  await page.getByRole("button", { name: "Large Article" }).click();
  await expect(page.getByLabel("Demo note")).toHaveValue("large-article");
  await expect(page.locator(".oe-toolbar-title")).toContainText("Large Article Performance.md");
  await expect(page).toHaveURL(/demo=large-article/);

  await page.getByRole("button", { name: "Quad Editors" }).click();
  await expect(page.getByLabel("Demo note")).toHaveValue("quad-large-articles");
  await expect(page.locator(".demo-quad-editor-cell")).toHaveCount(4);
  await expect(page).toHaveURL(/demo=quad-large-articles/);

  await page.getByRole("button", { name: "Baseline" }).click();
  await expect(page.getByLabel("Demo note")).toHaveValue("plugin-system");
  await expect(page.locator(".oe-toolbar-title")).toContainText("Plugin System.md");
  await expect.poll(async () => page.evaluate(() => new URL(window.location.href).search)).toBe("");
});

test("keeps Vim vertical movement connected across rendered markdown tables", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Vim mode").check();
  await expect(page.locator(".cm-vimMode")).toBeVisible();

  const editor = await focusEditor(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("g");
  await page.keyboard.press("g");

  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("j");
  }

  await expect.poll(async () => page.evaluate(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    return {
      isTableNavigation: activeElement?.dataset.markdownTableVimNav ?? null,
      rowIndex: activeElement?.dataset.markdownTableRowIndex ?? null,
      section: activeElement?.dataset.markdownTableSection ?? null,
    };
  })).toEqual({
    isTableNavigation: "true",
    rowIndex: "0",
    section: "body",
  });

  await editor.evaluate((element) => (element as HTMLElement).focus());
  await page.keyboard.press("Escape");
  await page.keyboard.press("Shift+G");

  for (let i = 0; i < 8; i += 1) {
    await page.keyboard.press("k");
  }

  await expect.poll(async () => page.evaluate(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    const entryAnchors = Array.from(document.querySelectorAll<HTMLElement>(
      "[data-markdown-table-entry-anchor='true']",
    ));
    const lastRowIndex = Math.max(
      ...entryAnchors.map((element) => Number(element.dataset.markdownTableRowIndex ?? "-1")),
    );
    return {
      isTableNavigation: activeElement?.dataset.markdownTableVimNav ?? null,
      rowIndex: activeElement?.dataset.markdownTableRowIndex ?? null,
      section: activeElement?.dataset.markdownTableSection ?? null,
      expectedLastRowIndex: String(lastRowIndex),
    };
  })).toEqual({
    isTableNavigation: "true",
    rowIndex: "14",
    section: "body",
    expectedLastRowIndex: "14",
  });
});

test("lets Vim leave frontmatter navigation with j and continue moving through the editor body", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Vim mode").check();
  await expect(page.locator(".cm-vimMode")).toBeVisible();

  await focusEditor(page);
  await page.keyboard.press("Escape");
  await focusLastFrontmatterNavigationTarget(page);

  await expect.poll(async () => page.evaluate(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    return activeElement?.dataset.frontmatterVimNav ?? null;
  })).toBe("true");

  await page.keyboard.press("j");
  await expectEditorFocused(page);

  await page.keyboard.press("j");
  await expect.poll(async () => getActiveLineText(page)).toContain("# Plugin System");
});

test("lets Escape leave frontmatter navigation and restore editor focus at the body anchor", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Vim mode").check();
  await expect(page.locator(".cm-vimMode")).toBeVisible();

  await focusEditor(page);
  await page.keyboard.press("Escape");
  await focusLastFrontmatterNavigationTarget(page);
  await page.keyboard.press("Escape");

  await expectEditorFocused(page);
});

test("shows selected text highlight in edit mode", async ({ page }) => {
  await page.goto("/");

  await focusEditor(page);
  await page.keyboard.press(selectAllShortcut);
  await expectSelectionHighlightVisible(page);
});

test("shows selected text highlight in Vim visual mode", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Vim mode").check();
  await expect(page.locator(".cm-vimMode")).toBeVisible();

  await focusEditor(page);
  await page.keyboard.press("Escape");
  await page.keyboard.press("g");
  await page.keyboard.press("g");
  await page.keyboard.press("v");
  await page.keyboard.press("j");

  await expectSelectionHighlightVisible(page);
});

test("keeps rendered markdown tables from covering following quote text", async ({ page }) => {
  await page.goto("/");

  const table = page.locator(".cm-markdown-table-widget").first();
  await expect(table).toBeVisible();

  const initialHeight = await table.evaluate((element) => element.getBoundingClientRect().height);
  await page.waitForTimeout(800);
  await expect.poll(async () => table.evaluate((element) => element.getBoundingClientRect().height)).toBe(initialHeight);

  await page.locator(".cm-scroller").evaluate((element) => {
    element.scrollTop = 1240;
    element.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await expect(page.locator(".cm-line", { hasText: "优先使用官方插件" }).first()).toBeVisible();

  const geometry = await page.evaluate(() => {
    const tableElement = document.querySelector(".cm-markdown-table-widget");
    const quoteElement = Array.from(document.querySelectorAll(".cm-line"))
      .find((element) => element.textContent?.includes("优先使用官方插件"));
    const tableRect = tableElement?.getBoundingClientRect();
    const quoteRect = quoteElement?.getBoundingClientRect();
    return tableRect && quoteRect
      ? {
        tableBottom: tableRect.bottom,
        quoteTop: quoteRect.top,
      }
      : null;
  });

  expect(geometry).not.toBeNull();
  expect(geometry!.quoteTop).toBeGreaterThan(geometry!.tableBottom);
});

test("keeps markdown table source expansion from shifting following content", async ({ page }) => {
  await page.goto("/");

  const rows = Array.from({ length: 15 }, (_, index) =>
    `| plugin-${String(index + 1).padStart(2, "0")} | file system access | capability contract |`,
  );
  await replaceEditorContent(page, [
    "# Table reserve",
    "",
    "| Plugin | Purpose | Notes |",
    "| --- | --- | --- |",
    ...rows,
    "<!-- obeditor-table-layout: {\"columns\":[226,164,208],\"rows\":[38,38,38,38,38,38,38,38,38,38,38,38,38,38,38]} -->",
    "",
    "> stable quote follows the table",
    "",
    "End.",
  ].join("\n"));

  await expect(page.locator(".cm-markdown-table-widget").first()).toBeVisible();
  await expect(page.locator(".cm-line", { hasText: "stable quote follows" }).first()).toBeVisible();

  const quoteTopBefore = await page.locator(".cm-line", { hasText: "stable quote follows" }).first()
    .evaluate((element) => element.getBoundingClientRect().top);

  await focusEditor(page);
  await page.keyboard.press(selectAllShortcut);
  await expect(page.locator(".cm-source-visible-block-reserve-line").first()).toBeVisible();

  const quoteTopAfter = await page.locator(".cm-line", { hasText: "stable quote follows" }).first()
    .evaluate((element) => element.getBoundingClientRect().top);

  expect(Math.abs(quoteTopAfter - quoteTopBefore)).toBeLessThanOrEqual(80);
});

test("reflows table row height while resizing a column instead of squeezing content", async ({ page }) => {
  await page.goto("/");

  await replaceEditorContent(page, [
    "# Resize table",
    "",
    "| Detail | Status |",
    "| --- | --- |",
    "| Long **markdown** content with $x^2 + y^2 = z^2$, `inline code`, and enough prose to require natural wrapping when the column becomes narrow. | Open |",
    "<!-- obeditor-table-layout: {\"columns\":[420,164]} -->",
    "",
    "End.",
  ].join("\n"));

  const table = page.locator(".cm-markdown-table-widget .mtv-table").first();
  await expect(table).toBeVisible();

  const measureTable = async () => page.evaluate(() => {
    const firstHeaderCell = document.querySelector<HTMLElement>(".mtv-table-head-cell");
    const firstBodyCell = document.querySelector<HTMLElement>(".mtv-table-body-cell");
    const firstPreview = firstBodyCell?.querySelector<HTMLElement>(".mtv-cell-preview");
    return {
      columnWidth: firstHeaderCell?.getBoundingClientRect().width ?? 0,
      bodyCellHeight: firstBodyCell?.getBoundingClientRect().height ?? 0,
      previewScrollHeight: firstPreview?.scrollHeight ?? 0,
      previewClientHeight: firstPreview?.clientHeight ?? 0,
    };
  });

  const before = await measureTable();
  const resizeHandle = page.locator(".mtv-table-head-cell [data-table-resize-kind='column']").first();
  const handleBounds = await resizeHandle.boundingBox();
  expect(handleBounds).not.toBeNull();

  await page.mouse.move(handleBounds!.x + handleBounds!.width / 2, handleBounds!.y + handleBounds!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBounds!.x - 300, handleBounds!.y + handleBounds!.height / 2);
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const during = await measureTable();
  await page.mouse.up();
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  const after = await measureTable();

  expect(during.columnWidth).toBeLessThan(before.columnWidth - 200);
  expect(during.bodyCellHeight).toBeGreaterThan(before.bodyCellHeight + 40);
  expect(after.columnWidth).toBeLessThan(before.columnWidth - 200);
  expect(after.bodyCellHeight).toBeGreaterThan(before.bodyCellHeight + 40);
  expect(after.previewScrollHeight).toBeLessThanOrEqual(after.previewClientHeight + 1);
});

test("renders the large table demo with Canvas while preserving editing and Vim navigation", async ({ page }) => {
  await page.goto("/?demo=large-table");

  await expect(page.getByLabel("Demo note")).toHaveValue("large-table");
  await expect(page.locator(".oe-toolbar-title")).toContainText("Large Table Canvas.md");

  const table = page.locator(".mtv-table[data-render-engine='canvas']").first();
  await expect(table).toBeVisible();
  await expect(table).toHaveAttribute("data-total-body-rows", "720");

  const canvas = page.locator("[data-markdown-table-canvas-layer='true']").first();
  await expect(canvas).toBeVisible();
  await page.getByLabel("Vim mode").check();
  await expect(page.locator(".cm-vimMode")).toBeVisible();

  await expect.poll(async () => page.evaluate(() => {
    const canvasElement = document.querySelector<HTMLCanvasElement>("[data-markdown-table-canvas-layer='true']");
    const context = canvasElement?.getContext("2d");
    if (!canvasElement || !context) {
      return 0;
    }

    const imageData = context.getImageData(
      0,
      0,
      Math.min(canvasElement.width, 480),
      Math.min(canvasElement.height, 240),
    ).data;
    let paintedPixels = 0;
    for (let index = 0; index < imageData.length; index += 4) {
      const red = imageData[index] ?? 255;
      const green = imageData[index + 1] ?? 255;
      const blue = imageData[index + 2] ?? 255;
      const alpha = imageData[index + 3] ?? 0;
      if (alpha > 0 && (red < 245 || green < 245 || blue < 245)) {
        paintedPixels += 1;
      }
    }
    return paintedPixels;
  })).toBeGreaterThan(0);

  const renderStats = await page.evaluate(() => {
    const tableElement = document.querySelector<HTMLElement>(".mtv-table[data-render-engine='canvas']");
    return {
      totalRows: Number(tableElement?.dataset.totalBodyRows ?? 0),
      renderedRows: Number(tableElement?.dataset.renderedBodyRows ?? 0),
      bodyCellCount: tableElement?.querySelectorAll(".mtv-table-body-cell").length ?? 0,
      entryAnchorCount: tableElement?.querySelectorAll("[data-markdown-table-entry-anchor='true']").length ?? 0,
    };
  });

  expect(renderStats.totalRows).toBe(720);
  expect(renderStats.renderedRows).toBeGreaterThan(0);
  expect(renderStats.renderedRows).toBeLessThan(renderStats.totalRows);
  expect(renderStats.bodyCellCount).toBeLessThan(8);
  expect(renderStats.entryAnchorCount).toBeGreaterThan(0);
  expect(renderStats.entryAnchorCount).toBeLessThan(120);

  const canvasBounds = await canvas.boundingBox();
  expect(canvasBounds).not.toBeNull();
  await page.mouse.click(canvasBounds!.x + 36, canvasBounds!.y + 18);

  const activeInput = page.locator("[data-markdown-table-canvas-active-cell='true'] input").first();
  await expect(activeInput).toBeVisible();
  await expect(activeInput).toHaveValue("R-0001");
  await expect.poll(async () => page.evaluate(() => {
    const activeElement = document.activeElement;
    return Boolean(activeElement?.matches("[data-markdown-table-canvas-active-cell='true'] input"));
  })).toBe(true);

  await page.keyboard.press("Escape");
  await expect.poll(async () => page.evaluate(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    return {
      isTableNavigation: activeElement?.dataset.markdownTableVimNav ?? null,
      rowIndex: activeElement?.dataset.markdownTableRowIndex ?? null,
      section: activeElement?.dataset.markdownTableSection ?? null,
    };
  })).toEqual({
    isTableNavigation: "true",
    rowIndex: "0",
    section: "body",
  });

  await page.keyboard.press("j");
  await expect.poll(async () => page.evaluate(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    return activeElement?.dataset.markdownTableRowIndex ?? null;
  })).toBe("1");

  await page.keyboard.press("k");
  await expect.poll(async () => page.evaluate(() => {
    const activeElement = document.activeElement as HTMLElement | null;
    return activeElement?.dataset.markdownTableRowIndex ?? null;
  })).toBe("0");
});

test("batches large article editing sync and flushes latest content before read mode", async ({ page }) => {
  const failures = collectPageFailures(page);
  await page.goto("/?demo=large-article");

  await expect(page.getByLabel("Demo note")).toHaveValue("large-article");
  await expect(page.locator(".oe-toolbar-title")).toContainText("Large Article Performance.md");
  await expect(page.locator(".oe-code-editor .cm-content")).toBeVisible();

  const initialStats = await page.evaluate(() => window.__OBEDITOR_DEMO_STATS?.documentChangedCount ?? 0);
  const initialRenderedLineCount = await page.locator(".oe-code-editor .cm-line").count();
  expect(initialRenderedLineCount).toBeGreaterThan(0);
  expect(initialRenderedLineCount).toBeLessThan(260);

  await focusEditor(page);
  await page.keyboard.type("FAST_SYNC_MARKER\n", { delay: 1 });
  await waitForAnimationFrame(page);
  await waitForAnimationFrame(page);

  const afterTypingStats = await page.evaluate(() => window.__OBEDITOR_DEMO_STATS?.documentChangedCount ?? 0);
  expect(afterTypingStats - initialStats).toBeLessThanOrEqual(1);

  await page.getByTitle("Read").click();
  await expect(page.locator(".oe-read-view")).toContainText("FAST_SYNC_MARKER");

  const afterReadStats = await page.evaluate(() => window.__OBEDITOR_DEMO_STATS?.documentChangedCount ?? 0);
  expect(afterReadStats - initialStats).toBeLessThanOrEqual(2);
  expect(failures).toEqual([]);
});

test("keeps the large article editor responsive while its width changes continuously", async ({ page }) => {
  const failures = collectPageFailures(page);
  await page.goto("/?demo=large-article");

  await expect(page.getByLabel("Demo note")).toHaveValue("large-article");
  await focusEditor(page);

  const widths = [
    100, 96, 92, 88, 84, 80, 76, 72, 68, 64, 60, 56, 52, 48, 46,
    52, 58, 64, 70, 76, 82, 88, 94, 100,
  ];
  const samples = await page.evaluate(async (nextWidths) => {
    const widthControl = document.querySelector<HTMLInputElement>("input[aria-label='Editor width']");
    if (!widthControl) {
      throw new Error("Editor width control not found");
    }

    const waitFrame = () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    const setNativeInputValue = (input: HTMLInputElement, value: number): void => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      if (!valueSetter) {
        input.value = String(value);
        return;
      }

      valueSetter.call(input, String(value));
    };
    const collected: Array<{
      width: number;
      frameMs: number;
      appliedWidth: number;
      editorWidth: number;
      contentVisible: boolean;
      editorFocused: boolean;
      renderedLineCount: number;
    }> = [];

    for (const width of nextWidths) {
      const startedAt = performance.now();
      setNativeInputValue(widthControl, width);
      widthControl.dispatchEvent(new Event("input", { bubbles: true }));
      widthControl.dispatchEvent(new Event("change", { bubbles: true }));
      await waitFrame();

      const editorStage = document.querySelector<HTMLElement>(".demo-editor-stage");
      const editorElement = document.querySelector<HTMLElement>(".oe-code-editor .cm-editor");
      const contentElement = document.querySelector<HTMLElement>(".oe-code-editor .cm-content");
      const contentRect = contentElement?.getBoundingClientRect();
      collected.push({
        width,
        frameMs: performance.now() - startedAt,
        appliedWidth: Number(editorStage?.dataset.editorWidthPercent ?? 0),
        editorWidth: editorElement?.getBoundingClientRect().width ?? 0,
        contentVisible: Boolean(
          contentElement
          && contentRect
          && contentRect.width > 0
          && contentRect.height > 0
          && getComputedStyle(contentElement).visibility !== "hidden"
        ),
        editorFocused: document.activeElement === contentElement,
        renderedLineCount: document.querySelectorAll(".oe-code-editor .cm-line").length,
      });
    }

    return collected;
  }, widths);

  expect(samples.length).toBe(widths.length);
  expect(samples.map((sample) => sample.appliedWidth)).toEqual(widths);
  expect(Math.max(...samples.map((sample) => sample.editorWidth))).toBeGreaterThan(
    Math.min(...samples.map((sample) => sample.editorWidth)) + 280,
  );
  expect(Math.max(...samples.map((sample) => sample.frameMs))).toBeLessThan(250);
  for (const sample of samples) {
    expect(sample.contentVisible).toBe(true);
    expect(sample.editorFocused).toBe(true);
    expect(sample.renderedLineCount).toBeGreaterThan(0);
    expect(sample.renderedLineCount).toBeLessThan(260);
  }
  expect(failures).toEqual([]);
});

test("keeps four large article editors visible while quadrant splits resize together", async ({ page }) => {
  const failures = collectPageFailures(page);
  await page.goto("/?demo=quad-large-articles");

  await expect(page.getByLabel("Demo note")).toHaveValue("quad-large-articles");
  await expect(page.locator(".demo-quad-editor-cell")).toHaveCount(4);
  await expect.poll(async () => page.locator(".demo-quad-editor-cell .cm-content").count()).toBe(4);

  const sequence = [
    { column: 50, row: 50 },
    { column: 58, row: 42 },
    { column: 64, row: 36 },
    { column: 60, row: 62 },
    { column: 45, row: 66 },
    { column: 34, row: 55 },
    { column: 40, row: 40 },
    { column: 50, row: 50 },
  ];
  const samples = await page.evaluate(async (resizeSequence) => {
    const stage = document.querySelector<HTMLElement>(".demo-quad-editor-stage");
    if (!stage) {
      throw new Error("Quad editor stage not found");
    }

    const waitFrame = () => new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const collected: Array<{
      column: number;
      row: number;
      appliedColumn: number;
      appliedRow: number;
      allEditorsVisible: boolean;
      totalRenderedLineCount: number;
      maxRenderedLineCount: number;
      editorWidths: number[];
      editorHeights: number[];
    }> = [];

    for (const { column, row } of resizeSequence) {
      stage.style.setProperty("--demo-quad-column", `${column}%`);
      stage.style.setProperty("--demo-quad-row", `${row}%`);
      stage.dataset.quadColumnPercent = String(column);
      stage.dataset.quadRowPercent = String(row);
      await waitFrame();

      const editors = Array.from(document.querySelectorAll<HTMLElement>(".demo-quad-editor-cell"));
      const editorMeasurements = editors.map((editor) => {
        const root = editor.querySelector<HTMLElement>(".oe-editor");
        const content = editor.querySelector<HTMLElement>(".cm-content");
        const rect = root?.getBoundingClientRect();
        const contentRect = content?.getBoundingClientRect();
        return {
          width: rect?.width ?? 0,
          height: rect?.height ?? 0,
          renderedLineCount: editor.querySelectorAll(".cm-line").length,
          visible: Boolean(
            rect
            && contentRect
            && rect.width > 0
            && rect.height > 0
            && contentRect.width > 0
            && contentRect.height > 0
          ),
        };
      });

      collected.push({
        column,
        row,
        appliedColumn: Number(stage?.dataset.quadColumnPercent ?? 0),
        appliedRow: Number(stage?.dataset.quadRowPercent ?? 0),
        allEditorsVisible: editorMeasurements.every((editor) => editor.visible),
        totalRenderedLineCount: editorMeasurements.reduce((total, editor) => total + editor.renderedLineCount, 0),
        maxRenderedLineCount: Math.max(...editorMeasurements.map((editor) => editor.renderedLineCount)),
        editorWidths: editorMeasurements.map((editor) => editor.width),
        editorHeights: editorMeasurements.map((editor) => editor.height),
      });
    }

    return collected;
  }, sequence);

  expect(samples.map((sample) => ({ column: sample.appliedColumn, row: sample.appliedRow }))).toEqual(sequence);
  expect(Math.max(...samples.flatMap((sample) => sample.editorWidths))).toBeGreaterThan(
    Math.min(...samples.flatMap((sample) => sample.editorWidths)) + 180,
  );
  expect(Math.max(...samples.flatMap((sample) => sample.editorHeights))).toBeGreaterThan(
    Math.min(...samples.flatMap((sample) => sample.editorHeights)) + 180,
  );
  for (const sample of samples) {
    expect(sample.allEditorsVisible).toBe(true);
    expect(sample.totalRenderedLineCount).toBeGreaterThan(0);
    expect(sample.totalRenderedLineCount).toBeLessThan(900);
    expect(sample.maxRenderedLineCount).toBeLessThan(260);
  }
  expect(failures).toEqual([]);
});
