import { expect, test } from "@playwright/test";

test("keeps editor state alive across mode switches and saves through the host adapter", async ({ page }) => {
  await page.goto("/");

  const editor = page.locator(".oe-code-editor .cm-content");
  await expect(editor).toBeVisible();
  await expect(page.locator(".oe-toolbar-title")).toContainText("demo.md");

  await editor.click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await page.keyboard.type("# Draft\n\nState survives UI mode switches.");

  await page.getByTitle("Read").click();
  await expect(page.locator(".oe-read-view")).toContainText("State survives UI mode switches.");

  await page.getByTitle("Edit").click();
  await expect(editor).toContainText("State survives UI mode switches.");

  await page.getByTitle("Save").click();
  await expect(page.locator(".demo-saved")).toContainText("41 chars");
});
