import { expect, test, type Page } from "@playwright/test";

const selectAllShortcut = process.platform === "darwin" ? "Meta+A" : "Control+A";

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
