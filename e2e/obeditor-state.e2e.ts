import { expect, test } from "@playwright/test";

test("keeps editor state alive across mode switches and saves through the host adapter", async ({ page }) => {
  await page.goto("/");

  const editor = page.locator(".oe-code-editor .cm-content");
  await expect(editor).toBeVisible();
  await expect(page.locator(".oe-toolbar-title")).toContainText("Plugin System.md");

  await editor.evaluate((element) => (element as HTMLElement).focus());
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
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

test("shows selected text highlight in edit mode", async ({ page }) => {
  await page.goto("/");

  const editor = page.locator(".oe-code-editor .cm-content");
  await editor.evaluate((element) => (element as HTMLElement).focus());
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");

  await expect(page.locator(".cm-selectionBackground").first()).toBeVisible();
  const background = await page.locator(".cm-selectionBackground").first().evaluate((element) =>
    getComputedStyle(element).backgroundColor,
  );
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  expect(background).not.toBe("transparent");
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
