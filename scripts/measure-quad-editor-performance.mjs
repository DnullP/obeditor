import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = process.env.OBEDITOR_PERF_BASE_URL ?? "http://127.0.0.1:4317";
const reportDir = path.join(repoRoot, "performance-reports");
const reportJsonPath = path.join(reportDir, "quad-editor-resize-latest.json");
const reportMarkdownPath = path.join(reportDir, "quad-editor-resize-latest.md");
const layoutLightweightAttr = "data-layout-lightweight";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(800) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForServerReady(timeoutMs = 30_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isServerReady()) {
      return;
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${baseUrl}`);
}

async function startServerIfNeeded() {
  if (await isServerReady()) {
    return null;
  }

  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  const server = spawn(npmCommand, ["run", "dev"], {
    cwd: repoRoot,
    env: {
      ...process.env,
      NO_PROXY: [process.env.NO_PROXY, "127.0.0.1", "localhost", "::1"].filter(Boolean).join(","),
      no_proxy: [process.env.no_proxy, "127.0.0.1", "localhost", "::1"].filter(Boolean).join(","),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => process.stdout.write(`[perf-server] ${chunk}`));
  server.stderr.on("data", (chunk) => process.stderr.write(`[perf-server] ${chunk}`));
  await waitForServerReady();
  return server;
}

function quantile(values, percentile) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1),
  );
  return sorted[index] ?? 0;
}

function round(value, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function buildResizeSequence(frameCount = 96) {
  return Array.from({ length: frameCount }, (_, index) => {
    const phase = (index / Math.max(1, frameCount - 1)) * Math.PI * 4;
    return {
      column: Math.round(50 + Math.sin(phase) * 16),
      row: Math.round(50 + Math.cos(phase) * 16),
    };
  });
}

function summarizeSamples(samples, integritySamples, longTasks, pageFailures) {
  const resizeSamples = samples.filter((sample) => sample.phase === "resize");
  const frameMs = resizeSamples.map((sample) => sample.frameMs);
  const totalRenderedLines = integritySamples.map((sample) => sample.totalRenderedLines);
  const domNodes = integritySamples.map((sample) => sample.domNodeCount);
  const heapSamples = integritySamples
    .map((sample) => sample.usedJSHeapSize)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  const allEditorsVisibleFrames = integritySamples.filter((sample) => sample.allEditorsVisible).length;

  return {
    frameCount: samples.length,
    resizeFrameCount: resizeSamples.length,
    frameMs: {
      average: round(frameMs.reduce((total, value) => total + value, 0) / Math.max(1, frameMs.length)),
      p50: round(quantile(frameMs, 50)),
      p75: round(quantile(frameMs, 75)),
      p95: round(quantile(frameMs, 95)),
      p99: round(quantile(frameMs, 99)),
      max: round(Math.max(...frameMs)),
      over16_7ms: frameMs.filter((value) => value > 16.7).length,
      over33_3ms: frameMs.filter((value) => value > 33.3).length,
      over50ms: frameMs.filter((value) => value > 50).length,
    },
    settleFrameMs: round(samples.find((sample) => sample.phase === "settle")?.frameMs ?? 0),
    integritySamples: integritySamples.length,
    longTasks: {
      count: longTasks.length,
      maxMs: longTasks.length > 0 ? round(Math.max(...longTasks.map((task) => task.duration))) : 0,
      totalMs: round(longTasks.reduce((total, task) => total + task.duration, 0)),
    },
    renderedLines: {
      averageTotal: round(totalRenderedLines.reduce((total, value) => total + value, 0) / Math.max(1, totalRenderedLines.length)),
      maxTotal: totalRenderedLines.length > 0 ? Math.max(...totalRenderedLines) : 0,
    },
    domNodes: {
      max: domNodes.length > 0 ? Math.max(...domNodes) : 0,
      average: round(domNodes.reduce((total, value) => total + value, 0) / Math.max(1, domNodes.length)),
    },
    heap: heapSamples.length > 0
      ? {
        startMB: round((heapSamples[0] ?? 0) / 1024 / 1024),
        endMB: round((heapSamples[heapSamples.length - 1] ?? 0) / 1024 / 1024),
        peakMB: round(Math.max(...heapSamples) / 1024 / 1024),
      }
      : null,
    visibility: {
      allEditorsVisibleFrames,
      allEditorsVisibleRate: round(allEditorsVisibleFrames / Math.max(1, integritySamples.length), 4),
    },
    pageFailures,
  };
}

function buildMarkdownReport(report) {
  const { summary } = report;
  const dropped16 = `${summary.frameMs.over16_7ms}/${summary.resizeFrameCount}`;
  const dropped33 = `${summary.frameMs.over33_3ms}/${summary.resizeFrameCount}`;
  const heapText = summary.heap
    ? `${summary.heap.startMB} -> ${summary.heap.endMB} MB, peak ${summary.heap.peakMB} MB`
    : "not exposed by browser";

  return [
    "# Quad Editor Resize Performance",
    "",
    `- URL: ${report.url}`,
    `- Captured at: ${report.capturedAt}`,
    `- Editors: 4 independent UniversalMarkdownEditor instances`,
    `- Document size: ${report.documentCharsPerEditor.toLocaleString()} chars/editor`,
    `- Resize frames: ${summary.resizeFrameCount}`,
    `- Layout lightweight gate: ${layoutLightweightAttr}=true during resize, flushed once after release`,
    "",
    "| Metric | Value |",
    "| --- | ---: |",
    `| Frame average | ${summary.frameMs.average} ms |`,
    `| Frame p50 | ${summary.frameMs.p50} ms |`,
    `| Frame p75 | ${summary.frameMs.p75} ms |`,
    `| Frame p95 | ${summary.frameMs.p95} ms |`,
    `| Frame p99 | ${summary.frameMs.p99} ms |`,
    `| Frame max | ${summary.frameMs.max} ms |`,
    `| Frames > 16.7 ms | ${dropped16} |`,
    `| Frames > 33.3 ms | ${dropped33} |`,
    `| Settle frame after release | ${summary.settleFrameMs} ms |`,
    `| Long tasks | ${summary.longTasks.count} |`,
    `| Long task max | ${summary.longTasks.maxMs} ms |`,
    `| Long task total | ${summary.longTasks.totalMs} ms |`,
    `| Integrity samples | ${summary.integritySamples} |`,
    `| Rendered CodeMirror lines avg total | ${summary.renderedLines.averageTotal} |`,
    `| Rendered CodeMirror lines max total | ${summary.renderedLines.maxTotal} |`,
    `| DOM nodes avg | ${summary.domNodes.average} |`,
    `| DOM nodes max | ${summary.domNodes.max} |`,
    `| JS heap | ${heapText} |`,
    `| All editors visible | ${(summary.visibility.allEditorsVisibleRate * 100).toFixed(2)}% |`,
    `| Page failures | ${summary.pageFailures.length} |`,
    "",
    "## Notes",
    "",
    "- Resize frame timing is measured from quadrant stage split mutation to the next animation frame.",
    "- Per-frame timing avoids geometry reads; DOM geometry and rendered line counts are collected as separate integrity samples.",
    "- The test changes both row and column splits on every frame while the document-level lightweight layout gate is active.",
    "- The settle frame removes the gate and captures the one post-resize measurement flush separately from drag frames.",
    "- CodeMirror line counts should stay bounded, proving editor virtualization remains active under multi-editor pressure.",
    "",
  ].join("\n");
}

async function run() {
  const server = await startServerIfNeeded();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
  const pageFailures = [];

  page.on("pageerror", (error) => {
    pageFailures.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      pageFailures.push(`console: ${message.text()}`);
    }
  });

  try {
    const url = `${baseUrl}/?demo=quad-large-articles`;
    await page.goto(url);
    await page.getByLabel("Demo note").selectOption("quad-large-articles");
    await page.waitForSelector(".demo-quad-editor-stage[data-quad-column-percent='50']");
    await page.waitForSelector(".demo-quad-editor-cell .cm-content");

    await page.evaluate(() => {
      window.__OBEDITOR_QUAD_PERF_LONG_TASKS = [];
      if ("PerformanceObserver" in window) {
        const observer = new PerformanceObserver((list) => {
          window.__OBEDITOR_QUAD_PERF_LONG_TASKS.push(
            ...list.getEntries().map((entry) => ({
              name: entry.name,
              startTime: entry.startTime,
              duration: entry.duration,
            })),
          );
        });
        observer.observe({ entryTypes: ["longtask"] });
        window.__OBEDITOR_QUAD_PERF_OBSERVER = observer;
      }
    });

    const sequence = buildResizeSequence();
    const samples = await page.evaluate(async ({ attr, resizeSequence }) => {
      const stage = document.querySelector(".demo-quad-editor-stage");
      if (!(stage instanceof HTMLElement)) {
        throw new Error("Quad editor stage not found");
      }

      const waitFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
      const collectFrameSample = (startedAt, column, row, phase) => ({
        phase,
        column,
        row,
        appliedColumn: Number(stage.dataset.quadColumnPercent ?? 0),
        appliedRow: Number(stage.dataset.quadRowPercent ?? 0),
        frameMs: performance.now() - startedAt,
      });
      const collectIntegritySample = (phase) => {
        const stage = document.querySelector(".demo-quad-editor-stage");
        const cells = Array.from(document.querySelectorAll(".demo-quad-editor-cell"));
        const editors = cells.map((cell) => {
          const root = cell.querySelector(".oe-editor");
          const content = cell.querySelector(".cm-content");
          const rect = root?.getBoundingClientRect();
          const contentRect = content?.getBoundingClientRect();
          return {
            width: rect?.width ?? 0,
            height: rect?.height ?? 0,
            renderedLines: cell.querySelectorAll(".cm-line").length,
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
        const memory = performance.memory;

        return {
          phase,
          appliedColumn: Number(stage?.dataset.quadColumnPercent ?? 0),
          appliedRow: Number(stage?.dataset.quadRowPercent ?? 0),
          editors,
          allEditorsVisible: editors.every((editor) => editor.visible),
          totalRenderedLines: editors.reduce((total, editor) => total + editor.renderedLines, 0),
          domNodeCount: stage?.querySelectorAll("*").length ?? 0,
          usedJSHeapSize: memory?.usedJSHeapSize ?? null,
        };
      };

      const samples = [];
      const integritySamples = [];
      document.documentElement.setAttribute(attr, "true");
      try {
        for (const [index, { column, row }] of resizeSequence.entries()) {
          const startedAt = performance.now();
          stage.style.setProperty("--demo-quad-column", `${column}%`);
          stage.style.setProperty("--demo-quad-row", `${row}%`);
          stage.dataset.quadColumnPercent = String(column);
          stage.dataset.quadRowPercent = String(row);
          await waitFrame();
          samples.push(collectFrameSample(startedAt, column, row, "resize"));
          if (index === 0 || index === Math.floor(resizeSequence.length / 2)) {
            integritySamples.push(collectIntegritySample("resize-integrity"));
          }
        }
      } finally {
        const last = resizeSequence.at(-1) ?? { column: 50, row: 50 };
        const settleStartedAt = performance.now();
        document.documentElement.removeAttribute(attr);
        await waitFrame();
        samples.push(collectFrameSample(settleStartedAt, last.column, last.row, "settle"));
        integritySamples.push(collectIntegritySample("settle-integrity"));
      }

      return { samples, integritySamples };
    }, { attr: layoutLightweightAttr, resizeSequence: sequence });

    const longTasks = await page.evaluate(() => {
      window.__OBEDITOR_QUAD_PERF_OBSERVER?.disconnect?.();
      return window.__OBEDITOR_QUAD_PERF_LONG_TASKS ?? [];
    });
    const documentCharsPerEditor = await page.evaluate(() => {
      const savedMeter = Array.from(document.querySelectorAll(".demo-meter"))
        .find((element) => element.textContent?.includes("Saved"));
      const savedText = savedMeter?.querySelector("strong")?.textContent ?? "0";
      const totalChars = Number(savedText.replace(/[^\d]/g, ""));
      return Math.round(totalChars / 4);
    });
    const report = {
      capturedAt: new Date().toISOString(),
      url,
      viewport: { width: 1600, height: 1100 },
      documentCharsPerEditor,
      sequence,
      samples: samples.samples,
      integritySamples: samples.integritySamples,
      longTasks,
      summary: summarizeSamples(samples.samples, samples.integritySamples, longTasks, pageFailures),
    };
    const markdown = buildMarkdownReport(report);

    await mkdir(reportDir, { recursive: true });
    await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    await writeFile(reportMarkdownPath, markdown, "utf8");
    console.log(markdown);
    console.log(`Report JSON: ${reportJsonPath}`);
    console.log(`Report Markdown: ${reportMarkdownPath}`);
  } finally {
    await browser.close();
    if (server) {
      server.kill();
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
